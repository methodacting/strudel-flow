import type { Context, Next } from "hono";
import { getAuth } from "../auth/auth";
import type { AppBindings, AppVariables, AuthSession } from "../types/hono";

export async function authMiddleware(
	c: Context<{ Bindings: AppBindings; Variables: AppVariables }>,
	next: Next,
) {
	console.log("[auth-middleware] Checking session for:", c.req.path);
	console.log("[auth-middleware] Origin:", c.req.header("origin"));
	console.log("[auth-middleware] Cookie header:", c.req.header("cookie"));

	const auth = getAuth(c.env.DB, c.env);

	const session: AuthSession = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!session) {
		console.log("[auth-middleware] No session found, returning 401");
		return c.json({ error: "Unauthorized" }, 401);
	}

	console.log("[auth-middleware] Session found for user:", session.user?.id);
	// Attach session to context
	c.set("session", session);
	c.set("user", session.user);

	await next();
}
