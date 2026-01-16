import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { ProjectService } from "../services/project-service";
import type { AppBindings, AppVariables } from "../types/hono";
import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";
import { eq } from "drizzle-orm";

export const projectRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>()
	.use("/*", authMiddleware)
	.get("/projects", async (c) => {
	const user = c.get("user");
	const service = new ProjectService(c.env);
	const projects = await service.listProjects(user.id);

	return c.json({ projects });
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

	try {
		const project = await service.createProject(
			user.id,
			name,
			resolvedOrganizationId,
		);
		return c.json({ project });
	} catch (error) {
			console.error("[projects] create failed", {
				userId: user.id,
				name,
				organizationId: resolvedOrganizationId,
				error,
			});
		if (error instanceof Error && error.message.includes("organization")) {
			return c.json({ error: error.message }, 403);
		}
		return c.json({ error: "Failed to create project" }, 500);
	}
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
	const project = await service.getProject(projectId);

	if (!project) {
		return c.json({ error: "Project not found" }, 404);
	}

	const access = await service.checkAccess(projectId, user.id);

	if (!access.allowed) {
		return c.json({ error: "Forbidden" }, 403);
	}

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
	const access = await service.checkAccess(projectId, user.id);

	if (!access.allowed || (access.role !== "owner" && access.role !== "editor")) {
		return c.json({ error: "Forbidden" }, 403);
	}

	const project = await service.updateProject(projectId, updates);

	return c.json({ project });
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
	const access = await service.checkAccess(projectId, user.id);

	if (!access.allowed || access.role === "viewer") {
		return c.json({ error: "Forbidden" }, 403);
	}

	await service.deleteProject(projectId);

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
	const access = await service.checkAccess(projectId, user.id);

	if (!access.allowed || access.role !== "owner") {
		return c.json({ error: "Forbidden" }, 403);
	}

			const token = await service.createInvite(projectId, user.id, role);
			const origin = c.req.header("origin") || new URL(c.req.url).origin;
			const inviteUrl = `${origin}/project/join/${token}`;

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
			const access = await service.checkAccess(projectId, user.id);

			if (!access.allowed || access.role !== "owner") {
				return c.json({ error: "Forbidden" }, 403);
			}

			const invites = await service.listActiveInvites(projectId);
			const origin = c.req.header("origin") || new URL(c.req.url).origin;

			return c.json({
				invites: invites.map((invite) => ({
					role: invite.role,
					inviteUrl: `${origin}/project/join/${invite.token}`,
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
			const access = await service.checkAccess(projectId, user.id);

			if (!access.allowed || access.role !== "owner") {
				return c.json({ error: "Forbidden" }, 403);
			}

			await service.revokeInvite(projectId, role);

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
			const user = c.get("user");
			const { token } = c.req.valid("param");

			const service = new ProjectService(c.env);
			const invite = await service.getInviteByToken(token);

			if (!invite) {
				return c.json({ error: "Invite not found" }, 404);
			}

			const now = new Date();
			if (invite.expiresAt && invite.expiresAt < now) {
				return c.json({ error: "Invite expired" }, 410);
			}

			if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
				return c.json({ error: "Invite already used" }, 409);
			}

			const access = await service.checkAccess(invite.projectId, user.id);
			if (!access.allowed) {
				await service.joinProject(invite.projectId, user.id, invite.role);
				await db(c.env.DB)
					.update(schema.projectInvite)
					.set({ uses: invite.uses + 1 })
					.where(eq(schema.projectInvite.id, invite.id));
			}

			const project = await service.getProject(invite.projectId);
			if (!project) {
				return c.json({ error: "Project not found" }, 404);
			}

			return c.json({ project });
		},
	);
