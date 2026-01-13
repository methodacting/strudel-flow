import { Hono } from "hono";
import { hc } from "hono/client";
import {
	YDurableObjects,
	type YDurableObjectsAppType,
} from "y-durableobjects";
import { upgrade } from "y-durableobjects/helpers/upgrade";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import type { AppBindings, AppVariables } from "../types/hono";

export const yjsRouter = new Hono<{
	Bindings: AppBindings;
	Variables: AppVariables;
}>()
	.use("/*", authMiddleware)
	.get(
		"/yjs/:id",
		upgrade(),
		zValidator(
			"param",
			z.object({
				id: z.string().min(1),
			}),
		),
		async (c) => {
			const { id } = c.req.valid("param");
			const stub = c.env.Y_DURABLE_OBJECTS.get(
				c.env.Y_DURABLE_OBJECTS.idFromName(id),
			);

			const url = new URL("/", c.req.url);
			const client = hc<YDurableObjectsAppType>(url.toString(), {
				fetch: stub.fetch.bind(stub),
			});

			const res = await client.rooms[":roomId"].$get(
				{ param: { roomId: id } },
				{ init: { headers: c.req.raw.headers } },
			);

			return new Response(null, {
				webSocket: res.webSocket,
				status: res.status,
				statusText: res.statusText,
			});
		},
	);

export { YDurableObjects };
