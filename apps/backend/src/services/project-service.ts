import { db } from "../db";
import { nanoid } from "nanoid";
import * as schema from "@strudel-flow/db/schema";
import { eq, desc, and, or, inArray, gt, isNull } from "drizzle-orm";
import type { AppBindings } from "../types/hono";
import {
	fromDatabase,
	success,
	errors,
	type Result,
	type AppError,
} from "../errors";

export class ProjectService {
	constructor(private env: AppBindings) {}

	private getHigherProjectRole(a: string, b: string) {
		const priority: Record<string, number> = { viewer: 1, editor: 2, owner: 3 };
		const aRank = priority[a] ?? 0;
		const bRank = priority[b] ?? 0;
		return aRank >= bRank ? a : b;
	}

	async listProjects(
		userId: string,
		limit?: number,
		offset?: number,
	): Promise<Result<schema.Project[], AppError>> {
		const database = db(this.env.DB);

		const memberProjectIdsResult = await fromDatabase(
			database
				.select({ projectId: schema.projectMember.projectId })
				.from(schema.projectMember)
				.where(eq(schema.projectMember.userId, userId)),
			{ operation: "listProjects_getMemberProjectIds", userId },
		);

		if (memberProjectIdsResult.isErr()) {
			return errors.databaseError("Failed to fetch member projects", memberProjectIdsResult.error);
		}

		const orgMembershipsResult = await fromDatabase(
			database
				.select({ organizationId: schema.member.organizationId })
				.from(schema.member)
				.where(eq(schema.member.userId, userId)),
			{ operation: "listProjects_getOrgMemberships", userId },
		);

		if (orgMembershipsResult.isErr()) {
			return errors.databaseError("Failed to fetch organization memberships", orgMembershipsResult.error);
		}

		const projectIds = memberProjectIdsResult.value.map((row) => row.projectId);
		const organizationIds = orgMembershipsResult.value.map((row) => row.organizationId);

		const conditions = [eq(schema.project.ownerId, userId)];
		if (projectIds.length > 0) {
			conditions.push(inArray(schema.project.id, projectIds));
		}
		if (organizationIds.length > 0) {
			conditions.push(inArray(schema.project.organizationId, organizationIds));
		}

		let query = database
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

		return fromDatabase(query, { operation: "listProjects_getProjects", userId });
	}

	async createProject(
		userId: string,
		name: string,
		organizationId?: string | null,
		projectId?: string,
	): Promise<Result<schema.Project, AppError>> {
		const now = new Date();
		const database = db(this.env.DB);
		const resolvedProjectId = projectId ?? nanoid();

		if (organizationId) {
			const isMemberResult = await this.isOrganizationMember(userId, organizationId);
			if (isMemberResult.isErr()) {
				return errors.databaseError("Failed to verify organization membership", isMemberResult.error);
			}
			if (!isMemberResult.value) {
				return errors.insufficientPermissions(
					"User is not a member of the organization",
				);
			}
		}

		if (projectId) {
			const existing = await fromDatabase(
				database
					.select({ id: schema.project.id })
					.from(schema.project)
					.where(eq(schema.project.id, projectId))
					.limit(1),
				{ operation: "createProject_checkExisting", projectId },
			);
			if (existing.isErr()) {
				return errors.databaseError(
					"Failed to verify existing project",
					existing.error,
				);
			}
			if (existing.value.length > 0) {
				return errors.resourceAlreadyExists("project");
			}
		}

		const project = await fromDatabase(
			database
				.insert(schema.project)
				.values({
					id: resolvedProjectId,
					name,
					ownerId: userId,
					organizationId: organizationId ?? null,
					createdAt: now,
					updatedAt: now,
				})
				.returning(),
			{ operation: "createProject", projectId: resolvedProjectId },
		);

		return project.map((projects) => projects[0]);
	}

	async getProject(projectId: string): Promise<Result<schema.Project | undefined, AppError>> {
		const database = db(this.env.DB);
		const result = await fromDatabase(
			database
				.select()
				.from(schema.project)
				.where(eq(schema.project.id, projectId)),
			{ operation: "getProject", projectId },
		);

		return result.map((projects) => projects[0]);
	}

