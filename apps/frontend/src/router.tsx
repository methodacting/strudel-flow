/* eslint-disable react-refresh/only-export-components */
import { Outlet, RouterProvider, createRootRoute, createRoute, createRouter, useParams, useNavigate } from "@tanstack/react-router";
import { ApiStatusError } from "@/lib/api-helpers";
import { useProjectQuery, useJoinProjectMutation } from "@/hooks/api/projects";
import { useEffect, useState } from "react";
import { useAnonymousSession } from "./hooks/use-anonymous-session";
import { ProjectEditor, ProjectManager } from "./app";
import { useSessionContext } from "./contexts/session-context";
import { SessionProvider } from "./contexts/session-provider";
import { Button } from "./components/ui/button";

const rootRoute = createRootRoute({
	component: function RootLayout() {
		const { initialized: sessionReady } = useAnonymousSession();

		return (
			<SessionProvider sessionReady={sessionReady}>
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
		const { sessionReady } = useSessionContext();
		const { projectId } = useParams({ from: "/project/$projectId" });

		const { data: project, isLoading } = useProjectQuery(
			projectId,
			sessionReady,
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
				sessionReady={sessionReady}
			/>
		);
	},
});

const joinRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/project/join/$token",
	component: function JoinRoute() {
		const { sessionReady } = useSessionContext();
		const { token } = useParams({ from: "/project/join/$token" });
		const [error, setError] = useState<{
			title: string;
			description: string;
		} | null>(null);
		const joinProject = useJoinProjectMutation();
		const navigate = useNavigate();

		useEffect(() => {
			let cancelled = false;
			const controller = new AbortController();
			if (!sessionReady) return;

			void (async () => {
				try {
					const project = await joinProject.mutateAsync({
						token,
						signal: controller.signal,
					});
					if (!cancelled) {
						navigate({
							to: "/project/$projectId",
							params: { projectId: project.id },
							replace: true,
						});
					}
				} catch (err) {
					if (!cancelled) {
						if (err instanceof ApiStatusError) {
							if (err.status === 410) {
								setError({
									title: "Invite expired",
									description:
										"This invite link is no longer valid. Ask the owner to generate a new one.",
								});
							} else if (err.status === 409) {
								setError({
									title: "Invite already used",
									description:
										"This invite link has already been used. Ask the owner for a new link.",
								});
							} else if (err.status === 404) {
								setError({
									title: "Invite not found",
									description:
										"This invite link doesn’t exist or was removed. Check the URL or ask for a new link.",
								});
							} else {
								setError({
									title: "Unable to join",
									description: err.message || "Failed to join project.",
								});
							}
						} else {
							setError({
								title: "Unable to join",
								description:
									err instanceof Error ? err.message : "Failed to join project.",
							});
						}
					}
				}
			})();

			return () => {
				cancelled = true;
				controller.abort();
			};
		}, [joinProject, navigate, sessionReady, token]);

		return (
			<div className="flex min-h-screen items-center justify-center bg-background px-6">
				<div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
					{error ? (
						<div className="space-y-3">
							<div>
								<h2 className="text-lg font-semibold">{error.title}</h2>
								<p className="text-sm text-muted-foreground">
									{error.description}
								</p>
							</div>
							<div className="flex gap-2">
								<Button onClick={() => navigate({ to: "/" })}>
									Back to projects
								</Button>
								<Button
									variant="secondary"
									onClick={() => window.location.reload()}
								>
									Try again
								</Button>
							</div>
						</div>
					) : (
						<div className="space-y-2">
							<h2 className="text-lg font-semibold">Joining project</h2>
							<p className="text-sm text-muted-foreground">
								Just a moment while we verify your invite…
							</p>
						</div>
					)}
				</div>
			</div>
		);
	},
});

const routeTree = rootRoute.addChildren([indexRoute, projectRoute, joinRoute]);

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
