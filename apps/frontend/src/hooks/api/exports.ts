import { useMutation } from "@tanstack/react-query";
import { ApiStatusError } from "@/lib/api-helpers";

export const useCreateExportMutation = () =>
	useMutation({
		mutationFn: async ({
			projectId,
			audioBlob,
			overwrite,
			duration,
		}: {
			projectId: string;
			audioBlob: Blob;
			overwrite: boolean;
			duration: number;
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
				const errorData = await response.json() as { error?: string };
				throw new ApiStatusError(
					errorData.error || "Failed to create export",
					response.status,
				);
			}

			return response.json();
		},
	});
