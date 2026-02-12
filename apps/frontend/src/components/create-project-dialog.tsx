import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useCreateProjectMutation } from "@/hooks/api/projects";
import { useSessionContext } from "@/contexts/session-context";

export interface CreateProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export default function CreateProjectDialog({
	open,
	onOpenChange,
}: CreateProjectDialogProps) {
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState("");
	const navigate = useNavigate();
	const { session, isAuthenticated } = useSessionContext();

	const createProject = useCreateProjectMutation(
		isAuthenticated,
		session?.user?.id,
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!name.trim()) {
			setError("Project name is required");
			return;
		}

		if (name.length > 100) {
			setError("Project name must be less than 100 characters");
			return;
		}

		setCreating(true);
		try {
			const project = await createProject.mutateAsync({ name: name.trim() });
			setName("");
			setError("");
			setCreating(false);
			onOpenChange(false);
			navigate({
				to: "/project/$projectId",
				params: { projectId: project.id },
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create project");
			setCreating(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Plus className="w-5 h-5 text-primary" />
							Create New Project
						</DialogTitle>
						<DialogDescription>
							Give your project a name to get started
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<label htmlFor="project-name" className="text-sm font-medium">
								Project Name
							</label>
							<Input
								id="project-name"
								placeholder="My Awesome Project"
								value={name}
								onChange={(e) => setName(e.target.value)}
								disabled={creating}
							/>
							{error && <p className="text-sm text-destructive">{error}</p>}
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={creating}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={creating || !name.trim()}>
							{creating ? "Creating..." : "Create Project"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
