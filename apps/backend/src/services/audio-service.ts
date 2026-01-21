import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import type { AppBindings } from "../types/hono";
import { db } from "../db";
import { fromDatabase, fromStorage, errors, success, type Result, type ResultAsync, type AppError } from "../errors";
import * as schema from "@strudel-flow/db/schema";

/**
 * Audio export metadata
 */
export interface AudioExport {
	id: string;
	projectId: string;
	fileKey: string;
	format: string;
	durationSeconds: number;
	isLatest: boolean;
	createdAt: Date;
}

/**
 * Input for creating an audio export
 */
export interface CreateAudioExportInput {
	projectId: string;
	audioFile: File;
	durationSeconds: number;
	overwrite?: boolean;
}

/**
 * Output after creating an audio export
 */
export interface AudioExportOutput {
	exportId: string;
	audioUrl: string;
	shareUrl: string;
	duration: number;
	createdAt: string;
}

/**
 * Service for handling audio export operations
 * All database operations use Drizzle ORM, all storage operations use R2
 * Everything is wrapped in ResultAsync for type-safe error handling
 */
export class AudioService {
	constructor(private env: AppBindings) {}

	/**
	 * Create a new audio export for a project
	 * Uploads the audio file to R2 and stores metadata in D1 using Drizzle ORM
	 */
	async createAudioExport(input: CreateAudioExportInput): Promise<Result<AudioExportOutput, AppError>> {
		const exportId = nanoid();
		const fileKey = `exports/${input.projectId}/${exportId}.wav`;

		// If overwrite is enabled, mark previous exports as not latest using Drizzle
		if (input.overwrite) {
			const database = db(this.env.DB);
			await fromDatabase(
				database
					.update(schema.projectExport)
					.set({ isLatest: false })
					.where(
						and(
							eq(schema.projectExport.projectId, input.projectId),
							eq(schema.projectExport.isLatest, true)
						)
					),
				{ operation: "markPreviousExportsAsOld", projectId: input.projectId },
			);
		}

		// Upload to R2
		await this.uploadAudioToR2(fileKey, input.audioFile);

		// Insert metadata using Drizzle ORM
		const database = db(this.env.DB);
		await fromDatabase(
			database
				.insert(schema.projectExport)
				.values({
					id: exportId,
					projectId: input.projectId,
					fileKey,
					format: "wav",
					durationSeconds: input.durationSeconds,
					isLatest: true,
					createdAt: new Date(),
				}),
			{ operation: "insertExportMetadata", exportId },
		);

		return success({
			exportId,
			audioUrl: `/api/audio/${exportId}`,
			shareUrl: `${this.getOrigin()}/audio/${exportId}`,
			duration: input.durationSeconds,
			createdAt: new Date().toISOString(),
		});
	}

	/**
	 * Get audio export metadata by ID using Drizzle ORM
	 */
	async getAudioExport(exportId: string): Promise<Result<{ fileKey: string }, AppError>> {
		const database = db(this.env.DB);
		const result = await fromDatabase(
			database
				.select({ fileKey: schema.projectExport.fileKey })
				.from(schema.projectExport)
				.where(eq(schema.projectExport.id, exportId))
				.limit(1),
			{ operation: "getAudioExport", exportId },
		);

		return result.andThen((exports) => {
			if (!exports || exports.length === 0) {
				return errors.exportNotFound(exportId);
			}
			return success({ fileKey: exports[0].fileKey });
		});
	}

	/**
	 * Get the audio file from R2
	 */
	async getAudioFile(fileKey: string): Promise<Result<R2Object, AppError>> {
		return fromStorage(
			this.env.AUDIO_EXPORTS.get(fileKey),
			{ operation: "getAudioFile", fileKey },
		).andThen((object) => {
			if (!object) {
				return errors.storageError(`Audio file not found: ${fileKey}`);
			}
			return success(object);
		});
	}

	/**
	 * Upload audio file to R2
	 */
	private async uploadAudioToR2(fileKey: string, audioFile: File): Promise<Result<void, AppError>> {
		return fromStorage(
			this.env.AUDIO_EXPORTS.put(fileKey, audioFile, {
				httpMetadata: {
					contentType: "audio/wav",
				},
			}),
			{ operation: "uploadAudioToR2", fileKey },
		).map(() => undefined);
	}

	/**
	 * Get the origin URL for the current environment
	 */
	private getOrigin(): string {
		// This should be set from environment or request context
		// For now, return a placeholder that will be replaced by the route handler
		return "";
	}
}
