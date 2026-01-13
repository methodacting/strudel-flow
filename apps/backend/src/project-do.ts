import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import type { AppBindings } from "./types/hono";

interface ClientState {
	userId?: string;
	userName?: string;
	clientId: string;
}

interface ClientAttachment {
	clientId: string;
	userId?: string;
	userName?: string;
}

export class ProjectDurableObject extends DurableObject {
	private doc: Y.Doc;
	private clients: Map<WebSocket, ClientState>;
	private static readonly SNAPSHOT_INTERVAL_MS = 60_000;

	constructor(ctx: DurableObjectState, env: AppBindings) {
		super(ctx, env);
		this.doc = new Y.Doc();
		this.clients = new Map();

		this.ctx.blockConcurrencyWhile(async () => {
			const stored = await this.ctx.storage.get<Uint8Array>("doc");
			if (stored) {
				Y.applyUpdate(this.doc, stored);
			}

			const existingAlarm = await this.ctx.storage.getAlarm();
			if (existingAlarm == null) {
				await this.ctx.storage.setAlarm(
					Date.now() + ProjectDurableObject.SNAPSHOT_INTERVAL_MS,
				);
			}
		});

		for (const ws of this.ctx.getWebSockets()) {
			const attachment = ws.deserializeAttachment() as ClientAttachment | null;
			if (attachment) {
				this.clients.set(ws, {
					clientId: attachment.clientId,
					userId: attachment.userId,
					userName: attachment.userName,
				});
			}
		}
	}

	async fetch(request: Request) {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/ws")) {
			return this.handleWebSocket(request);
		}

		if (url.pathname.endsWith("/state")) {
			return this.getState();
		}

		if (url.pathname.endsWith("/delete")) {
			const projectId = url.searchParams.get("id");
			if (projectId) {
				await this.deleteProject(projectId);
				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Project ID required", { status: 400 });
		}

		return new Response("Not found", { status: 404 });
	}

	private handleWebSocket(request: Request): Response {
		const url = new URL(request.url);
		const clientId = url.searchParams.get("clientId");
		const userId = url.searchParams.get("userId") || undefined;
		const userName = url.searchParams.get("userName") || undefined;

		if (!clientId) {
			return new Response("Missing clientId", { status: 400 });
		}

		const { 0: client, 1: server } = Object.values(new WebSocketPair());

		this.ctx.acceptWebSocket(server);

		const attachment: ClientAttachment = {
			clientId,
			userId,
			userName,
		};
		server.serializeAttachment(attachment);

		this.clients.set(server, { clientId, userId, userName });

		server.send(new Uint8Array(Y.encodeStateAsUpdate(this.doc)));

		return new Response(null, { status: 101, webSocket: client });
	}

	private broadcast(update: Uint8Array, exclude?: WebSocket) {
		for (const ws of this.ctx.getWebSockets()) {
			if (exclude && ws === exclude) {
				continue;
			}
			if (ws.readyState !== WebSocket.OPEN) {
				continue;
			}
			try {
				ws.send(update);
			} catch (error) {
				console.error("Error broadcasting to client:", error);
				this.clients.delete(ws);
			}
		}
	}

	async deleteProject(projectId: string) {
		this.doc.transact(() => {
			this.doc.getMap("nodes").delete(projectId);
			this.doc.getMap("edges").delete(projectId);
			this.doc.getMap("metadata").delete(projectId);
		});

		const update = Y.encodeStateAsUpdate(this.doc);
		this.broadcast(update);

		await this.ctx.storage.put("doc", update);
	}

	private getState(): Response {
		const state = Y.encodeStateAsUpdate(this.doc);
		return new Response(state, {
			headers: {
				"Content-Type": "application/octet-stream",
			},
		});
	}

	async alarm() {
		const state = Y.encodeStateAsUpdate(this.doc);
		await this.ctx.storage.put("doc", state);
		await this.ctx.storage.setAlarm(
			Date.now() + ProjectDurableObject.SNAPSHOT_INTERVAL_MS,
		);
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		try {
			if (typeof message === "string") {
				console.warn("Ignoring unexpected string message");
				return;
			}
			const update = new Uint8Array(message);
			Y.applyUpdate(this.doc, update);
			this.broadcast(update, ws);
		} catch (error) {
			console.error("Error processing message:", error);
		}
	}

	async webSocketClose(ws: WebSocket) {
		this.clients.delete(ws);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("WebSocket error:", error);
		this.clients.delete(ws);
	}
}
