export const ANON_SCOPE = "anon";

export type ProjectScope = string;

export function getProjectScope(userId?: string | null): ProjectScope {
	return userId ? `user:${userId}` : ANON_SCOPE;
}
