import { Hono } from "hono";
import type { AppBindings } from "../types/hono";
import { cleanupAnonymousUsers } from "../cleanup/cron";

export const cleanupRouter = new Hono<{ Bindings: AppBindings }>().post(
	"/cleanup/anonymous",
	async (c) => {
		const count = await cleanupAnonymousUsers(c.env.DB);
		return c.json({ deleted: count });
	},
);
