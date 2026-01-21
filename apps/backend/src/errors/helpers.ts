import { err, ok, type Result } from "neverthrow";
import { ResultAsync } from "neverthrow";
import { AppError, type ErrorCode } from "./types";

/**
 * Create a success result
 */
export function success<T>(value: T) {
	return ok(value);
}

/**
 * Create an error result
 */
export function error(
	code: ErrorCode,
	message?: string,
	cause?: unknown,
	context?: Record<string, unknown>,
) {
	return err(new AppError(code, message, cause, context));
}

/**
 * Wrap a database operation in ResultAsync
 * Use this for all Drizzle ORM calls
 */
export function fromDatabase<T>(
	promise: Promise<T>,
	context?: Record<string, unknown>,
): ResultAsync<T, AppError> {
	return ResultAsync.fromPromise(
		promise,
		(e) =>
			new AppError(
				"DATABASE_ERROR",
				"Database operation failed",
				e,
				context,
			),
	);
}

/**
 * Wrap a D1 prepared statement in ResultAsync
 * Use this for all c.env.DB.prepare() calls
 */
export function fromD1Statement<T>(
	statement: Promise<D1Result<T>>,
	context?: Record<string, unknown>,
): ResultAsync<D1Result<T>, AppError> {
	return ResultAsync.fromPromise(
		statement,
		(e) =>
			new AppError("DATABASE_ERROR", "D1 statement failed", e, context),
	);
}

/**
 * Wrap a storage operation in ResultAsync
 * Use this for all R2 operations
 */
export function fromStorage<T>(
	promise: Promise<T>,
	context?: Record<string, unknown>,
): ResultAsync<T, AppError> {
	return ResultAsync.fromPromise(
		promise,
		(e) =>
			new AppError("STORAGE_ERROR", "Storage operation failed", e, context),
	);
}

/**
 * Convert a Zod validation error to an AppError
 */
export function fromZodError(zodError: {
	errors: Array<{ path: Array<string | number>; message: string }>;
}): Result<never, AppError> {
	const message = zodError.errors
		.map((e) => `${e.path.join(".")}: ${e.message}`)
		.join(", ");
	return err(new AppError("VALIDATION_ERROR", message, zodError));
}

/**
 * Common error factory functions
 */

export const errors = {
	// Authentication
	unauthorized: (message = "Unauthorized") =>
		error("UNAUTHORIZED", message),

	invalidCredentials: (message = "Invalid credentials") =>
		error("INVALID_CREDENTIALS", message),

	tokenExpired: (message = "Token has expired") =>
		error("TOKEN_EXPIRED", message),

	sessionNotFound: (message = "Session not found") =>
		error("SESSION_NOT_FOUND", message),

	// Authorization
	forbidden: (message = "Forbidden") => error("FORBIDDEN", message),

	insufficientPermissions: (message = "Insufficient permissions") =>
		error("INSUFFICIENT_PERMISSIONS", message),

	// Validation
	validationError: (message: string, details?: unknown) =>
		error("VALIDATION_ERROR", message, details),

	invalidInput: (field: string, message = "Invalid input") =>
		error("INVALID_INPUT", `${field}: ${message}`),

	missingField: (field: string) =>
		error("MISSING_REQUIRED_FIELD", `Missing required field: ${field}`),

	// Not found
	projectNotFound: (projectId: string) =>
		error(
			"PROJECT_NOT_FOUND",
			`Project not found: ${projectId}`,
			undefined,
			{ projectId },
		),

	userNotFound: (userId: string) =>
		error(
			"USER_NOT_FOUND",
			`User not found: ${userId}`,
			undefined,
			{ userId },
		),

	inviteNotFound: (token: string) =>
		error(
			"INVITE_NOT_FOUND",
			"Invite not found or expired",
			undefined,
			{ token },
		),

	exportNotFound: (exportId: string) =>
		error(
			"EXPORT_NOT_FOUND",
			`Audio export not found: ${exportId}`,
			undefined,
			{ exportId },
		),

	// Conflict
	inviteExpired: () => error("INVITE_EXPIRED", "Invite has expired"),

	inviteAlreadyUsed: () =>
		error("INVITE_ALREADY_USED", "Invite has already been used"),

	alreadyMember: () =>
		error("ALREADY_MEMBER", "Already a member of this project"),

	resourceAlreadyExists: (resource: string) =>
		error("RESOURCE_ALREADY_EXISTS", `${resource} already exists`),

	// Database
	databaseError: (message: string, cause?: unknown) =>
		error("DATABASE_ERROR", message, cause),

	databaseConstraintError: (constraint: string, cause?: unknown) =>
		error(
			"DATABASE_CONSTRAINT_ERROR",
			`Database constraint error: ${constraint}`,
			cause,
			{ constraint },
		),

	// Storage
	storageError: (message: string, cause?: unknown) =>
		error("STORAGE_ERROR", message, cause),

	storageQuotaExceeded: () =>
		error("STORAGE_QUOTA_EXCEEDED", "Storage quota exceeded"),

	// Server
	internalError: (message = "Internal server error", cause?: unknown) =>
		error("INTERNAL_ERROR", message, cause),

	serviceUnavailable: (message = "Service temporarily unavailable") =>
		error("SERVICE_UNAVAILABLE", message),
};