	async updateProject(
		projectId: string,
		updates: { name?: string },
	): Promise<Result<schema.Project | undefined, AppError>> {
		const database = db(this.env.DB);
		const result = await fromDatabase(
			database
				.update(schema.project)
				.set({
					...updates,
					updatedAt: new Date(),
				})
				.where(eq(schema.project.id, projectId))
				.returning(),
			{ operation: "updateProject", projectId },
		);

		return result.map((projects) => projects[0]);
	}

	async deleteProject(projectId: string): Promise<Result<void, AppError>> {
		const database = db(this.env.DB);
		const result = await fromDatabase(
			database
				.delete(schema.project)
				.where(eq(schema.project.id, projectId)),
			{ operation: "deleteProject", projectId },
		);

		return result.map(() => undefined);
	}

	async createInvite(
		projectId: string,
		createdBy: string,
		role: string = "editor",
	): Promise<Result<string, AppError>> {
		const token = nanoid();
		const now = new Date();
		const database = db(this.env.DB);

		// Delete any existing invite for the same project and role
		const deleteResult = await fromDatabase(
			database
				.delete(schema.projectInvite)
				.where(
					and(
						eq(schema.projectInvite.projectId, projectId),
						eq(schema.projectInvite.role, role),
					),
				),
			{ operation: "createInvite_deleteOld", projectId, role },
		);

		if (deleteResult.isErr()) {
			return errors.databaseError("Failed to delete old invite", deleteResult.error);
		}

		await fromDatabase(
			database
				.insert(schema.projectInvite)
				.values({
					id: nanoid(),
					projectId,
					token,
					role,
					createdBy,
					expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
					maxUses: null,
					uses: 0,
				}),
			{ operation: "createInvite_insert", token },
		);

		return success(token);
	}

	async getInviteByToken(token: string): Promise<Result<schema.ProjectInvite | undefined, AppError>> {
		const database = db(this.env.DB);
		const result = await fromDatabase(
			database
				.select()
				.from(schema.projectInvite)
				.where(eq(schema.projectInvite.token, token)),
			{ operation: "getInviteByToken", token },
		);

		return result.map((invites) => invites[0]);
	}

