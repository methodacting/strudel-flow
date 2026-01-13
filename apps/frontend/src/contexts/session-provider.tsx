import type React from "react";
import { SessionContext } from "./session-context";

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
