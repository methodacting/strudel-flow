import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { ProjectService } from "../services/project-service";
import { AudioService } from "../services/audio-service";
import type { AppBindings } from "../types/hono";
import { getAuth } from "../auth/auth";
import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";

const SESSION_COOKIE_NAME = "better-auth.session_token";

const getSetCookieHeaders = (headers: Headers) => {
	const headersWithSetCookie = headers as Headers & {
		getSetCookie?: () => string[];
	};
	const setCookie = headersWithSetCookie.getSetCookie
		? headersWithSetCookie.getSetCookie()
		: headers.get("set-cookie");
	if (!setCookie) return [];
	return Array.isArray(setCookie) ? setCookie : [setCookie];
};

const getCookieValue = (setCookie: string, name: string) => {
	const cookie = setCookie.split(";")[0] ?? "";
	const [key, value] = cookie.split("=");
	if (!key || !value) return null;
	return key.trim() === name ? value : null;
};

export const publicProjectRouter = new Hono<{ Bindings: AppBindings }>().get(
	"/projects/join/:token",
	zValidator(
		"param",
		z.object({
			token: z.string().min(1),
		}),
	),
	async (c) => {
		try {
			const { token } = c.req.valid("param");
			const auth = getAuth(c.env.DB, c.env);

			let session = await auth.api.getSession({
				headers: c.req.raw.headers,
			});

			let setCookieHeaders: string[] = [];

			if (!session) {
				const signInUrl = new URL("/auth/sign-in/anonymous", c.req.url);
				const response = await auth.handler(
					new Request(signInUrl.toString(), {
						method: "POST",
						headers: c.req.raw.headers,
					}),
				);

				setCookieHeaders = getSetCookieHeaders(response.headers);
				const sessionCookie = setCookieHeaders
					.map((header) => getCookieValue(header, SESSION_COOKIE_NAME))
					.find(Boolean);

				if (sessionCookie) {
					session = await auth.api.getSession({
						headers: new Headers({
							cookie: `${SESSION_COOKIE_NAME}=${sessionCookie}`,
						}),
					});
				}
			}

			if (!session) {
				return c.json({ error: "Unauthorized" }, 401);
			}

			const service = new ProjectService(c.env);
			const inviteResult = await service.getInviteByToken(token);

			if (inviteResult.isErr() || !inviteResult.value) {
				return c.json({ error: "Invite not found" }, 404);
			}

			const invite = inviteResult.value;

			const now = new Date();
			if (invite.expiresAt && invite.expiresAt < now) {
				return c.json({ error: "Invite expired" }, 410);
			}

			if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
				return c.json({ error: "Invite already used" }, 409);
			}

			const accessResult = await service.checkAccess(
				invite.projectId,
				session.user.id,
			);
			if (accessResult.isErr() || !accessResult.value.allowed) {
				const joinResult = await service.joinProject(invite.projectId, session.user.id, invite.role);
				if (joinResult.isErr()) {
					return c.json({ error: "Failed to join project" }, 500);
				}
				await db(c.env.DB)
					.update(schema.projectInvite)
					.set({ uses: invite.uses + 1 })
					.where(eq(schema.projectInvite.id, invite.id));
			}

			const projectResult = await service.getProject(invite.projectId);
			if (projectResult.isErr() || !projectResult.value) {
				return c.json({ error: "Project not found" }, 404);
			}

			const project = projectResult.value;

			const origin =
				c.env.FRONTEND_URL ||
				c.req.header("origin") ||
				new URL(c.req.url).origin;
			const response = c.redirect(`${origin}/project/${project.id}`, 302);
			if (setCookieHeaders.length > 0) {
				for (const header of setCookieHeaders) {
					response.headers.append("set-cookie", header);
				}
			}
			return response;
		} catch (error) {
			console.error("[projects] public join failed", error);
			return c.json({ error: "Failed to join project" }, 500);
		}
	},
)
// Public endpoint to serve audio exports (no auth required)
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
		const audioService = new AudioService(c.env);
		const metadataResult = await audioService.getAudioExport(exportId);

		if (!metadataResult.isOk()) {
			const error = metadataResult.error;
			return c.json(
				{ success: false, ...error.toJSON() },
				error.getStatusCode() as 400 | 401 | 403 | 404 | 409 | 500 | 503,
			);
		}

		// Get audio file from R2
		const fileResult = await audioService.getAudioFile(
			metadataResult.value.fileKey,
		);

		if (!fileResult.isOk()) {
			const error = fileResult.error;
			return c.json(
				{ success: false, ...error.toJSON() },
				error.getStatusCode() as 400 | 401 | 403 | 404 | 409 | 500 | 503,
			);
		}

		// Stream the file
		const object = fileResult.value as R2ObjectBody;
		return new Response(object.body, {
			headers: {
				"Content-Type": "audio/wav",
				"Cache-Control": "public, max-age=31536000",
			},
		});
	},
);