	async listActiveInvites(projectId: string): Promise<Result<schema.ProjectInvite[], AppError>> {
		const now = new Date();
		const database = db(this.env.DB);
		return fromDatabase(
			database
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
				),
			{ operation: "listActiveInvites", projectId },
		);
	}

	async revokeInvite(projectId: string, role: string): Promise<Result<void, AppError>> {
		const database = db(this.env.DB);
		return fromDatabase(
			database
				.delete(schema.projectInvite)
				.where(
					and(
						eq(schema.projectInvite.projectId, projectId),
						eq(schema.projectInvite.role, role),
					),
				),
			{ operation: "revokeInvite", projectId, role },
		).map(() => undefined);
	}

	async joinProject(projectId: string, userId: string, role: string = "editor"): Promise<Result<void, AppError>> {
		const now = new Date();
		const database = db(this.env.DB);
		return fromDatabase(
			database
				.insert(schema.projectMember)
				.values({
					projectId,
					userId,
					role,
					joinedAt: now,
				})
				.onConflictDoNothing(),
			{ operation: "joinProject", projectId, userId },
		).map(() => undefined);
	}

	async checkAccess(projectId: string, userId: string): Promise<
		Result<
			{ allowed: true; role: string } | { allowed: false; reason: string },
			AppError
		>
	> {
		const project = await this.getProject(projectId);

		if (project.isErr()) {
			return project.map(() => {
				// This won't be reached, but we need to return the right type
				return { allowed: false, reason: "Database error" };
			});
		}

		if (!project.value) {
			return success({ allowed: false, reason: "Project not found" });
		}

		if (project.value.ownerId === userId) {
			return success({ allowed: true, role: "owner" });
		}

		if (project.value.organizationId) {
			const isOrgMember = await this.isOrganizationMember(
				userId,
				project.value.organizationId,
			);

			if (isOrgMember.isErr()) {
				return isOrgMember.map(() => ({ allowed: false, reason: "Database error" }));
			}

			if (isOrgMember.value) {
				return success({ allowed: true, role: "editor" });
			}
		}

		const database = db(this.env.DB);
		const members = await fromDatabase(
			database
				.select()
				.from(schema.projectMember)
				.where(and(
					eq(schema.projectMember.projectId, projectId),
					eq(schema.projectMember.userId, userId)
				)),
			{ operation: "checkAccess", projectId, userId },
		);

		if (members.isErr()) {
			return members.map(() => ({ allowed: false, reason: "Database error" }));
		}

		if (members.value.length > 0) {
			return success({ allowed: true, role: members.value[0].role });
		}

		return success({ allowed: false, reason: "No access" });
	}

	private async isOrganizationMember(userId: string, organizationId: string): Promise<Result<boolean, AppError>> {
		const database = db(this.env.DB);
		const members = await fromDatabase(
			database
				.select({ id: schema.member.id })
				.from(schema.member)
				.where(
					and(
						eq(schema.member.userId, userId),
						eq(schema.member.organizationId, organizationId),
					),
				)
				.limit(1),
			{ operation: "isOrganizationMember", userId, organizationId },
		);

		return members.map((result) => result.length > 0);
	}

	async mergeAnonymousUser(
		anonymousUserId: string,
		userId: string,
	): Promise<Result<void, AppError>> {
		if (anonymousUserId === userId) {
			return success(undefined);
		}

		const database = db(this.env.DB);
		const now = new Date();

		const result = await fromDatabase(
			database.transaction(async (tx) => {
				await tx
					.update(schema.project)
					.set({ ownerId: userId, updatedAt: now })
					.where(eq(schema.project.ownerId, anonymousUserId));

				await tx
					.update(schema.projectInvite)
					.set({ createdBy: userId })
					.where(eq(schema.projectInvite.createdBy, anonymousUserId));

				await tx
					.update(schema.invitation)
					.set({ inviterId: userId })
					.where(eq(schema.invitation.inviterId, anonymousUserId));

				const anonOrgMemberships = await tx
					.select()
					.from(schema.member)
					.where(eq(schema.member.userId, anonymousUserId));

				for (const membership of anonOrgMemberships) {
					const existing = await tx
						.select()
						.from(schema.member)
						.where(
							and(
								eq(schema.member.userId, userId),
								eq(schema.member.organizationId, membership.organizationId),
							),
						)
						.limit(1);

					if (existing.length > 0) {
						await tx
							.delete(schema.member)
							.where(eq(schema.member.id, membership.id));
					} else {
						await tx
							.update(schema.member)
							.set({ userId })
							.where(eq(schema.member.id, membership.id));
					}
				}

				const anonProjectMemberships = await tx
					.select()
					.from(schema.projectMember)
					.where(eq(schema.projectMember.userId, anonymousUserId));

				for (const membership of anonProjectMemberships) {
					const existing = await tx
						.select()
						.from(schema.projectMember)
						.where(
							and(
								eq(schema.projectMember.userId, userId),
								eq(schema.projectMember.projectId, membership.projectId),
							),
						)
						.limit(1);

					if (existing.length > 0) {
						const mergedRole = this.getHigherProjectRole(
							existing[0].role,
							membership.role,
						);
						if (mergedRole !== existing[0].role) {
							await tx
								.update(schema.projectMember)
								.set({ role: mergedRole })
								.where(
									and(
										eq(schema.projectMember.userId, userId),
										eq(schema.projectMember.projectId, membership.projectId),
									),
								);
						}
						await tx
							.delete(schema.projectMember)
							.where(
								and(
									eq(schema.projectMember.userId, anonymousUserId),
									eq(schema.projectMember.projectId, membership.projectId),
								),
							);
					} else {
						await tx
							.update(schema.projectMember)
							.set({ userId })
							.where(
								and(
									eq(schema.projectMember.userId, anonymousUserId),
									eq(schema.projectMember.projectId, membership.projectId),
								),
							);
					}
				}
			}),
			{ operation: "mergeAnonymousUser", anonymousUserId, userId },
		);

		return result.map(() => undefined);
	}
}
