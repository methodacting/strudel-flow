import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import ProjectList from "./components/project-list";
import CreateProjectDialog from "./components/create-project-dialog";
import UserMenu from "./components/user-menu";
import WorkflowEditor from "./components/editor";
import SidebarLayout from "./components/layouts/sidebar-layout";
import { ProjectSwitcher } from "./components/project-switcher";
import type { Project } from "./types/project";
import { ShareUrlPopover } from "./components/share-url-popover";
import { useSessionContext } from "./contexts/session-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ArrowLeft } from "lucide-react";
import { useYjsSync } from "@/hooks/use-yjs-sync";

export function ProjectManager({ sessionReady }: { sessionReady: boolean }) {
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const navigate = useNavigate();
	const { isAuthenticated } = useSessionContext();

	const handleCreateProject = () => {
		setCreateDialogOpen(true);
	};

	const handleSelectProject = (project: Project) => {
		navigate({
			to: "/project/$projectId",
			params: { projectId: project.id },
		});
	};

	return (
		<div className="min-h-screen bg-background">
			<header className="border-b px-6 py-4 flex items-center justify-between">
				<h1 className="text-2xl font-bold">Strudel Flow</h1>
				<UserMenu sessionReady={sessionReady} />
			</header>

			<main className="container mx-auto py-8">
				<ProjectList
					onCreate={handleCreateProject}
					onSelect={handleSelectProject}
					sessionReady={sessionReady}
					isAuthenticated={isAuthenticated}
				/>
			</main>

			<CreateProjectDialog
				open={createDialogOpen}
				onOpenChange={setCreateDialogOpen}
			/>
		</div>
	);
}

export function ProjectEditor({
	projectId,
	projectName,
	accessRole,
	sessionReady,
}: {
	projectId: string;
	projectName: string;
	accessRole?: "owner" | "editor" | "viewer";
	sessionReady: boolean;
}) {
	const [, setSelectedProject] = useState<Project | null>(null);
	const navigate = useNavigate();
	const { session, isAuthenticated } = useSessionContext();
	const isReadOnly = accessRole === "viewer";
	const yjsSync = useYjsSync({
		projectId,
		isReadOnly,
		isAuthenticated,
		userId: session?.user?.id,
		userName: session?.user?.name,
	});

	return (
		<SidebarLayout>
			<div className="flex h-full flex-col">
				<header className="border-b px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<SidebarTrigger className="h-9 w-9 rounded-full border border-border/70 bg-background/70 shadow-sm" />
						<ProjectSwitcher
							projectId={projectId}
							projectName={projectName}
							sessionReady={sessionReady}
						/>
						{yjsSync?.isSyncing ? (
							<span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
								<span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
								Syncing
							</span>
						) : null}
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={() => {
								navigate({ to: "/" });
								setSelectedProject(null);
							}}
							className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 text-sm font-medium text-muted-foreground shadow-sm transition hover:text-foreground"
						>
							<ArrowLeft className="h-4 w-4" />
							Back to projects
						</button>
						{isAuthenticated && accessRole === "owner" && (
							<ShareUrlPopover projectId={projectId} isAuthenticated={isAuthenticated} />
						)}
						<UserMenu sessionReady={sessionReady} />
					</div>
				</header>

				<div className="flex-1 min-h-0">
					<WorkflowEditor
						projectId={projectId}
						accessRole={accessRole}
						awareness={yjsSync}
						isAuthenticated={isAuthenticated}
					/>
				</div>
			</div>
		</SidebarLayout>
	);
}
