import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRouter } from "./auth/routes";
import { projectRouter } from "./routes/projects";
import { realtimeRouter } from "./routes/realtime";
import { cleanupRouter } from "./routes/cleanup";
import { yjsRouter, YDurableObjects } from "./routes/yjs";
import type { AppBindings, AppVariables } from "./types/hono";

const allowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://xyflow.com",
	"https://app.xyflow.com",
	"https://snilan.workers.dev",
];
const wildcardOrigins = [/^https:\/\/.+\.vercel\.app$/];

const corsOrigin = (origin?: string | null) => {
	if (!origin) {
		return null;
	}
	if (allowedOrigins.includes(origin)) {
		return origin;
	}
	if (wildcardOrigins.some((pattern) => pattern.test(origin))) {
		return origin;
	}
	return null;
};

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>()
	.use(
		"/*",
		cors({
			origin: corsOrigin,
			allowHeaders: ["Content-Type", "Authorization"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			credentials: true,
			maxAge: 600,
		}),
	)
	.get("/message", (c) => c.text("Hello Hono!"))
	.route("/", authRouter)
	.route("/api", projectRouter)
	.route("/api", realtimeRouter)
	.route("/api", cleanupRouter)
	.route("/api", yjsRouter);

export type AppType = typeof app;

export default app;
export { YDurableObjects };
