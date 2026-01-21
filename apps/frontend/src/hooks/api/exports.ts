import { useMutation } from "@tanstack/react-query";
import { ApiStatusError, getErrorMessage } from "@/lib/api-helpers";
import { honoClient } from "@/lib/hono-client";

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

			const response = await honoClient.api.projects[":id"].export.$post(
				{
					param: { id: projectId },
					// @ts-expect-error - Hono client accepts FormData but types don't match
					body: formData,
				},
			);

			if (!response.ok) {
				throw new ApiStatusError(
					await getErrorMessage(response, "Failed to create export"),
					response.status,
				);
			}

			return response.json() as Promise<CreateExportResponse>;
		},
	});
