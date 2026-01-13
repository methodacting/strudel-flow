import { useMutation } from "@tanstack/react-query";
import { ApiStatusError } from "@/lib/api-helpers";

/**
 * Response from the export API endpoint
 */
export interface CreateExportResponse {
	audioUrl: string;
	shareUrl: string;
	exportId: string;
	duration: number;
	createdAt: string;
}

export interface CreateExportVariables {
	projectId: string;
	audioBlob: Blob;
	overwrite: boolean;
	duration: number;
}

export const useCreateExportMutation = () =>
	useMutation<CreateExportResponse, Error, CreateExportVariables>({
		mutationFn: async ({
			projectId,
			audioBlob,
			overwrite,
			duration,
		}) => {
			const formData = new FormData();
			formData.append("audio", audioBlob);
			formData.append("overwrite", overwrite.toString());
			formData.append("duration", duration.toString());

			// Using fetch directly for FormData support
			const response = await fetch(`/api/projects/${projectId}/export`, {
				method: "POST",
				body: formData,
				credentials: "include",
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new ApiStatusError(
					errorData.error || "Failed to create export",
					response.status,
				);
			}

			return response.json();
		},
	});
