export class ApiStatusError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

export const getErrorMessage = async (
	response: Response,
	fallback: string = "Request failed",
) => {
	try {
		const data = (await response.json()) as { error?: string; message?: string };
		return data.error || data.message || response.statusText || fallback;
	} catch {
		return response.statusText || fallback;
	}
};
