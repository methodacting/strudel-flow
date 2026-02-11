import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { honoClient } from "@/lib/hono-client";
import { ApiStatusError, getErrorMessage } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { indexedDB } from "@/lib/indexeddb";
import { getProjectScope } from "@/lib/project-scope";
import type { Project } from "@/types/project";
import { nanoid } from "nanoid";

const withSignal = (signal?: AbortSignal) =>
	signal ? { init: { signal } } : undefined;

const toAccessRole = (
	role: string | null | undefined,
): Project["accessRole"] => {
	if (role === "owner" || role === "editor" || role === "viewer") {
		return role;
	}
	return undefined;
};

export const useProjectsQuery = (
	enabled: boolean,
	isAuthenticated: boolean,
	userId?: string | null,
) => {
	const scope = getProjectScope(userId ?? null);
	const query = useQuery<Project[], ApiStatusError>({
		queryKey: isAuthenticated ? queryKeys.projects : queryKeys.localProjects(scope),
		enabled,
		refetchOnMount: "always",
		refetchOnWindowFocus: true,
		queryFn: async ({ signal }) => {
			if (!isAuthenticated) {
				return indexedDB.projects.getAll(scope);
			}
			const response = await honoClient.api.projects.$get(
				{},
				withSignal(signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to fetch projects"),
					response.status,
				);
			}
			const data = await response.json();
			return data.projects;
		},
	});

	useEffect(() => {
		const projects = query.data;
		if (!projects) return;
		void (async () => {
			try {
				if (isAuthenticated) {
					await indexedDB.projects.setMany(projects, scope);
				}
			} catch (error) {
				console.warn("Failed to persist projects to IndexedDB", error);
			}
		})();
	}, [isAuthenticated, query.data, scope]);

	return query;
};

export const useProjectQuery = (
	projectId: string,
	enabled: boolean,
	isAuthenticated: boolean,
	userId?: string | null,
) => {
	const scope = getProjectScope(userId ?? null);
	return useQuery<Project, ApiStatusError>({
		queryKey: isAuthenticated
			? queryKeys.project(projectId)
			: queryKeys.localProject(projectId, scope),
		enabled,
		queryFn: async ({ signal }) => {
			if (!isAuthenticated) {
				const localProject = await indexedDB.projects.get(projectId, scope);
				if (!localProject) {
					throw new ApiStatusError("Project not found", 404);
				}
				return {
					...localProject,
					accessRole: localProject.accessRole ?? "owner",
				};
			}
			const response = await honoClient.api.projects[":id"].$get(
				{ param: { id: projectId } },
				withSignal(signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to fetch project"),
					response.status,
				);
			}
			const data = await response.json();
			const project = data.project as Project & { accessRole?: string | null };
			return {
				...project,
				accessRole: toAccessRole(project.accessRole),
			};
		},
	});
};

export type ProjectInvite = {
	role: "viewer" | "editor";
	inviteUrl: string;
	expiresAt: number;
};

const toInviteRole = (role: string | null | undefined): ProjectInvite["role"] =>
	role === "editor" ? "editor" : "viewer";

export const useProjectInvitesQuery = (
	projectId: string,
	isAuthenticated: boolean,
	enabled: boolean,
) =>
	useQuery<ProjectInvite[], ApiStatusError>({
		queryKey: queryKeys.projectInvites(projectId),
		enabled: enabled && isAuthenticated,
		queryFn: async ({ signal }) => {
			if (!isAuthenticated) {
				return [];
			}
			const response = await honoClient.api.projects[":id"].invites.$get(
				{ param: { id: projectId } },
				withSignal(signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to fetch invites"),
					response.status,
				);
			}
			const data = await response.json();
			const invites = (data.invites ?? []) as Array<{
				role?: string | null;
				inviteUrl: string;
				expiresAt: number | string;
			}>;
			return invites.map((invite) => {
				const expiresAt =
					typeof invite.expiresAt === "string"
						? Number(invite.expiresAt)
						: invite.expiresAt;
				return {
					role: toInviteRole(invite.role),
					inviteUrl: invite.inviteUrl,
					expiresAt,
				};
			});
		},
	});

