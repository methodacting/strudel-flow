import { Hono } from "hono";
import { getAuth } from "./auth";
import type { AppBindings } from "../types/hono";

export const authRouter = new Hono<{ Bindings: AppBindings }>().all(
	"/auth/*",
	async (c) => {
		const request = new Request(c.req.raw);
		const auth = getAuth(c.env.DB, c.env, c.req.url);
		const response = await auth.handler(request);

		return new Response(response.body, {
			status: response.status,
			headers: response.headers,
		});
	},
);
