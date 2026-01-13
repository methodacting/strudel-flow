import type * as schema from "@strudel-flow/db/schema";
import type { getAuth } from "../auth/auth";
import type { CloudflareBindings } from "../worker-configuration.d";

export type AppBindings = CloudflareBindings;
export type AuthSession = Awaited<
	ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>
>;
export type AuthUser = NonNullable<AuthSession>["user"] & schema.User;

export type AppVariables = {
	session: NonNullable<AuthSession>;
	user: AuthUser;
};
