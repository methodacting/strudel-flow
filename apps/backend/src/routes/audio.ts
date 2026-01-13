import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import type { AppBindings, AppVariables } from "../types/hono";
import { nanoid } from "nanoid";

export const audioRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>()
	.use("/*", authMiddleware)
	// Create audio export
	.post(
		"/projects/:id/export",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
			const user = c.get("user");
			const { id: projectId } = c.req.valid("param");

			// Verify user has access to project
			// TODO: Add project access check

			const formData = await c.req.formData();
			const audioFile = formData.get("audio");
			const overwrite = formData.get("overwrite") === "true";

			if (!audioFile || typeof audioFile === "string") {
				return c.json({ error: "No audio file provided" }, 400);
			}

			const file = audioFile as File;

			const exportId = nanoid();
			const fileKey = `exports/${projectId}/${exportId}.mp3`;

			// If overwrite, mark previous exports as not latest
			if (overwrite) {
				await c.env.DB.prepare(`
          UPDATE project_export
          SET is_latest = 0
          WHERE project_id = ? AND is_latest = 1
        `)
					.bind(projectId)
					.run();
			}

			// Upload to R2
			await c.env.AUDIO_EXPORTS.put(
				fileKey,
				await file.arrayBuffer(),
				{
					httpMetadata: {
						contentType: "audio/mpeg",
					},
				},
			);

			// Get duration from form or estimate
			const durationSeconds =
				parseFloat(formData.get("duration") as string) || 0;

			// Store metadata
			await c.env.DB.prepare(`
        INSERT INTO project_export (id, project_id, file_key, format, duration_seconds, is_latest, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
				.bind(
					exportId,
					projectId,
					fileKey,
					"mp3",
					durationSeconds,
					1,
					Date.now(),
				)
				.run();

			// Return URLs
			const audioUrl = `/api/audio/${exportId}`;

			return c.json({
				audioUrl,
				exportId,
				shareUrl: `${new URL(c.req.url).origin}/audio/${exportId}`,
				duration: durationSeconds,
				createdAt: new Date().toISOString(),
			});
		},
	)
	// Get/serve audio export
	.get(
		"/audio/:exportId",
		zValidator(
			"param",
			z.object({
				exportId: z.string().min(1),
			}),
		),
		async (c) => {
			const { exportId } = c.req.valid("param");

			// Get export metadata
			const result = await c.env.DB.prepare(`
        SELECT file_key FROM project_export WHERE id = ?
      `)
				.bind(exportId)
				.first();

			if (!result) {
				return c.json({ error: "Export not found" }, 404);
			}

			// Get from R2
			const object = await c.env.AUDIO_EXPORTS.get(
				result.file_key as string,
			);

			if (!object) {
				return c.json({ error: "Audio file not found" }, 404);
			}

			// Stream the file
			return new Response(object.body, {
				headers: {
					"Content-Type": "audio/mpeg",
					"Cache-Control": "public, max-age=31536000",
				},
			});
		},
	);
