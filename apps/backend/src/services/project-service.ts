import { db } from "../db";
import { nanoid } from "nanoid";
import * as schema from "@strudel-flow/db/schema";
import { eq, desc, and, or, inArray, gt, isNull } from "drizzle-orm";
import type { AppBindings } from "../types/hono";

export class ProjectService {
	constructor(private env: AppBindings) {}

	async listProjects(
		userId: string,
		limit?: number,
		offset?: number,
	) {
		const memberProjectIds = await db(this.env.DB)
			.select({ projectId: schema.projectMember.projectId })
			.from(schema.projectMember)
			.where(eq(schema.projectMember.userId, userId));

		const orgMemberships = await db(this.env.DB)
			.select({ organizationId: schema.member.organizationId })
			.from(schema.member)
			.where(eq(schema.member.userId, userId));

		const projectIds = memberProjectIds.map((row) => row.projectId);
		const organizationIds = orgMemberships.map((row) => row.organizationId);

		const conditions = [eq(schema.project.ownerId, userId)];
		if (projectIds.length > 0) {
			conditions.push(inArray(schema.project.id, projectIds));
		}
		if (organizationIds.length > 0) {
			conditions.push(inArray(schema.project.organizationId, organizationIds));
		}

		let query = db(this.env.DB)
			.select()
			.from(schema.project)
			.where(or(...conditions))
			.orderBy(desc(schema.project.createdAt));

		if (limit) {
			query = query.limit(limit) as typeof query;
		}

		if (offset) {
			query = query.offset(offset) as typeof query;
		}

		const projects = await query;
		return projects;
	}

	async createProject(
		userId: string,
		name: string,
		organizationId?: string | null,
	) {
		const projectId = nanoid();
		const now = new Date();

		if (organizationId) {
			const isMember = await this.isOrganizationMember(userId, organizationId);
			if (!isMember) {
				throw new Error("User is not a member of the organization");
			}
		}

		const project = await db(this.env.DB)
			.insert(schema.project)
			.values({
				id: projectId,
				name,
				ownerId: userId,
				organizationId: organizationId ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return project[0];
	}

	async getProject(projectId: string) {
		const projects = await db(this.env.DB)
			.select()
			.from(schema.project)
			.where(eq(schema.project.id, projectId));

		return projects[0];
	}

	async updateProject(projectId: string, updates: { name?: string }) {
		const projects = await db(this.env.DB)
			.update(schema.project)
			.set({
				...updates,
				updatedAt: new Date(),
			})
			.where(eq(schema.project.id, projectId))
			.returning();

		return projects[0];
	}

	async deleteProject(projectId: string) {
		await db(this.env.DB)
			.delete(schema.project)
			.where(eq(schema.project.id, projectId));
	}

	async createInvite(
		projectId: string,
		createdBy: string,
		role: string = "editor",
	) {
		const token = nanoid();
		const now = new Date();

		await db(this.env.DB)
			.delete(schema.projectInvite)
			.where(
				and(
					eq(schema.projectInvite.projectId, projectId),
					eq(schema.projectInvite.role, role),
				),
			);

		await db(this.env.DB).insert(schema.projectInvite).values({
			id: nanoid(),
			projectId,
			token,
			role,
			createdBy,
			expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
			maxUses: null,
			uses: 0,
		});

		return token;
	}

	async getInviteByToken(token: string) {
		const invites = await db(this.env.DB)
			.select()
			.from(schema.projectInvite)
			.where(eq(schema.projectInvite.token, token));

		return invites[0];
	}

	async listActiveInvites(projectId: string) {
		const now = new Date();
		return db(this.env.DB)
			.select()
			.from(schema.projectInvite)
			.where(
				and(
					eq(schema.projectInvite.projectId, projectId),
					gt(schema.projectInvite.expiresAt, now),
					or(
						isNull(schema.projectInvite.maxUses),
						gt(schema.projectInvite.maxUses, schema.projectInvite.uses),
					),
				),
			);
	}

	async revokeInvite(projectId: string, role: string) {
		await db(this.env.DB)
			.delete(schema.projectInvite)
			.where(
				and(
					eq(schema.projectInvite.projectId, projectId),
					eq(schema.projectInvite.role, role),
				),
			);
	}

	async joinProject(projectId: string, userId: string, role: string = "editor") {
		const now = new Date();

		await db(this.env.DB).insert(schema.projectMember).values({
			projectId,
			userId,
			role,
			joinedAt: now,
		});
	}

	async checkAccess(projectId: string, userId: string) {
		const project = await this.getProject(projectId);

		if (!project) {
			return { allowed: false, reason: "Project not found" };
		}

		if (project.ownerId === userId) {
			return { allowed: true, role: "owner" };
		}

		if (project.organizationId) {
			const isOrgMember = await this.isOrganizationMember(
				userId,
				project.organizationId,
			);
			if (isOrgMember) {
				return { allowed: true, role: "editor" };
			}
		}

		const members = await db(this.env.DB)
			.select()
			.from(schema.projectMember)
			.where(and(
				eq(schema.projectMember.projectId, projectId),
				eq(schema.projectMember.userId, userId)
			));

		if (members.length > 0) {
			return { allowed: true, role: members[0].role };
		}

		return { allowed: false, reason: "No access" };
	}

	private async isOrganizationMember(userId: string, organizationId: string) {
		const members = await db(this.env.DB)
			.select({ id: schema.member.id })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.userId, userId),
					eq(schema.member.organizationId, organizationId),
				),
			)
			.limit(1);

		return members.length > 0;
	}
}
