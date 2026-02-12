export const queryKeys = {
	session: ["session"] as const,
	projects: ["projects"] as const,
	project: (projectId: string) => ["projects", projectId] as const,
	localProjects: (scope: string) => ["projects", "local", scope] as const,
	localProject: (projectId: string, scope: string) =>
		["projects", "local", scope, projectId] as const,
	realtime: (projectId: string) => ["realtime", projectId] as const,
	projectInvites: (projectId: string) => ["projects", projectId, "invites"] as const,
};
