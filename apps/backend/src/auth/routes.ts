import { Hono } from "hono";
import { getAuth } from "./auth";
import type { AppBindings } from "../types/hono";

export const authRouter = new Hono<{ Bindings: AppBindings }>().all(
	"/auth/*",
	async (c) => {
		console.log("[auth] incoming", c.req.method, c.req.path);
		console.log("[auth] origin:", c.req.header("origin"));
		console.log("[auth] request cookie:", c.req.header("cookie"));
		const request = new Request(c.req.raw);
		const auth = getAuth(c.env.DB, c.env);
		const response = await auth.handler(request);
		console.log("[auth] response status:", response.status);

		// Log Set-Cookie headers
		const headersWithSetCookie = response.headers as Headers & {
			getSetCookie?: () => string[];
		};
		const setCookieHeaders = headersWithSetCookie.getSetCookie
			? headersWithSetCookie.getSetCookie()
			: response.headers.get("set-cookie");
		console.log("[auth] set-cookie headers:", setCookieHeaders);

		// Log all response headers
		console.log(
			"[auth] response headers:",
			Object.fromEntries(response.headers.entries()),
		);

		return new Response(response.body, {
			status: response.status,
			headers: response.headers,
		});
	},
);
