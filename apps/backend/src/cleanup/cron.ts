import { createDb } from "../db";
import * as schema from "@strudel-flow/db/schema";
import { lt, and, sql, eq } from "drizzle-orm";
import { getAuth } from "../auth/auth";

export async function cleanupAnonymousUsers(d1: D1Database) {
	const db = createDb(d1);
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days
	
	// Find anonymous sessions older than cutoff
	const expiredSessions = await db
		.select({
			userId: schema.session.userId,
		})
		.from(schema.session)
		.where(
			and(
				lt(schema.session.expiresAt, cutoffDate),
				sql`${schema.user.isAnonymous} = 1`,
			),
		);
	
	console.log(`Found ${expiredSessions.length} expired anonymous sessions`);
	
	// Delete anonymous users and their projects
	for (const session of expiredSessions) {
		await db.delete(schema.user).where(eq(schema.user.id, session.userId));
		// Cascades delete: sessions, projects, project_members, etc.
	}
	
	return expiredSessions.length;
}
