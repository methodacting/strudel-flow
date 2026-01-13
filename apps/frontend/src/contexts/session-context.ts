import { createContext, useContext } from "react";

export type SessionContextValue = {
	sessionReady: boolean;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSessionContext must be used within SessionProvider");
	}
	return ctx;
}
