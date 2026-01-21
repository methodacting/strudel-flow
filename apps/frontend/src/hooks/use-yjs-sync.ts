import { useEffect, useRef, useCallback, useState } from "react";
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
	isReadOnly?: boolean;
}

export interface UseYjsSyncResult {
	isConnected: boolean;
	updateCursor: (x: number, y: number) => void;
	updateSelection: (nodeId: string) => void;
	clearSelection: () => void;
	getRemoteUsers: () => AwarenessState[];
	remoteUsers: AwarenessState[];
}

export function useYjsSync(options: UseYjsSyncOptions) {
	const { projectId, token, userId, userName, isReadOnly } = options;

	const clientRef = useRef<YjsClient | null>(null);
	const awarenessManagerRef = useRef<ReturnType<typeof createAwarenessManager> | null>(null);
	const syncToYjsRef = useRef(false);
	const [remoteUsers, setRemoteUsers] = useState<AwarenessState[]>([]);
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
					console.debug("Awareness changed:", states);
				},
				onConnect: () => {
					console.debug("Yjs client connected");
				},
				onDisconnect: () => {
					console.debug("Yjs client disconnected");
				},
			});

			clientRef.current = client;

			// Set up awareness manager
			if (client.ydoc) {
				awarenessManagerRef.current = createAwarenessManager(client);

				const unsubscribe = awarenessManagerRef.current?.onRemoteUsersChange(
					(users: Array<AwarenessState>) => {
						console.debug("Remote users changed:", users);
						setRemoteUsers(users);
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
		if (isReadOnly) return;
		if (syncToYjsRef.current) {
			syncToYjsRef.current = false;
			return;
		}

		clientRef.current.setState(nodes, edges);
	}, [edges, isReadOnly, nodes]);

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
		remoteUsers,
	};
}
