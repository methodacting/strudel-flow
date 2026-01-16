import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { nanoid } from "nanoid";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppBindings, AppVariables } from "../types/hono";
import { ProjectService } from "../services/project-service";

export const realtimeRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>()
	.use("/*", authMiddleware)
	.get(
		"/projects/:id/realtime",
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
	if (!access.allowed) {
		return c.json({ error: "Forbidden" }, 403);
	}

	// Generate unique client ID for this connection
	const clientId = nanoid();
	const userName = user?.name || "Anonymous";

	// Construct WebSocket URL for the DO
	const requestUrl = new URL(c.req.url);
	const wsProtocol = requestUrl.protocol === "https:" ? "wss" : "ws";
	const wsUrl = `${wsProtocol}://${requestUrl.host}/api/yjs`;

	return c.json({
		wsUrl,
		clientId,
		projectId,
		role: access.role,
		user: {
			id: user?.id,
			name: userName,
		},
	});
	})
	.get(
		"/project/:id/state",
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
	const user = c.get("user");
	const { id: projectId } = c.req.valid("param");

	// Get current Yjs state from DO
	const durableObjectId = c.env.Y_DURABLE_OBJECTS.idFromName(projectId);
	const stub = c.env.Y_DURABLE_OBJECTS.get(durableObjectId);
	const stateData = await stub.getYDoc();

	return new Response(stateData, {
		headers: {
			"Content-Type": "application/octet-stream",
		},
	});
	});
