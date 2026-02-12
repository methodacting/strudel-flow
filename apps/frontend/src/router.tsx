/* eslint-disable react-refresh/only-export-components */
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter, useParams } from "@tanstack/react-router";
import { useProjectQuery } from "@/hooks/api/projects";
import { ProjectEditor, ProjectManager } from "./app";
import { useSessionContext } from "./contexts/session-context";
import { SessionProvider } from "./contexts/session-provider";
import { SharedAudioPage } from "./components/shared-audio-page";
import { useSessionQuery } from "./hooks/api/session";
import { useLocalProjectMigration } from "./hooks/use-local-project-migration";

const rootRoute = createRootRoute({
	component: function RootLayout() {
		const { data: session, isLoading } = useSessionQuery(true);
		const sessionReady = !isLoading;
		const isAuthenticated = Boolean(session?.user?.id);
		useLocalProjectMigration(session?.user?.id);

		return (
			<SessionProvider
				sessionReady={sessionReady}
				session={session ?? null}
				isAuthenticated={isAuthenticated}
			>
				<Outlet />
			</SessionProvider>
		);
	},
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: function IndexRoute() {
		const { sessionReady } = useSessionContext();
		return <ProjectManager sessionReady={sessionReady} />;
	},
});

const projectRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/project/$projectId",
	component: function ProjectRoute() {
		const { sessionReady, isAuthenticated, session } = useSessionContext();
		const { projectId } = useParams({ from: "/project/$projectId" });

		const { data: project, isLoading } = useProjectQuery(
			projectId,
			sessionReady,
			isAuthenticated,
			session?.user?.id,
		);

		if (!sessionReady || isLoading) {
			return null;
		}

		if (!project) {
			return (
				<div className="p-6 text-sm text-muted-foreground">
					Project not found.
				</div>
			);
		}

		return (
			<ProjectEditor
				projectId={project.id}
				projectName={project.name}
				accessRole={project.accessRole}
				sessionReady={sessionReady}
			/>
		);
	},
});

const audioShareRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/audio/$exportId",
	component: SharedAudioPage,
});

const routeTree = rootRoute.addChildren([indexRoute, projectRoute, audioShareRoute]);

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	scrollRestoration: true,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

export function AppRouterProvider() {
	return <RouterProvider router={router} />;
}