export const useCreateProjectMutation = (
	isAuthenticated: boolean,
	userId?: string | null,
) => {
	const queryClient = useQueryClient();
	const scope = getProjectScope(userId ?? null);

	return useMutation({
		mutationFn: async (payload: { name: string; organizationId?: string }) => {
			if (!isAuthenticated) {
				const now = new Date().toISOString();
				const localProject: Project = {
					id: nanoid(),
					name: payload.name,
					createdAt: now,
					updatedAt: now,
					organizationId: payload.organizationId ?? null,
					accessRole: "owner",
				};
				await indexedDB.projects.add(localProject, scope);
				return localProject;
			}
			const response = await honoClient.api.projects.$post({
				json: payload.organizationId
					? { name: payload.name, organizationId: payload.organizationId }
					: { name: payload.name },
			});
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to create project"),
					response.status,
				);
			}
			const data = await response.json();
			return data.project;
		},
		onSuccess: async (project: Project) => {
			if (isAuthenticated) {
				await indexedDB.projects.add(project, scope);
				queryClient.invalidateQueries({ queryKey: queryKeys.projects });
			} else {
				queryClient.invalidateQueries({ queryKey: queryKeys.localProjects(scope) });
			}
		},
	});
};

export const useUpdateProjectMutation = (
	isAuthenticated: boolean,
	userId?: string | null,
) => {
	const queryClient = useQueryClient();
	const scope = getProjectScope(userId ?? null);

	return useMutation({
		mutationFn: async (payload: { id: string; name?: string }) => {
			if (!isAuthenticated) {
				const project = await indexedDB.projects.get(payload.id, scope);
				if (!project) {
					throw new Error("Project not found after update");
				}
				const updated: Project = {
					...project,
					name: payload.name ?? project.name,
					updatedAt: new Date().toISOString(),
				};
				await indexedDB.projects.update(updated, scope);
				return updated;
			}
			const response = await honoClient.api.projects[":id"].$put({
				param: { id: payload.id },
				json: { name: payload.name },
			});
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to update project"),
					response.status,
				);
			}
			const data = await response.json();
			if (!data.project) {
				throw new Error("Project not found after update");
			}
			return data.project;
		},
		onSuccess: async (project: Project) => {
			if (isAuthenticated) {
				await indexedDB.projects.update(project, scope);
				queryClient.invalidateQueries({ queryKey: queryKeys.projects });
			} else {
				queryClient.invalidateQueries({ queryKey: queryKeys.localProjects(scope) });
			}
		},
	});
};

export const useDeleteProjectMutation = (
	isAuthenticated: boolean,
	userId?: string | null,
) => {
	const queryClient = useQueryClient();
	const scope = getProjectScope(userId ?? null);

	return useMutation({
		mutationFn: async (projectId: string) => {
			if (!isAuthenticated) {
				await indexedDB.projects.delete(projectId, scope);
				return { success: true };
			}
			const response = await honoClient.api.projects[":id"].$delete({
				param: { id: projectId },
			});
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to delete project"),
					response.status,
				);
			}
			return response.json();
		},
		onSuccess: async (_result, projectId) => {
			if (isAuthenticated) {
				await indexedDB.projects.delete(projectId, scope);
				queryClient.invalidateQueries({ queryKey: queryKeys.projects });
			} else {
				queryClient.invalidateQueries({ queryKey: queryKeys.localProjects(scope) });
			}
		},
	});
};

export const useJoinProjectMutation = () =>
	useMutation({
		retry: false,
		mutationFn: async (payload: { token: string; signal?: AbortSignal }) => {
			const response = await honoClient.api.projects.join[":token"].$post(
				{ param: { token: payload.token } },
				withSignal(payload.signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to join project"),
					response.status,
				);
			}
			const data = await response.json();
			return data.project;
		},
	});

export const useCreateInviteMutation = (isAuthenticated: boolean) =>
	useMutation({
		mutationFn: async (payload: {
			projectId: string;
			role: "viewer" | "editor";
			signal?: AbortSignal;
		}) => {
			if (!isAuthenticated) {
				throw new ApiStatusError("Authentication required", 401);
			}
			const response = await honoClient.api.projects[":id"].invite.$post(
				{
					param: { id: payload.projectId },
					json: { role: payload.role },
				},
				withSignal(payload.signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to create invite"),
					response.status,
				);
			}
			return response.json();
		},
	});

export const useRevokeInviteMutation = (isAuthenticated: boolean) =>
	useMutation({
		mutationFn: async (payload: {
			projectId: string;
			role: "viewer" | "editor";
			signal?: AbortSignal;
		}) => {
			if (!isAuthenticated) {
				throw new ApiStatusError("Authentication required", 401);
			}
			const response = await honoClient.api.projects[":id"].invite[":role"].$delete(
				{ param: { id: payload.projectId, role: payload.role } },
				withSignal(payload.signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to revoke invite"),
					response.status,
				);
			}
			return response.json();
		},
	});

export const useRealtimeUrlQuery = (projectId: string, enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.realtime(projectId),
		enabled,
		queryFn: async ({ signal }) => {
			const response = await honoClient.api.projects[":id"].realtime.$get(
				{ param: { id: projectId } },
				withSignal(signal),
			);
			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to get realtime URL"),
					response.status,
				);
			}
			return response.json();
		},
	});
