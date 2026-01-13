import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import ProjectList from "./components/project-list";
import CreateProjectDialog from "./components/create-project-dialog";
import UserMenu from "./components/user-menu";
import WorkflowEditor from "./components/editor";
import SidebarLayout from "./components/layouts/sidebar-layout";
import type { Project } from "./types/project";
import { apiClient } from "./lib/api-client";
import { Button } from "./components/ui/button";
import { Link2 } from "lucide-react";

export function ProjectManager({ sessionReady }: { sessionReady: boolean }) {
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const navigate = useNavigate();

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
	sessionReady,
}: {
	projectId: string;
	projectName: string;
	sessionReady: boolean;
}) {
	const [, setSelectedProject] = useState<Project | null>(null);
	const navigate = useNavigate();
	const [inviteStatus, setInviteStatus] = useState<string | null>(null);
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteVisible, setInviteVisible] = useState(false);
	const inviteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (inviteTimeoutRef.current) {
				clearTimeout(inviteTimeoutRef.current);
			}
		};
	}, []);

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
					<Button
						size="sm"
						variant="secondary"
						className="min-w-[120px] justify-center"
						disabled={!sessionReady || inviteLoading}
						onClick={async () => {
							setInviteStatus(null);
							setInviteLoading(true);
							if (inviteTimeoutRef.current) {
								clearTimeout(inviteTimeoutRef.current);
							}
							try {
								const { inviteUrl } = await apiClient.createInvite(projectId);
								await navigator.clipboard.writeText(inviteUrl);
								setInviteStatus("Invite link copied");
								setInviteVisible(true);
								inviteTimeoutRef.current = setTimeout(() => {
									setInviteVisible(false);
								}, 2500);
							} catch (error) {
								setInviteStatus(
									error instanceof Error ? error.message : "Invite failed",
								);
								setInviteVisible(true);
								inviteTimeoutRef.current = setTimeout(() => {
									setInviteVisible(false);
								}, 2500);
							} finally {
								setInviteLoading(false);
							}
						}}
					>
						<Link2
							className={`mr-2 h-4 w-4 transition-opacity ${
								inviteLoading
									? "animate-[pulse_1.2s_ease-in-out_infinite] opacity-80"
									: ""
							}`}
						/>
						Invite
					</Button>
					<UserMenu sessionReady={sessionReady} />
				</div>
				{inviteStatus && inviteVisible && (
					<div className="fixed right-6 top-20 z-50 rounded-md border bg-background px-3 py-2 text-xs text-foreground shadow">
						{inviteStatus}
					</div>
				)}
				</header>

				<div className="flex-1 min-h-0">
					<WorkflowEditor projectId={projectId} />
				</div>
			</div>
		</SidebarLayout>
	);
}
