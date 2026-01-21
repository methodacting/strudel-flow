import { z } from "zod";

/**
 * All possible error codes in the application
 * Grouped by HTTP status category
 */
export const ErrorCodeEnum = z.enum([
	// Authentication errors (401)
	"UNAUTHORIZED",
	"INVALID_CREDENTIALS",
	"TOKEN_EXPIRED",
	"SESSION_NOT_FOUND",

	// Authorization errors (403)
	"FORBIDDEN",
	"INSUFFICIENT_PERMISSIONS",

	// Validation errors (400)
	"VALIDATION_ERROR",
	"INVALID_INPUT",
	"MISSING_REQUIRED_FIELD",

	// Not found errors (404)
	"PROJECT_NOT_FOUND",
	"USER_NOT_FOUND",
	"INVITE_NOT_FOUND",
	"EXPORT_NOT_FOUND",
	"RESOURCE_NOT_FOUND",

	// Conflict errors (409)
	"INVITE_EXPIRED",
	"INVITE_ALREADY_USED",
	"ALREADY_MEMBER",
	"RESOURCE_ALREADY_EXISTS",

	// Database errors (500)
	"DATABASE_ERROR",
	"DATABASE_CONSTRAINT_ERROR",
	"DATABASE_CONNECTION_ERROR",

	// Storage errors (500)
	"STORAGE_ERROR",
	"STORAGE_QUOTA_EXCEEDED",

	// Server errors (500)
	"INTERNAL_ERROR",
	"SERVICE_UNAVAILABLE",
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

/**
 * Custom application error class
 * All errors in the app should use this class for consistent error handling
 */
export class AppError extends Error {
	constructor(
		public code: ErrorCode,
		message?: string,
		public cause?: unknown,
		public context?: Record<string, unknown>,
	) {
		super(message || code);
		this.name = "AppError";
	}

	/**
	 * Get the appropriate HTTP status code for this error
	 */
	getStatusCode(): number {
		return getStatusCodeForErrorCode(this.code);
	}

	/**
	 * Convert to a JSON-serializable object for API responses
	 */
	toJSON() {
		return {
			error: this.code,
			message: this.message,
			...(this.context && { context: this.context }),
		};
	}
}

/**
 * Map error codes to HTTP status codes
 */
function getStatusCodeForErrorCode(code: ErrorCode): number {
	const statusMap: Record<ErrorCode, number> = {
		// Authentication (401)
		UNAUTHORIZED: 401,
		INVALID_CREDENTIALS: 401,
		TOKEN_EXPIRED: 401,
		SESSION_NOT_FOUND: 401,

		// Authorization (403)
		FORBIDDEN: 403,
		INSUFFICIENT_PERMISSIONS: 403,

		// Validation (400)
		VALIDATION_ERROR: 400,
		INVALID_INPUT: 400,
		MISSING_REQUIRED_FIELD: 400,

		// Not found (404)
		PROJECT_NOT_FOUND: 404,
		USER_NOT_FOUND: 404,
		INVITE_NOT_FOUND: 404,
		EXPORT_NOT_FOUND: 404,
		RESOURCE_NOT_FOUND: 404,

		// Conflict (409)
		INVITE_EXPIRED: 409,
		INVITE_ALREADY_USED: 409,
		ALREADY_MEMBER: 409,
		RESOURCE_ALREADY_EXISTS: 409,

		// Database (500)
		DATABASE_ERROR: 500,
		DATABASE_CONSTRAINT_ERROR: 500,
		DATABASE_CONNECTION_ERROR: 500,

		// Storage (500)
		STORAGE_ERROR: 500,
		STORAGE_QUOTA_EXCEEDED: 507,

		// Server (500/503)
		INTERNAL_ERROR: 500,
		SERVICE_UNAVAILABLE: 503,
	};

	return statusMap[code] || 500;
}

/**
 * Type alias for ResultAsync from neverthrow
 */
import type { ResultAsync as ResultAsyncType } from "neverthrow";
export type ResultAsync<T, E = AppError> = ResultAsyncType<T, E>;
