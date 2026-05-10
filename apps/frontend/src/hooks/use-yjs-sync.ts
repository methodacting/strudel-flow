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
	isAuthenticated?: boolean;
}

export interface UseYjsSyncResult {
	isConnected: boolean;
	isSyncing: boolean;
	updateCursor: (x: number, y: number) => void;
	updateSelection: (nodeId: string) => void;
	clearSelection: () => void;
	getRemoteUsers: () => AwarenessState[];
	remoteUsers: AwarenessState[];
}

export function useYjsSync(options: UseYjsSyncOptions) {
	const { projectId, token, userId, userName, isReadOnly, isAuthenticated } = options;

	const clientRef = useRef<YjsClient | null>(null);
	const awarenessManagerRef = useRef<ReturnType<typeof createAwarenessManager> | null>(null);
	const syncToYjsRef = useRef(false);
	const hasInitialSyncRef = useRef(false);
	const lastProjectIdRef = useRef<string | null>(null);
	const activeProjectIdRef = useRef<string | null>(null);
	const clientProjectIdRef = useRef<string | null>(null);
	const [remoteUsers, setRemoteUsers] = useState<AwarenessState[]>([]);
	const [isSyncing, setIsSyncing] = useState(true);
	const { data: realtimeData } = useRealtimeUrlQuery(
		projectId,
		Boolean(projectId) && Boolean(isAuthenticated),
	);
	const websocketUrl = realtimeData?.wsUrl ?? null;

	const nodes = useAppStore((state) => state.nodes);
	const edges = useAppStore((state) => state.edges);
	const setProjectState = useAppStore((state) => state.setProjectState);
	const setActiveProjectId = useAppStore((state) => state.setActiveProjectId);

	useEffect(() => {
		if (!projectId) {
			setActiveProjectId(null);
			return;
		}
		setActiveProjectId(projectId);
		activeProjectIdRef.current = projectId;
		const isProjectChange =
			lastProjectIdRef.current !== null && lastProjectIdRef.current !== projectId;
		lastProjectIdRef.current = projectId;
		hasInitialSyncRef.current = false;
		setIsSyncing(true);
		if (isProjectChange) {
			setProjectState(projectId, [], []);
			// Prevent pushing previous project's nodes into the new doc.
			syncToYjsRef.current = true;
		}
		return () => {
			activeProjectIdRef.current = null;
			setActiveProjectId(null);
		};
	}, [projectId, setProjectState, setActiveProjectId]);

	// Create Yjs client
	useEffect(() => {
		if (!projectId) return;

		const setupClient = async () => {
			if (isAuthenticated && !websocketUrl) {
				return;
			}
			const clientProjectId = projectId;
			const client = createYjsClient({
				projectId,
				token,
				userId,
				userName,
				websocketUrl: isAuthenticated ? websocketUrl ?? undefined : undefined,
				onIndexeddbSynced: () => {
					if (activeProjectIdRef.current !== clientProjectId) {
						return;
					}
					if (!hasInitialSyncRef.current) {
						hasInitialSyncRef.current = true;
					}
					setIsSyncing(false);
				},
				onUpdate: (newNodes, newEdges) => {
					if (activeProjectIdRef.current !== clientProjectId) {
						return;
					}
					if (!hasInitialSyncRef.current) {
						hasInitialSyncRef.current = true;
					}
					setIsSyncing(false);
					syncToYjsRef.current = true;
					setProjectState(projectId, newNodes, newEdges);
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
			clientProjectIdRef.current = clientProjectId;

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
						clientRef.current = null;
						clientProjectIdRef.current = null;
						awarenessManagerRef.current = null;
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
	}, [projectId, token, userId, userName, websocketUrl, isAuthenticated, setProjectState, setActiveProjectId]);

	// Sync Zustand changes to Yjs
	useEffect(() => {
		if (!clientRef.current) return;
		if (clientProjectIdRef.current !== projectId) return;
		if (!hasInitialSyncRef.current) return;
		if (isAuthenticated && !clientRef.current.isConnected()) return;
		if (isReadOnly) return;
		if (syncToYjsRef.current) {
			syncToYjsRef.current = false;
			return;
		}

		clientRef.current.setState(nodes, edges);
	}, [edges, isAuthenticated, isReadOnly, nodes, projectId]);

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
		isSyncing,
		updateCursor,
		updateSelection,
		clearSelection,
		getRemoteUsers,
		remoteUsers,
	};
}
