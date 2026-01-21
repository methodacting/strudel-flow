import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { ProjectService } from "../services/project-service";
import type { AppBindings, AppVariables } from "../types/hono";
import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";
import { eq } from "drizzle-orm";
import { resultToResponse } from "../errors/hono";

export const projectRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>()
	.use("/*", authMiddleware)
	.get("/projects", async (c) => {
	const user = c.get("user");
	const service = new ProjectService(c.env);
	const projectsResult = await service.listProjects(user.id);

	if (projectsResult.isErr()) {
		return c.json({ error: "Failed to fetch projects" }, 500);
	}

	return c.json({ projects: projectsResult.value });
})
	.post(
		"/projects",
		zValidator(
			"json",
			z.object({
				name: z.string().min(1).max(100),
				organizationId: z.string().min(1).optional(),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const session = c.get("session");
	const { name, organizationId } = c.req.valid("json");
	const activeOrganizationId =
		session?.session?.activeOrganizationId ??
		(session as { activeOrganizationId?: string | null } | undefined)
			?.activeOrganizationId ??
		null;
	const resolvedOrganizationId = organizationId ?? activeOrganizationId;

	const service = new ProjectService(c.env);
	const projectResult = await service.createProject(
		user.id,
		name,
		resolvedOrganizationId,
	);

	if (projectResult.isErr()) {
		console.error("[projects] create failed", {
			userId: user.id,
			name,
			organizationId: resolvedOrganizationId,
			error: projectResult.error,
		});
		const error = projectResult.error;
		if (error.message.includes("organization")) {
			return c.json({ error: error.message }, 403);
		}
		return c.json({ error: "Failed to create project" }, 500);
	}

	return c.json({ project: projectResult.value });
	})
	.get(
		"/projects/:id",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const { id: projectId } = c.req.valid("param");

	const service = new ProjectService(c.env);
	const projectResult = await service.getProject(projectId);

	if (projectResult.isErr() || !projectResult.value) {
		return c.json({ error: "Project not found" }, 404);
	}

	const project = projectResult.value;
	const accessResult = await service.checkAccess(projectId, user.id);

	if (accessResult.isErr() || !accessResult.value.allowed) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const access = accessResult.value;
	return c.json({ project: { ...project, accessRole: access.role } });
	})
	.put(
		"/projects/:id",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		zValidator(
			"json",
			z.object({
				name: z.string().min(1).max(100).optional(),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const { id: projectId } = c.req.valid("param");
	const updates = c.req.valid("json");

	const service = new ProjectService(c.env);
	const accessResult = await service.checkAccess(projectId, user.id);

	if (
		accessResult.isErr() ||
		!accessResult.value.allowed ||
		(accessResult.value.role !== "owner" && accessResult.value.role !== "editor")
	) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const projectResult = await service.updateProject(projectId, updates);

	if (projectResult.isErr()) {
		return c.json({ error: "Failed to update project" }, 500);
	}

	return c.json({ project: projectResult.value });
	})
	.delete(
		"/projects/:id",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const { id: projectId } = c.req.valid("param");

	const service = new ProjectService(c.env);
	const accessResult = await service.checkAccess(projectId, user.id);

	if (
		accessResult.isErr() ||
		!accessResult.value.allowed ||
		accessResult.value.role === "viewer"
	) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const deleteResult = await service.deleteProject(projectId);

	if (deleteResult.isErr()) {
		return c.json({ error: "Failed to delete project" }, 500);
	}

	return c.json({ success: true });
	})
	.post(
		"/projects/:id/invite",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		zValidator(
			"json",
			z.object({
				role: z.enum(["viewer", "editor"]).optional(),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const { id: projectId } = c.req.valid("param");
	const { role = "editor" } = c.req.valid("json");

	const service = new ProjectService(c.env);
	const accessResult = await service.checkAccess(projectId, user.id);

	if (accessResult.isErr() || !accessResult.value.allowed || accessResult.value.role !== "owner") {
		return c.json({ error: "Forbidden" }, 403);
	}

	const tokenResult = await service.createInvite(projectId, user.id, role);

	if (tokenResult.isErr()) {
		return c.json({ error: "Failed to create invite" }, 500);
	}

	const token = tokenResult.value;
	const origin =
		c.env.FRONTEND_URL ||
		c.req.header("origin") ||
		new URL(c.req.url).origin;
	const inviteUrl = `${origin}/api/projects/join/${token}`;

	return c.json({ inviteUrl });
	})
	.get(
		"/projects/:id/invites",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
			const user = c.get("user");
			const { id: projectId } = c.req.valid("param");

			const service = new ProjectService(c.env);
			const accessResult = await service.checkAccess(projectId, user.id);

			if (accessResult.isErr() || !accessResult.value.allowed || accessResult.value.role !== "owner") {
				return c.json({ error: "Forbidden" }, 403);
			}

			const invitesResult = await service.listActiveInvites(projectId);

			if (invitesResult.isErr()) {
				return c.json({ error: "Failed to fetch invites" }, 500);
			}

			const origin =
				c.env.FRONTEND_URL ||
				c.req.header("origin") ||
				new URL(c.req.url).origin;

			return c.json({
				invites: invitesResult.value.map((invite) => ({
					role: invite.role,
					inviteUrl: `${origin}/api/projects/join/${invite.token}`,
					expiresAt: invite.expiresAt,
				})),
			});
		},
	)
	.delete(
		"/projects/:id/invite/:role",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
				role: z.enum(["viewer", "editor"]),
			}),
		),
		async (c) => {
			const user = c.get("user");
			const { id: projectId, role } = c.req.valid("param");

			const service = new ProjectService(c.env);
			const accessResult = await service.checkAccess(projectId, user.id);

			if (accessResult.isErr() || !accessResult.value.allowed || accessResult.value.role !== "owner") {
				return c.json({ error: "Forbidden" }, 403);
			}

			const revokeResult = await service.revokeInvite(projectId, role);

			if (revokeResult.isErr()) {
				return c.json({ error: "Failed to revoke invite" }, 500);
			}

			return c.json({ success: true });
		},
	)
	.post(
		"/projects/join/:token",
		zValidator(
			"param",
			z.object({
				token: z.string().min(1),
			}),
		),
		async (c) => {
			try {
				const user = c.get("user");
				const { token } = c.req.valid("param");

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

				const accessResult = await service.checkAccess(invite.projectId, user.id);
				if (accessResult.isErr() || !accessResult.value.allowed) {
					const joinResult = await service.joinProject(invite.projectId, user.id, invite.role);
					if (joinResult.isErr()) {
						console.error("[projects] join failed", joinResult.error);
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

				return c.json({ project: projectResult.value });
			} catch (error) {
				console.error("[projects] join failed", error);
				return c.json({ error: "Failed to join project" }, 500);
			}
		},
	);
