/**
 * Manually defined CloudflareBindings type to avoid conflicts
 * between Wrangler-generated types and @cloudflare/workers-types
 */

import type { YDurableObjects } from "../index";

export interface CloudflareBindings {
	// Database bindings
	DB: D1Database;

	// R2 storage bindings
	AUDIO_EXPORTS: R2Bucket;

	// Durable Object bindings
	Y_DURABLE_OBJECTS: DurableObjectNamespace<YDurableObjects>;

	// Fetcher bindings
	ASSETS: Fetcher;

	// Better Auth environment variables
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	FRONTEND_URL: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	GITHUB_CLIENT_ID: string;
	GITHUB_CLIENT_SECRET: string;
}
