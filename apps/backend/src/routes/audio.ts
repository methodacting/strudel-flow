import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import type { AppBindings, AppVariables } from "../types/hono";
import { ProjectService } from "../services/project-service";
import { AudioService } from "../services/audio-service";
import { resultToResponse } from "../errors/hono";

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
			const projectService = new ProjectService(c.env);
			const accessResult = await projectService.checkAccess(projectId, user.id);

			if (accessResult.isErr() || !accessResult.value.allowed) {
				return c.json({ error: "Forbidden" }, 403);
			}

			// Parse form data
			const formData = await c.req.formData();
			const audioFile = formData.get("audio");
			const overwrite = formData.get("overwrite") === "true";
			const duration = formData.get("duration");

			if (!audioFile || typeof audioFile === "string") {
				return c.json(
					{ success: false, error: "No audio file provided" },
					400,
				);
			}

			const file = audioFile as File;
			const durationSeconds = parseFloat(duration as string) || 0;

			// Create audio export using service
			const audioService = new AudioService(c.env);
			const result = await audioService.createAudioExport({
				projectId,
				audioFile: file,
				durationSeconds,
				overwrite,
			});

			return resultToResponse(result, c);
		},
	);
