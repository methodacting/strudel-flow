import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { indexedDB } from "@/lib/indexeddb";
import type { Session } from "@/lib/auth";
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

export function AccountSync({ sessionReady }: { sessionReady: boolean }) {
	const { data: sessionData } = useQuery<Session | null>({
		queryKey: ["session"],
		queryFn: () => apiClient.getSession(),
		enabled: sessionReady,
	});

	const session = sessionData?.user;

	const [syncDialogOpen, setSyncDialogOpen] = useState(false);
	const [anonymousProjects, setAnonymousProjects] = useState<StoredProject[]>([]);
	const [syncing, setSyncing] = useState(false);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!session) {
			setAnonymousProjects([]);
			setSyncDialogOpen(false);
			return;
		}

		const checkForAnonymousProjects = async () => {
			const wasAnonymous = localStorage.getItem("wasAnonymous");
			const storedProjects = await indexedDB.projects.getAnonymousProjects();

			setAnonymousProjects(storedProjects);

			if (wasAnonymous === "true" && storedProjects.length > 0) {
				setSyncDialogOpen(true);
				localStorage.removeItem("wasAnonymous");
			}
		};

		checkForAnonymousProjects();
	}, [session]);

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
			setSyncDialogOpen(false);
			setAnonymousProjects([]);
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
		setSyncDialogOpen(false);
		setAnonymousProjects([]);
	};

	if (anonymousProjects.length === 0) {
		return null;
	}

	return (
		<Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
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
