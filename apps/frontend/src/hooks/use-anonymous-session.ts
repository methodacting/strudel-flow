import { useEffect, useState } from "react";
import { getSession, signInAnonymous } from "@/lib/auth";
import type { Session } from "@/lib/auth";

type SessionResult = Session | null | { data: Session | null };

const getSessionData = (result: SessionResult): Session | null => {
	if (!result) return null;
	if ("data" in result) {
		return result.data ?? null;
	}
	return result;
};

export function useAnonymousSession() {
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const initAnonymous = async () => {
			try {
				console.debug("[anon] init start");
				const sessionResult = (await getSession()) as SessionResult;
				console.debug("[anon] getSession result:", sessionResult);
				const session = getSessionData(sessionResult);
				console.debug("[anon] normalized session:", session);
				if (!session) {
					console.debug("[anon] no session, signing in anonymously");
					await signInAnonymous();
					console.debug("[anon] signInAnonymous finished");
				}
			} catch (error) {
				console.error("Failed to initialize session:", error);
			}
			setInitialized(true);
			console.debug("[anon] init done");
		};

		initAnonymous();
	}, []);

	return { initialized };
}
