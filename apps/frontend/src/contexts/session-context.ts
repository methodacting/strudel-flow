import { createContext, useContext } from "react";
import type { Session } from "@/lib/auth";

export type SessionContextValue = {
	sessionReady: boolean;
	session: Session | null;
	isAuthenticated: boolean;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSessionContext must be used within SessionProvider");
	}
	return ctx;
}
