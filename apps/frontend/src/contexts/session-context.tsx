import { createContext, useContext } from "react";
import type React from "react";

type SessionContextValue = {
	sessionReady: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
	sessionReady,
	children,
}: {
	sessionReady: boolean;
	children: React.ReactNode;
}) {
	return (
		<SessionContext.Provider value={{ sessionReady }}>
			{children}
		</SessionContext.Provider>
	);
}

export function useSessionContext(): SessionContextValue {
	const ctx = useContext(SessionContext);
	if (!ctx) {
		throw new Error("useSessionContext must be used within SessionProvider");
	}
	return ctx;
}
