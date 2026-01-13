import { useState } from "react";
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
import { AlertTriangle } from "lucide-react";

export interface DeleteProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectName: string;
	onDelete: () => Promise<void>;
}

export default function DeleteProjectDialog({
	open,
	onOpenChange,
	projectName,
	onDelete,
}: DeleteProjectDialogProps) {
	const [confirmText, setConfirmText] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (confirmText.trim() !== projectName) {
			setError("Project name does not match");
			return;
		}

		setDeleting(true);
		try {
			await onDelete();
			setConfirmText("");
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete project");
		} finally {
			setDeleting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-destructive">
							<AlertTriangle className="w-5 h-5" />
							Delete Project
						</DialogTitle>
						<DialogDescription>
							This action cannot be undone. Please type the project name to
							confirm deletion.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-4">
						<div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
							<p className="text-sm">
								You are about to delete <strong>{projectName}</strong>.
							</p>
							<p className="text-sm text-muted-foreground mt-2">
								All data associated with this project will be permanently lost.
							</p>
						</div>

						<div className="space-y-2">
							<label htmlFor="confirm-name" className="text-sm font-medium">
								Type <code className="bg-muted px-1 rounded">{projectName}</code>{" "}
								to confirm
							</label>
							<Input
								id="confirm-name"
								placeholder={projectName}
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								disabled={deleting}
							/>
							{error && (
								<p className="text-sm text-destructive">{error}</p>
							)}
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								onOpenChange(false);
								setConfirmText("");
							}}
							disabled={deleting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={deleting || confirmText !== projectName}
						>
							{deleting ? "Deleting..." : "Delete Project"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
