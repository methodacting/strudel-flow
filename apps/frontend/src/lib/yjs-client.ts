import * as Y from "yjs";
import type { Awareness } from "y-protocols/awareness";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebsocketProvider } from "y-websocket";
import type { AppNode } from "@/components/nodes";
import type { Edge } from "@xyflow/react";

export interface YjsClientConfig {
	projectId: string;
	token?: string;
	userId?: string;
	userName?: string;
	websocketUrl?: string;
	docName?: string;
	onUpdate?: (nodes: AppNode[], edges: Edge[]) => void;
	onAwarenessChange?: (states: Map<number, unknown>) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
}

export interface YjsClient {
	ydoc: Y.Doc;
	nodes: Y.Array<unknown>;
	edges: Y.Array<unknown>;
	settings: Y.Map<unknown>;
	awareness: Awareness | null;
	connect: () => void;
	disconnect: () => void;
	isConnected: () => boolean;
	getState: () => { nodes: AppNode[]; edges: Edge[] };
	setState: (nodes: AppNode[], edges: Edge[]) => void;
}

export function createYjsClient(
	config: YjsClientConfig
): YjsClient {
	const ydoc = new Y.Doc();

	// Get Yjs data structures
	const nodes = ydoc.getArray("nodes");
	const edges = ydoc.getArray("edges");
	const settings = ydoc.getMap("settings");
	// Set up local storage fallback
	let indexedDBProvider: IndexeddbPersistence | null = null;

	if (typeof window !== "undefined") {
		const docName = config.docName ?? config.projectId;
		indexedDBProvider = new IndexeddbPersistence(
			docName,
			ydoc
		);

		indexedDBProvider.on("synced", () => {
			console.debug("Yjs state synced to IndexedDB");
		});
	}

	const websocketUrl =
		config.websocketUrl ??
		(import.meta.env.VITE_YJS_WS_URL as string | undefined);
	if (!websocketUrl) {
		throw new Error("Missing websocketUrl for Yjs WebsocketProvider");
	}
	const wsProvider = new WebsocketProvider(websocketUrl, config.projectId, ydoc);
	const awareness = wsProvider.awareness;
	if (config.userId) {
		awareness.setLocalStateField("userId", config.userId);
	}
	if (config.userName) {
		awareness.setLocalStateField("userName", config.userName);
	}
	wsProvider.on("status", ({ status }: { status: string }) => {
		if (status === "connected") {
			config.onConnect?.();
		} else if (status === "disconnected") {
			config.onDisconnect?.();
		}
	});
	wsProvider.awareness.on("change", () => {
		const states = wsProvider.awareness.getStates();
		config.onAwarenessChange?.(states);
	});

	// Set up update handlers
	nodes.observe(() => {
		const newNodes = nodes.toArray() as AppNode[];
		config.onUpdate?.(newNodes, edges.toArray() as Edge[]);
	});

	edges.observe(() => {
		const newEdges = edges.toArray() as Edge[];
		config.onUpdate?.(nodes.toArray() as AppNode[], newEdges);
	});

	// Initial state from IndexedDB if no WebSocket connection
	if (nodes.length === 0 && edges.length === 0) {
		setTimeout(() => {
				if (!wsProvider.wsconnected && nodes.length === 0) {
				console.debug("No data from IndexedDB, starting fresh");
			}
		}, 500);
	}

	return {
		ydoc,
		nodes,
		edges,
		settings,
		awareness,
		connect: () => wsProvider.connect(),
		disconnect: () => wsProvider.disconnect(),
		isConnected: () => wsProvider.wsconnected,
		getState: () => ({
			nodes: nodes.toArray() as AppNode[],
			edges: edges.toArray() as Edge[],
		}),
		setState: (newNodes: AppNode[], newEdges: Edge[]) => {
			ydoc.transact(() => {
				nodes.delete(0, nodes.length);
				nodes.push(newNodes);
				edges.delete(0, edges.length);
				edges.push(newEdges);
			});
		},
	};
}
