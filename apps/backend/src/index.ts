import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRouter } from "./auth/routes";
import { projectRouter } from "./routes/projects";
import { realtimeRouter } from "./routes/realtime";
import { cleanupRouter } from "./routes/cleanup";
import { yjsRouter, YDurableObjectsV2 } from "./routes/yjs";
import { audioRouter } from "./routes/audio";
import { publicProjectRouter } from "./routes/public-projects";
import type { AppBindings, AppVariables } from "./types/hono";

const allowedOrigins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"https://xyflow.com",
	"https://app.xyflow.com",
	"https://strudel.method.actor",
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
	.get("/api/version", (c) =>
		c.json({
			commit: "local-dev",
			timestamp: new Date().toISOString(),
		}),
	)
	.route("/", authRouter)
	.route("/api", publicProjectRouter)
	.route("/api", projectRouter)
	.route("/api", realtimeRouter)
	.route("/api", cleanupRouter)
	.route("/api", yjsRouter)
	.route("/api", audioRouter)
	.onError((err, c) => {
		console.error("[error-handler] Unhandled error:", err);
		return c.json({ error: "Internal server error" }, 500);
	});

export type AppType = typeof app;

export default app;
export { YDurableObjectsV2 };
