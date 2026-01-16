import { useEffect } from "react";
import { useYjsSync } from "@/hooks/use-yjs-sync";
import { useAppStore } from "@/store/app-context";
import Workflow from "./workflow";

type WorkflowEditorProps = {
	projectId: string;
	accessRole?: "owner" | "editor" | "viewer";
};

export default function WorkflowEditor({
	projectId,
	accessRole,
}: WorkflowEditorProps) {
	const isReadOnly = accessRole === "viewer";
	const setIsReadOnly = useAppStore((state) => state.setIsReadOnly);

	useEffect(() => {
		setIsReadOnly(isReadOnly);
		return () => {
			setIsReadOnly(false);
		};
	}, [isReadOnly, setIsReadOnly]);

	useYjsSync({ projectId, isReadOnly });

	return (
		<div className="w-full h-full">
			<Workflow projectId={projectId} isReadOnly={isReadOnly} />
		</div>
	);
}
