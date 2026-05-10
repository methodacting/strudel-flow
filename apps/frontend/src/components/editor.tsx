import { useEffect } from "react";
import { useAppStore } from "@/store/app-context";
import type { UseYjsSyncResult } from "@/hooks/use-yjs-sync";
import { useGlobalPlayback } from "@/hooks/use-global-playback";
import Workflow from "./workflow";

type WorkflowEditorProps = {
	projectId: string;
	accessRole?: "owner" | "editor" | "viewer";
	awareness?: UseYjsSyncResult;
	isAuthenticated: boolean;
};

export default function WorkflowEditor({
	projectId,
	accessRole,
	awareness,
	isAuthenticated,
}: WorkflowEditorProps) {
const isReadOnly = accessRole === "viewer";
const setIsReadOnly = useAppStore((state) => state.setIsReadOnly);
const { globalPause } = useGlobalPlayback();

	useEffect(() => {
		setIsReadOnly(isReadOnly);
		return () => {
			setIsReadOnly(false);
		};
	}, [isReadOnly, setIsReadOnly]);

	useEffect(() => {
		return () => {
			globalPause();
		};
	}, [projectId, globalPause]);

	return (
		<div className="w-full h-full">
		<Workflow
			projectId={projectId}
			isReadOnly={isReadOnly}
			awareness={awareness}
			isAuthenticated={isAuthenticated}
		/>
	</div>
	);
}
