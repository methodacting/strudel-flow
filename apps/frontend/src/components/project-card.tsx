import { MoreVertical, Copy, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Music } from "lucide-react";

export interface Project {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectCardProps {
	project: Project;
	onSelect: () => void;
	onRename: () => void;
	onDelete: () => void;
	onDuplicate: () => void;
}

function getRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

export default function ProjectCard({
	project,
	onSelect,
	onRename,
	onDelete,
	onDuplicate,
}: ProjectCardProps) {
	return (
		<div
			className="group relative bg-card border border-border rounded-lg p-4 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200"
			onClick={onSelect}
		>
			<div className="flex items-start gap-3">
				<div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
					<Music className="w-6 h-6 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="font-semibold text-foreground truncate pr-8">
						{project.name}
					</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Updated {getRelativeTime(project.updatedAt)}
					</p>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
							onClick={(e) => e.stopPropagation()}
						>
							<MoreVertical className="w-4 h-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
							<Edit2 className="w-4 h-4 mr-2" />
							Rename
						</DropdownMenuItem>
						<DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
							<Copy className="w-4 h-4 mr-2" />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem
							onClick={(e) => { e.stopPropagation(); onDelete(); }}
							className="text-destructive focus:text-destructive"
						>
							<Trash2 className="w-4 h-4 mr-2" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
