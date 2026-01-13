import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth';
import * as schema from '@strudel-flow/db/schema';

// For D1/SQLite, we'll use a simpler setup
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';

// For local development, we can use a mock D1 or use wrangler
// The CLI needs a working database connection

// For D1 with better-auth CLI, use local SQLite
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';

const sqlite = new Database('./local.db');
const db = drizzleSqlite(sqlite, { schema });

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema,
	}),
	// Match your existing configuration
	basePath: '/auth',
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || '',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
			enabled: true,
		},
	},
	plugins: [
		// Add any plugins you're using
	],
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update age every 24 hours
	},
	account: {
		accountLinking: {
			trustedProviders: ['google'],
		},
	},
});
