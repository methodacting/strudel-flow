/**
 * Error handling utilities with neverthrow
 *
 * @example
 * ```ts
 * import { error, fromDatabase, errors, success, type Result } from '@/errors'
 *
 * // Using the error factory
 * return error('PROJECT_NOT_FOUND', 'Project not found')
 *
 * // Using common errors
 * return errors.projectNotFound(projectId)
 *
 * // Wrapping database operations
 * return fromDatabase(
 *   db.select().from(projects),
 *   { operation: 'listProjects' }
 * )
 *
 * // Creating success results
 * return success({ id: '123' })
 * ```
 */
export * from "./types";
export { success, error, fromDatabase, fromD1Statement, fromStorage, fromZodError, errors } from "./helpers";
export * from "./hono";

// Re-export neverthrow Result types
export type { Result, ResultAsync } from "neverthrow";

