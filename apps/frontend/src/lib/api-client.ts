import { hc } from "hono/client";
import type { Session } from "./auth";

type ApiClientRoutes = {
	api: {
		projects: {
			$get: () => Promise<Response>;
			$post: (args: {
				json: { name: string; organizationId?: string | null };
			}) => Promise<Response>;
			join: {
				":token": {
					$post: (args: { param: { token: string } }) => Promise<Response>;
				};
			};
			":id": {
				$get: (args: { param: { id: string } }) => Promise<Response>;
				$put: (args: { param: { id: string }; json: { name?: string } }) => Promise<Response>;
				$delete: (args: { param: { id: string } }) => Promise<Response>;
				realtime: {
					$get: (args: { param: { id: string } }) => Promise<Response>;
				};
				invite: {
					$post: (args: { param: { id: string }; json: { role?: string } }) => Promise<Response>;
				};
			};
		};
		project: {
			":id": {
				state: {
					$get: (args: { param: { id: string } }) => Promise<Response>;
				};
			};
		};
	};
};

const API_BASE_URL =
	import.meta.env.VITE_BACKEND_URL ||
	(typeof window !== "undefined" ? window.location.origin : "");

const client = hc(API_BASE_URL, {
	init: {
		credentials: "include",
	},
}) as unknown as ApiClientRoutes;

export class ApiError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

class ApiClient {
	private token: string | null = null;

	constructor() {
		this.loadToken();
	}

	private loadToken() {
		this.token = localStorage.getItem("auth_token");
	}

	private clearToken() {
		this.token = null;
		localStorage.removeItem("auth_token");
	}

	private async request(
		url: string,
		options: RequestInit = {},
	): Promise<Response> {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (this.token) {
			headers["Authorization"] = `Bearer ${this.token}`;
		}

		return fetch(`${API_BASE_URL}${url}`, {
			...options,
			credentials: "include",
			headers: {
				...headers,
				...options.headers,
			},
		});
	}

	// Auth methods
	async getSession() {
		const response = await this.request("/auth/get-session");
		if (!response.ok) {
			return null;
		}
		return (await response.json()) as Session;
	}

	async signInWithGoogle() {
		window.location.href = `${API_BASE_URL}/auth/sign-in/google`;
	}

	async signOut() {
		const response = await this.request("/auth/sign-out", { method: "POST" });
		if (response.ok) {
			this.clearToken();
		}
		return response;
	}

	// Project methods
	async getProjects() {
		const response = await client.api.projects.$get();
		if (!response.ok) {
			throw new Error("Failed to fetch projects");
		}
		const data = await response.json();
		return data.projects;
	}

	async getProject(id: string) {
		const response = await client.api.projects[":id"].$get({
			param: { id },
		});
		if (!response.ok) {
			throw new Error("Failed to fetch project");
		}
		const data = await response.json();
		return data.project;
	}

	async createProject(name: string, organizationId?: string) {
		const response = await client.api.projects.$post({
			json: organizationId ? { name, organizationId } : { name },
		});
		if (!response.ok) {
			const error = (await response.json()) as { error?: string };
			throw new Error(error.error || "Failed to create project");
		}
		const data = await response.json();
		return data.project;
	}

	async updateProject(id: string, updates: { name?: string }) {
		const response = await client.api.projects[":id"].$put({
			param: { id },
			json: updates,
		});
		if (!response.ok) {
			throw new Error("Failed to update project");
		}
		const data = await response.json();
		return data.project;
	}

	async deleteProject(id: string) {
		const response = await client.api.projects[":id"].$delete({
			param: { id },
		});
		if (!response.ok) {
			throw new Error("Failed to delete project");
		}
		return response.json();
	}

	// Realtime methods
	async getRealtimeUrl(projectId: string) {
		const response = await client.api.projects[":id"].realtime.$get({
			param: { id: projectId },
		});
		if (!response.ok) {
			throw new Error("Failed to get realtime URL");
		}
		return response.json();
	}

	async joinProject(token: string) {
		const response = await client.api.projects.join[":token"].$post({
			param: { token },
		});
		if (!response.ok) {
			const error = (await response.json()) as { error?: string };
			throw new ApiError(
				error.error || "Failed to join project",
				response.status,
			);
		}
		const data = await response.json();
		return data.project;
	}

	async getProjectState(projectId: string): Promise<ArrayBuffer> {
		const response = await client.api.project[":id"].state.$get({
			param: { id: projectId },
		});
		if (!response.ok) {
			throw new Error("Failed to get project state");
		}
		return response.arrayBuffer();
	}

	async createInvite(projectId: string, role?: string) {
		const response = await client.api.projects[":id"].invite.$post({
			param: { id: projectId },
			json: role ? { role } : {},
		});
		if (!response.ok) {
			const error = (await response.json()) as { error?: string };
			throw new Error(error.error || "Failed to create invite");
		}
		return response.json();
	}
}

export const apiClient = new ApiClient();
