import type { Awareness } from "y-protocols/awareness";
import type { YjsClient } from "./yjs-client";

export interface AwarenessState {
	clientId: number;
	userId?: string;
	userName?: string;
	cursor?: {
		x: number;
		y: number;
	};
	selection?: {
		nodeId: string;
	};
}

export class AwarenessManager {
	private awareness: Awareness;
	private localClientId: number;

	constructor(awareness: Awareness) {
		this.awareness = awareness;
		this.localClientId = awareness.clientID;
	}

	setCursor(x: number, y: number): void {
		this.awareness.setLocalStateField("cursor", { x, y });
	}

	setSelection(nodeId: string): void {
		this.awareness.setLocalStateField("selection", { nodeId });
	}

	clearSelection(): void {
		this.awareness.setLocalStateField("selection", null);
	}

	getRemoteUsers(): Array<AwarenessState> {
		const users: Array<AwarenessState> = [];

		type RawState = {
			userId?: string;
			userName?: string;
			cursor?: {
				x: number;
				y: number;
			};
			selection?: {
				nodeId: string;
			};
		};

		this.awareness
			.getStates()
			.forEach((state: RawState | null, clientId: number) => {
				if (!state || clientId === this.localClientId) {
					return;
				}

				users.push({
					clientId,
					userId: state.userId,
					userName: state.userName,
					cursor: state.cursor,
					selection: state.selection,
				});
			});

		return users;
	}

	onRemoteUsersChange(
		callback: (users: Array<AwarenessState>) => void
	): () => void {
		const handler = () => {
			callback(this.getRemoteUsers());
		};

		this.awareness.on("change", handler);

		return () => {
			this.awareness.off("change", handler);
		};
	}

	dispose(): void {
		this.awareness.setLocalState(null);
	}
}

export function createAwarenessManager(
	yjsClient: YjsClient | null
): AwarenessManager | null {
	if (!yjsClient?.awareness) {
		return null;
	}

	return new AwarenessManager(yjsClient.awareness);
}
