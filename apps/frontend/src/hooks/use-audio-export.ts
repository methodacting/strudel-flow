import { useCallback, useRef, useState } from "react";

// MediaStreamDestination is a Web Audio API type
interface MediaStreamDestination extends AudioNode {
	stream: MediaStream;
}

declare global {
	interface AudioContext {
		createMediaStreamDestination(): MediaStreamDestination;
	}
}

export interface AudioExportOptions {
	duration: number; // in seconds
	onProgress?: (remaining: number) => void;
	onComplete?: (blob: Blob) => void;
	onError?: (error: Error) => void;
}

export function useAudioExport() {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamDestinationRef = useRef<MediaStreamDestination | null>(null);
	const [isRecording, setIsRecording] = useState(false);

	const startRecording = useCallback(
		async (
			audioContext: AudioContext,
			sourceNode: AudioNode,
			options: AudioExportOptions,
		) => {
			try {
				setIsRecording(true);

				// Create stream destination
				const streamDestination =
					audioContext.createMediaStreamDestination();
				streamDestinationRef.current = streamDestination;

				// Connect source to stream destination
				sourceNode.connect(streamDestination);

				// Create media recorder
				const mediaRecorder = new MediaRecorder(streamDestination.stream, {
					mimeType: "audio/webm",
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
					options.onComplete?.(blob);
					setIsRecording(false);

					// Cleanup
					sourceNode.disconnect(streamDestination);
				};

				// Start recording
				mediaRecorder.start();

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
				options.onError?.(error as Error);
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
