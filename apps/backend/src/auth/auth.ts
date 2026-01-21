import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, organization } from "better-auth/plugins";

import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";
import type { CloudflareBindings } from "../types/bindings";

// Create a fresh auth instance for each request (required for Cloudflare Workers)
export function getAuth(
	d1: D1Database,
	env: Pick<
		CloudflareBindings,
		| "BETTER_AUTH_URL"
		| "GOOGLE_CLIENT_ID"
		| "GOOGLE_CLIENT_SECRET"
		| "GITHUB_CLIENT_ID"
		| "GITHUB_CLIENT_SECRET"
		| "FRONTEND_URL"
	>,
): ReturnType<typeof betterAuth> {
	const database = db(d1);
	const baseOrigin = new URL(env.BETTER_AUTH_URL).origin;
	const trustedOrigins = [
		"http://localhost:5173",
		"http://127.0.0.1:5173",
		baseOrigin,
	];
	if (env.FRONTEND_URL) {
		trustedOrigins.push(env.FRONTEND_URL);
	}

	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		basePath: "/auth",
		trustedOrigins,
		database: drizzleAdapter(database, {
			provider: "sqlite",
			schema,
		} as any),
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID || "",
				clientSecret: env.GOOGLE_CLIENT_SECRET || "",
				enabled: true,
			},
			github: {
				clientId: env.GITHUB_CLIENT_ID || "",
				clientSecret: env.GITHUB_CLIENT_SECRET || "",
				scope: ["user:email"],
				enabled: true,
			},
		},
		plugins: [
			anonymous({
				generateName: () => `Guest ${Math.floor(Math.random() * 10000)}`,
				onLinkAccount: async ({ anonymousUser, newUser }) => {
					console.log("Anonymous account linked", {
						anonymousUser,
						newUser,
					});
				},
			}),
			organization(),
		],
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // Update age every 24 hours
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60, // 5 minutes
			},
		},
		account: {
			accountLinking: {
				trustedProviders: ["google", "github"],
			},
		},
		advanced: {
			cookiePrefix: "better-auth",
			cookies: {
				sessionToken: {
					name: "better-auth.session_token",
					attributes: {
						httpOnly: true,
						// For local development with different ports, use none to allow cross-port cookies
						// Note: SameSite=none requires Secure=true, but for local http we can't use it
						// So we rely on the fact that same-registrable-domain (localhost) treats different ports as same-site
						sameSite: "lax",
						// Don't set secure for local development
						secure: false,
						path: "/",
						// Explicitly don't set domain for localhost
						domain: undefined,
					},
				},
			},
			useSecureCookies: false, // Disable for local development
		},
	});
}
