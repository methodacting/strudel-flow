/**
 * WAV encoder for converting Float32Array audio buffers to WAV format
 * Provides proper duration metadata for seeking in audio players
 */

export interface WavEncoderOptions {
	sampleRate: number;
	numChannels: number;
}

/**
 * Convert Float32Array to 16-bit PCM
 */
function floatTo16BitPCM(float32: Float32Array): Int16Array {
	const out = new Int16Array(float32.length);
	for (let i = 0; i < float32.length; i++) {
		const s = Math.max(-1, Math.min(1, float32[i]));
		out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return out;
}

/**
 * Write a string to a DataView at a specific offset
 */
function writeString(view: DataView, offset: number, string: string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

/**
 * Encode Float32Array buffers to WAV format
 * @param left - Left channel audio data as array of Float32Array chunks
 * @param right - Right channel audio data as array of Float32Array chunks
 * @param options - WAV encoding options
 * @returns WAV Blob
 */
export function encodeToWav(
	left: Float32Array[],
	right: Float32Array[],
	options: WavEncoderOptions,
): Blob {
	const { sampleRate, numChannels } = options;
	const bitDepth = 16;
	const bytesPerSample = bitDepth / 8;
	const blockAlign = numChannels * bytesPerSample;

	// Calculate total samples
	const totalSamples = left.reduce((sum, chunk) => sum + chunk.length, 0);

	// Interleave stereo channels
	const interleaved = new Int16Array(totalSamples * numChannels);
	let offset = 0;

	for (let i = 0; i < left.length; i++) {
		const leftChunk = floatTo16BitPCM(left[i]);
		const rightChunk = floatTo16BitPCM(right[i]);

		for (let j = 0; j < leftChunk.length; j++) {
			interleaved[offset++] = leftChunk[j];
			interleaved[offset++] = rightChunk[j];
		}
	}

	const dataSize = interleaved.byteLength;
	const byteRate = sampleRate * blockAlign;

	// Create WAV file buffer
	const buffer = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer);

	// RIFF chunk descriptor
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");

	// fmt sub-chunk
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
	view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, byteRate, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitDepth, true);

	// data sub-chunk
	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	// Write PCM data
	new Uint8Array(buffer, 44).set(new Uint8Array(interleaved.buffer));

	return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Calculate the duration in seconds from Float32Array buffers
 */
export function calculateDuration(
	left: Float32Array[],
	sampleRate: number,
): number {
	const totalSamples = left.reduce((sum, chunk) => sum + chunk.length, 0);
	return totalSamples / sampleRate;
}
