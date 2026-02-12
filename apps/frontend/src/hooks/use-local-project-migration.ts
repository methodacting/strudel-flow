import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { indexedDB } from "@/lib/indexeddb";
import { ANON_SCOPE, getProjectScope } from "@/lib/project-scope";
import { honoClient } from "@/lib/hono-client";
import { queryKeys } from "@/lib/query-keys";
import type { Project } from "@/types/project";

export function useLocalProjectMigration(userId?: string | null) {
	const queryClient = useQueryClient();
	const migratedUserRef = useRef<string | null>(null);

	useEffect(() => {
		if (!userId) return;
		if (migratedUserRef.current === userId) return;
		migratedUserRef.current = userId;

		const migrate = async () => {
			const anonProjects = await indexedDB.projects.getAll(ANON_SCOPE);
			if (anonProjects.length === 0) return;

			const userScope = getProjectScope(userId);
			for (const project of anonProjects) {
				try {
					const response = await honoClient.api.projects.$post({
						json: {
							id: project.id,
							name: project.name,
							organizationId: project.organizationId ?? undefined,
						},
					});

					if (!response.ok) {
						// Skip on conflicts or auth errors; keep local for retry.
						console.warn("[projects] migrate failed", project.id, response.status);
						continue;
					}

					const data = await response.json();
					const backendProject = data.project as Project | undefined;
					const updatedProject: Project = {
						...(backendProject ?? project),
						accessRole: "owner",
					};
					await indexedDB.projects.update(updatedProject, userScope);
				} catch (error) {
					console.warn("[projects] migrate error", project.id, error);
				}
			}

			queryClient.invalidateQueries({ queryKey: queryKeys.projects });
			queryClient.invalidateQueries({ queryKey: queryKeys.localProjects(ANON_SCOPE) });
			queryClient.invalidateQueries({ queryKey: queryKeys.localProjects(userScope) });
		};

		void migrate();
	}, [queryClient, userId]);
}
