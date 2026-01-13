import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { honoClient } from "@/lib/hono-client";
import { ApiStatusError, getErrorMessage } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { indexedDB } from "@/lib/indexeddb";

const withSignal = (signal?: AbortSignal) =>
	signal ? { init: { signal } } : undefined;

export const useProjectsQuery = (enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.projects,
		enabled,
		queryFn: async ({ signal }) => {
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
		onSuccess: async (projects) => {
			try {
				await indexedDB.projects.setMany(projects);
			} catch (error) {
				console.warn("Failed to persist projects to IndexedDB", error);
			}
		},
	});

export const useProjectQuery = (projectId: string, enabled: boolean) =>
	useQuery({
		queryKey: queryKeys.project(projectId),
		enabled,
		queryFn: async ({ signal }) => {
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
			return data.project;
		},
	});

export const useCreateProjectMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: { name: string; organizationId?: string }) => {
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
		onSuccess: async (project) => {
			await indexedDB.projects.add(project);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects });
		},
	});
};

export const useUpdateProjectMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: { id: string; name?: string }) => {
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
			return data.project;
		},
		onSuccess: async (project) => {
			await indexedDB.projects.update(project);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects });
		},
	});
};

export const useDeleteProjectMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (projectId: string) => {
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
			await indexedDB.projects.delete(projectId);
			queryClient.invalidateQueries({ queryKey: queryKeys.projects });
		},
	});
};

export const useJoinProjectMutation = () =>
	useMutation({
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

export const useCreateInviteMutation = () =>
	useMutation({
		mutationFn: async (payload: {
			projectId: string;
			role?: string;
			signal?: AbortSignal;
		}) => {
			const response = await honoClient.api.projects[":id"].invite.$post(
				{
					param: { id: payload.projectId },
					json: payload.role ? { role: payload.role } : {},
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
