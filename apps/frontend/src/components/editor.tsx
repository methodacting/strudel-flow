import { useYjsSync } from "@/hooks/use-yjs-sync";
import Workflow from "./workflow";

type WorkflowEditorProps = {
	projectId: string;
};

export default function WorkflowEditor({ projectId }: WorkflowEditorProps) {

	useYjsSync({ projectId });

	return (
		<div className="w-full h-full">
			<Workflow projectId={projectId} />
		</div>
	);
}
