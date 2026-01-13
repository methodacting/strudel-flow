import { useCallback, useRef, useState } from "react";

export interface AudioExportOptions {
	duration: number; // in seconds
	onProgress?: (remaining: number) => void;
	onComplete?: (blob: Blob) => void;
	onError?: (error: Error) => void;
}

/**
 * Convert AudioBuffer to WAV format
 * WAV files include proper duration metadata for seeking
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
	const numChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const format = 1; // PCM
	const bitDepth = 16;

	const bytesPerSample = bitDepth / 8;
	const blockAlign = numChannels * bytesPerSample;

	const samples = buffer.length;
	const dataSize = samples * blockAlign;
	const buffer2 = new ArrayBuffer(44 + dataSize);
	const view = new DataView(buffer2);

	// RIFF chunk descriptor
	writeString(view, 0, "RIFF");
	view.setUint32(4, 36 + dataSize, true);
	writeString(view, 8, "WAVE");

	// fmt sub-chunk
	writeString(view, 12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, format, true);
	view.setUint16(22, numChannels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitDepth, true);

	// data sub-chunk
	writeString(view, 36, "data");
	view.setUint32(40, dataSize, true);

	// Write interleaved data
	const offset = 44;
	for (let i = 0; i < samples; i++) {
		for (let channel = 0; channel < numChannels; channel++) {
			const sample = buffer.getChannelData(channel)[i];
			// Clamp and convert to 16-bit PCM
			const intSample = Math.max(-1, Math.min(1, sample));
			view.setInt16(
				offset + (i * numChannels + channel) * bytesPerSample,
				intSample < 0 ? intSample * 0x8000 : intSample * 0x7fff,
				true,
			);
		}
	}

	return new Blob([buffer2], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
	for (let i = 0; i < string.length; i++) {
		view.setUint8(offset + i, string.charCodeAt(i));
	}
}

/**
 * Convert WebM/Opus blob to WAV format
 * This ensures proper duration metadata for seeking
 */
async function convertToWav(webmBlob: Blob): Promise<Blob> {
	const arrayBuffer = await webmBlob.arrayBuffer();
	const audioContext = new AudioContext({ sampleRate: 44100 });

	try {
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
		return audioBufferToWav(audioBuffer);
	} finally {
		await audioContext.close();
	}
}

/**
 * Record audio from the current tab using Screen Capture API
 *
 * This is the most reliable way to capture Strudel's audio output.
 * It uses getDisplayMedia() to capture the tab's audio stream.
 *
 * Note: This will prompt the user to select which tab/audio to capture.
 * They should select "This Tab" or the current browser tab.
 */
export function useAudioExport() {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const [isRecording, setIsRecording] = useState(false);

	const startRecording = useCallback(
		async (options: AudioExportOptions) => {
			try {
				setIsRecording(true);

				// Request screen/audio capture from the user
				// Note: Most browsers require video to be enabled for getDisplayMedia
				// We capture the current tab with audio
				const displayMedia = await navigator.mediaDevices.getDisplayMedia({
					video: {
						displaySurface: "browser", // Capture browser/tab only
					},
					audio: {
						suppressLocalAudioPlayback: false, // Let the user hear it while recording
						echoCancellation: false,
						noiseSuppression: false,
						autoGainControl: false,
					},
					preferCurrentTab: true, // Hint to capture this tab
				} as DisplayMediaStreamOptions);

				// Get the audio track from the stream
				const audioTrack = displayMedia.getAudioTracks()[0];
				if (!audioTrack) {
					throw new Error("No audio track found in capture stream. Please ensure you select a tab with audio.");
				}

				// Create a stream with only the audio track
				const audioStream = new MediaStream([audioTrack]);

				// Create a MediaRecorder with the audio-only stream
				const mediaRecorder = new MediaRecorder(audioStream, {
					mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
						? "audio/webm;codecs=opus"
						: "audio/webm",
					audioBitsPerSecond: 320000, // High quality audio
				});
				mediaRecorderRef.current = mediaRecorder;

				const chunks: BlobPart[] = [];

				mediaRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						chunks.push(event.data);
					}
				};

				mediaRecorder.onstop = async () => {
					const webmBlob = new Blob(chunks, { type: "audio/webm" });

					// Stop all tracks to release the capture
					displayMedia.getTracks().forEach((track) => track.stop());

					try {
						// Convert WebM to WAV for proper duration metadata
						const wavBlob = await convertToWav(webmBlob);
						options.onComplete?.(wavBlob);
					} catch (error) {
						console.error("Failed to convert to WAV:", error);
						// Fallback to original WebM blob if conversion fails
						options.onComplete?.(webmBlob);
					}
					setIsRecording(false);
				};

				// Start recording
				mediaRecorder.start(100); // Collect data every 100ms

				// Progress updates
				const startTime = Date.now();
				const updateProgress = () => {
					const elapsed = (Date.now() - startTime) / 1000;
					const remaining = Math.max(0, options.duration - elapsed);
					options.onProgress?.(remaining);

					if (remaining > 0) {
						requestAnimationFrame(updateProgress);
					}
				};

				requestAnimationFrame(updateProgress);

				// Stop after duration
				setTimeout(() => {
					if (mediaRecorder.state === "recording") {
						mediaRecorder.stop();
					}
				}, options.duration * 1000);

			} catch (error) {
				// User might have cancelled the screen capture dialog
				if (error instanceof Error && error.name === "NotAllowedError") {
					options.onError?.(new Error("Screen capture permission denied. Please allow audio capture to export."));
				} else {
					options.onError?.(error as Error);
				}
				setIsRecording(false);
			}
		},
		[],
	);

	const stopRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}
	}, []);

	return {
		isRecording,
		startRecording,
		stopRecording,
	};
}
