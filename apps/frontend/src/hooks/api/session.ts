import { useQuery } from "@tanstack/react-query";
import { getSession } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import type { Session } from "@/lib/auth";

type SessionResult = Session | null | { data: Session | null };

const normalizeSession = (result: SessionResult): Session | null => {
	if (!result) return null;
	if ("data" in result) {
		return result.data ?? null;
	}
	return result;
};

export const useSessionQuery = (enabled: boolean) =>
	useQuery<Session | null>({
		queryKey: queryKeys.session,
		enabled,
		queryFn: async () => {
			const result = (await getSession()) as SessionResult;
			return normalizeSession(result);
		},
		refetchInterval: 60 * 1000,
	});
