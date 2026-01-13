export const queryKeys = {
	session: ["session"] as const,
	projects: ["projects"] as const,
	project: (projectId: string) => ["projects", projectId] as const,
	realtime: (projectId: string) => ["realtime", projectId] as const,
};
