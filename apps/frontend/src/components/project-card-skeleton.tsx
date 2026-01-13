import { Music } from "lucide-react";

export default function ProjectCardSkeleton() {
	return (
		<div className="bg-card border border-border rounded-lg p-4 animate-pulse">
			<div className="flex items-start gap-3">
				<div className="p-2 rounded-lg bg-primary/10">
					<Music className="w-6 h-6 text-primary" />
				</div>
				<div className="flex-1 min-w-0 space-y-2">
					<div className="h-5 bg-muted rounded w-3/4" />
					<div className="h-4 bg-muted rounded w-1/2" />
				</div>
			</div>
		</div>
	);
}
