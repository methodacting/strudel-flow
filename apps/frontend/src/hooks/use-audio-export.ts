import { useCallback, useRef, useState } from "react";

export interface AudioExportOptions {
	duration: number; // in seconds
	onProgress?: (remaining: number) => void;
	onComplete?: (blob: Blob) => void;
	onError?: (error: Error) => void;
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

				// Create a MediaRecorder with the captured audio stream
				const mediaRecorder = new MediaRecorder(displayMedia, {
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

				mediaRecorder.onstop = () => {
					const blob = new Blob(chunks, { type: "audio/webm" });

					// Stop all tracks to release the capture
					displayMedia.getTracks().forEach((track) => track.stop());

					options.onComplete?.(blob);
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
