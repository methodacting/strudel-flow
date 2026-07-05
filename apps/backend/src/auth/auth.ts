import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";
import type { CloudflareBindings } from "../types/bindings";

const splitOrigins = (value?: string) =>
	value
		?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean) ?? [];

// Create a fresh auth instance for each request (required for Cloudflare Workers)
export function getAuth(
	d1: D1Database,
	env: CloudflareBindings,
	requestUrl?: string,
): ReturnType<typeof betterAuth> {
	const database = db(d1);
	const resolvedBaseUrl =
		env.BETTER_AUTH_URL ?? (requestUrl ? new URL(requestUrl).origin : undefined);
	if (!resolvedBaseUrl) {
		throw new Error("Missing BETTER_AUTH_URL and request URL for auth base URL.");
	}
	const baseOrigin = new URL(resolvedBaseUrl).origin;
	const isSecureOrigin = new URL(resolvedBaseUrl).protocol === "https:";
	const trustedOrigins = [
		baseOrigin,
		"https://frontend.strudel-flow.localhost",
		"https://backend.strudel-flow.localhost",
	];
	if (env.FRONTEND_URL) {
		trustedOrigins.push(env.FRONTEND_URL);
	}
	trustedOrigins.push(...splitOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS));

	return betterAuth({
		baseURL: resolvedBaseUrl,
		basePath: "/auth",
		trustedOrigins: Array.from(new Set(trustedOrigins)),
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
		},
		plugins: [
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
				trustedProviders: ["google"],
			},
		},
		advanced: {
			cookiePrefix: "better-auth",
			cookies: {
				sessionToken: {
					name: "better-auth.session_token",
					attributes: {
						httpOnly: true,
						sameSite: "lax",
						secure: isSecureOrigin,
						path: "/",
						domain: undefined,
					},
				},
			},
			useSecureCookies: isSecureOrigin,
		},
	});
}
