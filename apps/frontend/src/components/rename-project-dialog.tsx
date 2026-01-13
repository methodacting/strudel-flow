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
import { Edit2 } from "lucide-react";

export interface RenameProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectName: string;
	onRename: (newName: string) => Promise<void>;
}

export default function RenameProjectDialog({
	open,
	onOpenChange,
	projectName,
	onRename,
}: RenameProjectDialogProps) {
	const [name, setName] = useState(projectName);
	const [renaming, setRenaming] = useState(false);
	const [error, setError] = useState("");

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

		if (name.trim() === projectName) {
			onOpenChange(false);
			return;
		}

		setRenaming(true);
		try {
			await onRename(name.trim());
			setName("");
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to rename project");
		} finally {
			setRenaming(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Edit2 className="w-5 h-5 text-primary" />
							Rename Project
						</DialogTitle>
						<DialogDescription>
							Enter a new name for your project
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
								disabled={renaming}
								maxLength={100}
							/>
							<div className="flex items-center justify-between text-sm">
								{error && (
									<p className="text-destructive">{error}</p>
								)}
								{!error && (
									<p className="text-muted-foreground">
										{name.length}/100 characters
									</p>
								)}
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => {
								onOpenChange(false);
								setName(projectName);
							}}
							disabled={renaming}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={renaming || !name.trim()}
						>
							{renaming ? "Renaming..." : "Rename"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
