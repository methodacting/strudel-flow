import type React from "react";
import { SessionContext } from "./session-context";
import type { Session } from "@/lib/auth";

export function SessionProvider({
	sessionReady,
	session,
	isAuthenticated,
	children,
}: {
	sessionReady: boolean;
	session: Session | null;
	isAuthenticated: boolean;
	children: React.ReactNode;
}) {
	return (
		<SessionContext.Provider value={{ sessionReady, session, isAuthenticated }}>
			{children}
		</SessionContext.Provider>
	);
}
