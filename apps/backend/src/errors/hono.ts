import type { Context } from "hono";
import type { Result } from "neverthrow";
import type { AppError } from "./types";

/**
 * Convert a neverthrow Result to a Hono response
 * This handles both success and error cases automatically
 *
 * @example
 * ```ts
 * const result = await service.getProject(id);
 * return resultToResponse(result, c);
 * ```
 */
export function resultToResponse<T>(
	result: Result<T, AppError>,
	c: Context,
): Response {
	return result.match(
		(data) => c.json({ success: true, data }, 200 as const),
		(error) => {
			const status = error.getStatusCode() as 400 | 401 | 403 | 404 | 409 | 500 | 503;
			return c.json({
				success: false,
				...error.toJSON(),
			}, status);
		},
	);
}

/**
 * Convert a neverthrow Result to a Hono response with custom status codes
 * Useful for 201 Created, 202 Accepted, etc.
 *
 * @example
 * ```ts
 * const result = await service.createProject(input);
 * return resultToResponseWithStatus(result, c, 201);
 * ```
 */
export function resultToResponseWithStatus<T>(
	result: Result<T, AppError>,
	c: Context,
	successStatus: 200 | 201 | 202,
): Response {
	return result.match(
		(data) => c.json({ success: true, data }, successStatus),
		(error) => {
			const status = error.getStatusCode() as 400 | 401 | 403 | 404 | 409 | 500 | 503;
			return c.json({
				success: false,
				...error.toJSON(),
			}, status);
		},
	);
}

/**
 * Create a success response helper
 *
 * @example
 * ```ts
 * return successResponse(c, { message: "Project deleted" });
 * // or with custom status
 * return successResponse(c, { id: "123" }, 201);
 * ```
 */
export function successResponse<T>(
	c: Context,
	data: T,
	status: 200 | 201 | 202 = 200,
): Response {
	return c.json({ success: true, data }, status);
}

/**
 * Create an error response helper
 *
 * @example
 * ```ts
 * return errorResponse(c, "FORBIDDEN", "You don't have access");
 * ```
 */
export function errorResponse(
	c: Context,
	code: string,
	message: string,
	status: 400 | 401 | 403 | 404 | 409 | 500 | 503 = 400,
): Response {
	return c.json({
		success: false,
		error: code,
		message,
	}, status);
}
