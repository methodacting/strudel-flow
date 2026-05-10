import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProjectsQuery } from "@/hooks/api/projects";
import { useSessionContext } from "@/contexts/session-context";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Project } from "@/types/project";

export function ProjectSwitcher({
	projectId,
	projectName,
	sessionReady,
}: {
	projectId: string;
	projectName: string;
	sessionReady: boolean;
}) {
	const navigate = useNavigate();
	const { session, isAuthenticated } = useSessionContext();
	const { data: projects, isLoading } = useProjectsQuery(
		sessionReady,
		isAuthenticated,
		session?.user?.id,
	);

	const options = useMemo<Project[]>(() => {
		const list = projects ?? [];
		if (list.some((project) => project.id === projectId)) return list;
		return [{ id: projectId, name: projectName } as Project, ...list];
	}, [projectId, projectName, projects]);

	return (
		<Select
			value={projectId}
			onValueChange={(value) => {
				if (value === projectId) return;
				navigate({
					to: "/project/$projectId",
					params: { projectId: value },
				});
			}}
			disabled={!sessionReady || isLoading || options.length === 0}
		>
			<SelectTrigger className="h-9 w-[220px] max-w-[320px] rounded-full border-border/70 bg-background/70 px-3 text-sm font-semibold shadow-sm backdrop-blur">
				<SelectValue placeholder={projectName} />
			</SelectTrigger>
			<SelectContent className="max-h-72">
				{options.map((project) => (
					<SelectItem key={project.id} value={project.id}>
						{project.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
