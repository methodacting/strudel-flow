import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import ProjectList from "./components/project-list";
import CreateProjectDialog from "./components/create-project-dialog";
import UserMenu from "./components/user-menu";
import WorkflowEditor from "./components/editor";
import SidebarLayout from "./components/layouts/sidebar-layout";
import type { Project } from "./types/project";
import { ShareUrlPopover } from "./components/share-url-popover";
import { useSessionContext } from "./contexts/session-context";

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
	const { isAuthenticated } = useSessionContext();

	return (
		<SidebarLayout>
			<div className="flex h-full flex-col">
				<header className="border-b px-6 py-4 flex items-center justify-between relative">
				<div className="flex items-center gap-4">
					<h1 className="text-xl font-bold">{projectName}</h1>
					<button
						onClick={() => {
							navigate({ to: "/" });
							setSelectedProject(null);
						}}
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						← Back to projects
					</button>
				</div>
				<div className="flex items-center gap-2">
					{isAuthenticated && accessRole === "owner" && (
						<ShareUrlPopover projectId={projectId} isAuthenticated={isAuthenticated} />
					)}
					<UserMenu sessionReady={sessionReady} />
				</div>
				</header>

				<div className="flex-1 min-h-0">
					<WorkflowEditor projectId={projectId} accessRole={accessRole} />
				</div>
			</div>
		</SidebarLayout>
	);
}
