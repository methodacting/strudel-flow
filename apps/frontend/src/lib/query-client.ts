import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 60 * 1000,
			refetchOnWindowFocus: false,
			retry: (failureCount, error) => {
  if (typeof error === "object" && error && "status" in error) {
    if ((error as { status?: number }).status === 401) return false;
  }
				return failureCount < 3;
			},
		},
		mutations: {
			retry: false,
		},
	},
});
