import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app-context";
import { createYjsClient, YjsClient } from "@/lib/yjs-client";
import { createAwarenessManager } from "@/lib/awareness";
import type { AwarenessState } from "@/lib/awareness";
import { useRealtimeUrlQuery } from "@/hooks/api/projects";

export interface UseYjsSyncOptions {
	projectId: string;
	token?: string;
	userId?: string;
	userName?: string;
}

export function useYjsSync(options: UseYjsSyncOptions) {
	const { projectId, token, userId, userName } = options;

	const clientRef = useRef<YjsClient | null>(null);
	const awarenessManagerRef = useRef<ReturnType<typeof createAwarenessManager> | null>(null);
	const syncToYjsRef = useRef(false);
	const { data: realtimeData } = useRealtimeUrlQuery(
		projectId,
		Boolean(projectId),
	);
	const websocketUrl = realtimeData?.wsUrl ?? null;

	const nodes = useAppStore((state) => state.nodes);
	const edges = useAppStore((state) => state.edges);
	const setNodes = useAppStore((state) => state.setNodes);
	const setEdges = useAppStore((state) => state.setEdges);

	// Create Yjs client
	useEffect(() => {
		if (!projectId) return;

		const setupClient = async () => {
			if (!websocketUrl) {
				return;
			}

			const client = createYjsClient({
				projectId,
				token,
				userId,
				userName,
				websocketUrl,
				onUpdate: (newNodes, newEdges) => {
					syncToYjsRef.current = true;
					setNodes(newNodes);
					setEdges(newEdges);
				},
				onAwarenessChange: (states) => {
					console.log("Awareness changed:", states);
				},
				onConnect: () => {
					console.log("Yjs client connected");
				},
				onDisconnect: () => {
					console.log("Yjs client disconnected");
				},
			});

			clientRef.current = client;

			// Set up awareness manager
			if (client.ydoc) {
				awarenessManagerRef.current = createAwarenessManager(client);

				const unsubscribe = awarenessManagerRef.current?.onRemoteUsersChange(
					(users: Array<AwarenessState>) => {
						console.log("Remote users changed:", users);
					},
				);

				if (unsubscribe) {
					// Initial connect
					client.connect();

					return () => {
						unsubscribe();
						client.disconnect();
						awarenessManagerRef.current?.dispose();
					};
				}
			}
		};

		let cleanup: (() => void) | undefined;

		void (async () => {
			const result = await setupClient();
			if (typeof result === "function") {
				cleanup = result;
			}
		})();

		return () => {
			cleanup?.();
		};
	}, [projectId, token, userId, userName, websocketUrl, setNodes, setEdges]);

	// Sync Zustand changes to Yjs
	useEffect(() => {
		if (!clientRef.current || !clientRef.current.isConnected()) return;
		if (syncToYjsRef.current) {
			syncToYjsRef.current = false;
			return;
		}

		clientRef.current.setState(nodes, edges);
	}, [nodes, edges]);

	// Expose awareness manager
	const updateCursor = useCallback((x: number, y: number) => {
		awarenessManagerRef.current?.setCursor(x, y);
	}, []);

	const updateSelection = useCallback((nodeId: string) => {
		awarenessManagerRef.current?.setSelection(nodeId);
	}, []);

	const clearSelection = useCallback(() => {
		awarenessManagerRef.current?.clearSelection();
	}, []);

	const getRemoteUsers = useCallback(() => {
		return awarenessManagerRef.current?.getRemoteUsers() || [];
	}, []);

	return {
		isConnected: clientRef.current?.isConnected() || false,
		updateCursor,
		updateSelection,
		clearSelection,
		getRemoteUsers,
	};
}
