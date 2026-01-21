import { db } from "../db";
import * as schema from "@strudel-flow/db/schema";
import { lt, and, sql, eq } from "drizzle-orm";
import { getAuth } from "../auth/auth";

export async function cleanupAnonymousUsers(d1: D1Database) {
	const database = db(d1);
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days

	// Find anonymous sessions older than cutoff
	const expiredSessions = await database
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
		await database.delete(schema.user).where(eq(schema.user.id, session.userId));
		// Cascades delete: sessions, projects, project_members, etc.
	}
	
	return expiredSessions.length;
}
