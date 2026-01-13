import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ArrowUpDown, Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import ProjectCard from "./project-card";
import ProjectCardSkeleton from "./project-card-skeleton";
import RenameProjectDialog from "./rename-project-dialog";
import DeleteProjectDialog from "./delete-project-dialog";
import { apiClient } from "@/lib/api-client";
import type { Project } from "@/types/project";

type SortOption = "name-asc" | "name-desc" | "newest" | "oldest" | "updated";

const SORT_OPTIONS = [
	{ value: "name-asc", label: "Name (A-Z)" },
	{ value: "name-desc", label: "Name (Z-A)" },
	{ value: "newest", label: "Newest First" },
	{ value: "oldest", label: "Oldest First" },
	{ value: "updated", label: "Recently Updated" },
];

const ITEMS_PER_PAGE = 9;

export interface ProjectListProps {
	onCreate: () => void;
	onSelect: (project: Project) => void;
	sessionReady: boolean;
}

export default function ProjectList({
	onCreate,
	onSelect,
	sessionReady,
}: ProjectListProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortOption>("updated");
	const [currentPage, setCurrentPage] = useState(1);

	const [renameDialogOpen, setRenameDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const queryClient = useQueryClient();

	// Load projects with TanStack Query
	const { data: projects, isLoading, isFetching, error } = useQuery({
		queryKey: ["projects"],
		queryFn: () => apiClient.getProjects(),
		enabled: sessionReady,
	});

	const isInitialLoading = isLoading || (!projects && isFetching);

	// Update project mutation
	const updateProject = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			apiClient.updateProject(id, { name }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	// Delete project mutation
	const deleteProject = useMutation({
		mutationFn: (id: string) => apiClient.deleteProject(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	// Create project mutation
	const createProject = useMutation({
		mutationFn: (name: string) => apiClient.createProject(name),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	const projectsList = projects || [];

	const filteredAndSortedProjects = (() => {
		let filtered = [...projectsList];

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter((p) => p.name.toLowerCase().includes(query));
		}

		filtered.sort((a, b) => {
			switch (sortBy) {
				case "name-asc":
					return a.name.localeCompare(b.name);
				case "name-desc":
					return b.name.localeCompare(a.name);
				case "newest":
					return (
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
					);
				case "oldest":
					return (
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				case "updated":
				default:
					return (
						new Date(b.updatedAt).getTime() - new Date(b.updatedAt).getTime()
					);
			}
		});

		return filtered;
	})();

	const totalPages = Math.ceil(filteredAndSortedProjects.length / ITEMS_PER_PAGE);
	const paginatedProjects = filteredAndSortedProjects.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE,
	);

	const handleRename = async (newName: string) => {
		if (!selectedProject) return;
		await updateProject.mutateAsync({
			id: selectedProject.id,
			name: newName,
		});
	};

	const handleDelete = async () => {
		if (!selectedProject) return;
		await deleteProject.mutateAsync(selectedProject.id);
	};

	const handleDuplicate = async () => {
		if (!selectedProject) return;
		await createProject.mutateAsync(`${selectedProject.name} (Copy)`);
	};

	const openRenameDialog = (project: Project) => {
		setSelectedProject(project);
		setRenameDialogOpen(true);
	};

	const openDeleteDialog = (project: Project) => {
		setSelectedProject(project);
		setDeleteDialogOpen(true);
	};

	if (error) {
		return (
			<div className="border rounded-lg p-8">
				<div className="text-center space-y-3">
					<FolderOpen className="w-12 h-12 mx-auto text-muted-foreground" />
					<div>
						<p className="text-foreground font-medium">
							Failed to load projects
						</p>
						<p className="text-sm text-muted-foreground">
							Please try again later
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<FolderOpen className="w-5 h-5 text-primary" />
					<h2 className="text-2xl font-bold">My Projects</h2>
				</div>
				<Button onClick={onCreate}>
					<Plus className="w-4 h-4 mr-2" />
					Create Project
				</Button>
			</div>

			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
					<Input
						placeholder="Search projects..."
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setCurrentPage(1);
						}}
						className="pl-10"
					/>
				</div>
				<div className="flex items-center gap-2">
					<ArrowUpDown className="w-4 h-4 text-muted-foreground" />
					<Select
						value={sortBy}
						onValueChange={(v: SortOption) => setSortBy(v)}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{isInitialLoading ? (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<ProjectCardSkeleton key={i} />
					))}
				</div>
			) : filteredAndSortedProjects.length === 0 ? (
				<div className="border-2 border-dashed border-border rounded-lg p-12">
					<div className="text-center space-y-3">
						<FolderOpen className="w-12 h-12 mx-auto text-muted-foreground" />
						<div>
							<p className="text-foreground font-medium">
								{searchQuery ? "No projects found" : "No projects yet"}
							</p>
							<p className="text-sm text-muted-foreground">
								{searchQuery
									? "Try a different search term"
									: "Create your first project to get started!"}
							</p>
						</div>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{paginatedProjects.map((project) => (
							<ProjectCard
								key={project.id}
								project={project}
								onSelect={() => onSelect(project)}
								onRename={() => openRenameDialog(project)}
								onDelete={() => openDeleteDialog(project)}
								onDuplicate={handleDuplicate}
							/>
						))}
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
								disabled={currentPage === 1}
							>
								Previous
							</Button>
							<div className="flex items-center gap-1">
								{Array.from({ length: totalPages }, (_, i) => i + 1).map(
									(page) => (
										<Button
											key={page}
											variant={currentPage === page ? "default" : "outline"}
											size="sm"
											onClick={() => setCurrentPage(page)}
											className="w-9 h-9"
										>
											{page}
										</Button>
									),
								)}
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setCurrentPage((p) => Math.min(totalPages, p + 1))
								}
								disabled={currentPage === totalPages}
							>
								Next
							</Button>
						</div>
					)}
				</div>
			)}

			{selectedProject && (
				<>
					<RenameProjectDialog
						open={renameDialogOpen}
						onOpenChange={setRenameDialogOpen}
						projectName={selectedProject.name}
						onRename={handleRename}
					/>
					<DeleteProjectDialog
						open={deleteDialogOpen}
						onOpenChange={setDeleteDialogOpen}
						projectName={selectedProject.name}
						onDelete={handleDelete}
					/>
				</>
			)}
		</div>
	);
}
