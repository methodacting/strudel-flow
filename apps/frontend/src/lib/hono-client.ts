import { hc } from "hono/client";
import type { AppType } from "../../../backend/src";

export const API_BASE_URL =
	import.meta.env.VITE_BACKEND_URL ||
	(typeof window !== "undefined" ? window.location.origin : "");

export const honoClient = hc<AppType>(API_BASE_URL, {
	init: {
		credentials: "include",
	},
});
