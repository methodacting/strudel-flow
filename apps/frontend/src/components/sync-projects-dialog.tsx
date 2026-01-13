import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { indexedDB } from "@/lib/indexeddb";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CloudDownload, CloudUpload } from "lucide-react";
import type { StoredProject } from "@/lib/indexeddb";

export function SyncProjectsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [anonymousProjects, setAnonymousProjects] = useState<StoredProject[]>([]);
	const [syncing, setSyncing] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		const loadAnonymousProjects = async () => {
			const projects = await indexedDB.projects.getAnonymousProjects();
			setAnonymousProjects(projects);
		};
		if (open) {
			loadAnonymousProjects();
		}
	}, [open]);

	const syncProjects = useMutation({
		mutationFn: async (projects: StoredProject[]) => {
			// Create projects one by one
			for (const project of projects) {
				await apiClient.createProject(project.name);
			}
		},
		onMutate: () => setSyncing(true),
		onSuccess: async () => {
			await indexedDB.projects.clear();
			queryClient.invalidateQueries({
				queryKey: ["projects"],
			});
			setSyncing(false);
			onOpenChange(false);
		},
		onError: (error) => {
			console.error("Failed to sync projects:", error);
			setSyncing(false);
		},
	});

	const handleSync = () => {
		syncProjects.mutate(anonymousProjects);
	};

	const handleSkip = async () => {
		await indexedDB.projects.clear();
		onOpenChange(false);
	};

	if (anonymousProjects.length === 0) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CloudUpload className="w-5 h-5 text-primary" />
						Sync Your Projects
					</DialogTitle>
					<DialogDescription>
						You have {anonymousProjects.length} anonymous project
						{anonymousProjects.length !== 1 ? "s" : ""}. Would you like to
						sync them to your account?
					</DialogDescription>
				</DialogHeader>

				<div className="max-h-64 overflow-y-auto">
					{anonymousProjects.map((project) => (
						<div
							key={project.id}
							className="flex items-center gap-3 p-3 border-b"
						>
							<CloudDownload className="w-4 h-4 text-muted-foreground" />
							<div className="flex-1 min-w-0">
								<p className="font-medium truncate">{project.name}</p>
								<p className="text-sm text-muted-foreground">
									Created {new Date(project.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
					))}
				</div>

				<DialogFooter className="flex-col sm:flex-row gap-2">
					<Button variant="outline" onClick={handleSkip} disabled={syncing}>
						Skip (Lose Projects)
					</Button>
					<Button onClick={handleSync} disabled={syncing}>
						{syncing ? "Syncing..." : "Sync All Projects"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
