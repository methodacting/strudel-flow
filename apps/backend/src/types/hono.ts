import type * as schema from "@strudel-flow/db/schema";
import type { getAuth } from "../auth/auth";
import type { CloudflareBindings } from "./bindings";

export type AppBindings = CloudflareBindings;

// Better Auth adds plugin properties to Session and User
// These need to be manually declared since plugins use declaration merging
type BaseSession = Awaited<
	ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>
>;

type BaseSessionUser = NonNullable<BaseSession>["user"];

type SessionWithPlugins = {
	session?: {
		activeOrganizationId?: string | null;
	};
	user: BaseSessionUser & {
		isAnonymous?: boolean | null;
	};
};

export type AuthSession = (BaseSession & SessionWithPlugins) | null;

export type AuthUser = NonNullable<BaseSession>["user"] &
	schema.User & {
		isAnonymous?: boolean | null;
	};

export type AppVariables = {
	session: NonNullable<AuthSession>;
	user: AuthUser;
};
