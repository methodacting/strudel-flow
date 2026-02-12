import { useEffect } from "react";
import { useYjsSync } from "@/hooks/use-yjs-sync";
import { useAppStore } from "@/store/app-context";
import { useSessionContext } from "@/contexts/session-context";
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
	const { session, isAuthenticated } = useSessionContext();

	useEffect(() => {
		setIsReadOnly(isReadOnly);
		return () => {
			setIsReadOnly(false);
		};
	}, [isReadOnly, setIsReadOnly]);

	const yjsSync = useYjsSync({
		projectId,
		isReadOnly,
		isAuthenticated,
		userId: session?.user?.id,
		userName: session?.user?.name,
	});

	return (
		<div className="w-full h-full">
		<Workflow
			projectId={projectId}
			isReadOnly={isReadOnly}
			awareness={yjsSync}
			isAuthenticated={isAuthenticated}
		/>
	</div>
	);
}
