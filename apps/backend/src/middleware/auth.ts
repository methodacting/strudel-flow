import type { Context, Next } from "hono";
import { getAuth } from "../auth/auth";
import type { AppBindings, AppVariables, AuthSession } from "../types/hono";

export async function authMiddleware(
	c: Context<{ Bindings: AppBindings; Variables: AppVariables }>,
	next: Next,
) {
	const auth = getAuth(c.env.DB, c.env);
	let session: AuthSession | null = null;
	try {
		session = await auth.api.getSession({
			headers: c.req.raw.headers,
		});
	} catch (error) {
		console.error("[auth-middleware] getSession failed");
		return c.json({ error: "Auth failed" }, 500);
	}

	if (!session) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	// Attach session to context
	const user = {
		...session.user,
		image: session.user.image ?? null,
		isAnonymous: session.user.isAnonymous ?? null,
	};
	c.set("session", session);
	c.set("user", user);

	await next();
}
