import { useCallback, useRef, useState } from "react";
import { evaluate, hush } from "@strudel/web";
import { createSuperdoughRecorder, AudioRecorder, waitForCycleStart } from "@/lib/audio-recorder";
import { encodeToWav } from "@/lib/wav-encoder";
import { useStrudelStore } from "@/store/strudel-store";

export interface AudioExportOptions {
	duration: number; // in seconds
	cpm?: number; // cycles per minute (for cycle sync)
	bpc?: number; // beats per cycle (for cycle sync)
	syncToCycle?: boolean; // whether to wait for cycle start before recording
	onProgress?: (remaining: number) => void;
	onComplete?: (blob: Blob) => void;
	onError?: (error: Error) => void;
}

/**
 * Record audio using Superdough's direct audio output
 *
 * This method records directly from the Strudel/Superdough audio engine
 * using an AudioWorklet, which provides:
 * - No browser permission dialog
 * - Accurate duration metadata
 * - Better audio quality (no re-encoding)
 * - Reproducible results
 */
export function useAudioExport() {
	const recorderRef = useRef<AudioRecorder | null>(null);
	const restoreTapRef = useRef<(() => void) | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [method, setMethod] = useState<"superdough" | null>(null);

	const reconnectAudioGraph = useCallback(() => {
		const pattern = useStrudelStore.getState().pattern;
		if (!pattern || !pattern.trim()) return;

		try {
			hush();
		} catch (error) {
			console.warn("AudioExport: hush failed", error);
		}

		try {
			evaluate(pattern);
		} catch (error) {
			console.warn("AudioExport: evaluate failed", error);
		}
	}, []);

	const startRecording = useCallback(
		async (options: AudioExportOptions) => {
			try {
				setIsRecording(true);

				// Wait for cycle start if sync is enabled
				if (options.syncToCycle && options.cpm && options.bpc) {
					await waitForCycleStart(options.cpm, options.bpc);
				}

				const { recorder, restoreTap } = await createSuperdoughRecorder();
				recorderRef.current = recorder;
				restoreTapRef.current = restoreTap;
				setMethod("superdough");

				// Force a reconnect so the output chain is active when recording starts
				reconnectAudioGraph();
				await new Promise((resolve) => setTimeout(resolve, 0));

				// Start recording
				recorder.start();

				// Progress updates
				const startTime = Date.now();
				const updateProgress = () => {
					if (!recorder.getIsRecording()) return;

					const elapsed = (Date.now() - startTime) / 1000;
					const remaining = Math.max(0, options.duration - elapsed);
					options.onProgress?.(remaining);

					if (remaining > 0) {
						requestAnimationFrame(updateProgress);
					}
				};

				requestAnimationFrame(updateProgress);

				// Wait for the duration
				await new Promise((resolve) => setTimeout(resolve, options.duration * 1000));

				// Stop recording and get the audio data
				const result = recorder.stop();
				recorder.dispose();
				restoreTapRef.current?.();
				restoreTapRef.current = null;

				// Encode to WAV
				const wavBlob = encodeToWav(result.left, result.right, {
					sampleRate: result.sampleRate,
					numChannels: 2,
				});

				console.log(`Recording complete. Duration: ${result.duration.toFixed(2)}s`);
				options.onComplete?.(wavBlob);
				setIsRecording(false);
			} catch (error) {
				options.onError?.(error as Error);
				restoreTapRef.current?.();
				restoreTapRef.current = null;
				setIsRecording(false);
				setMethod(null);
			}
		},
		[reconnectAudioGraph],
	);

	const stopRecording = useCallback(() => {
		if (recorderRef.current?.getIsRecording()) {
			recorderRef.current.stop();
			recorderRef.current.dispose();
		}
		restoreTapRef.current?.();
		restoreTapRef.current = null;
		setIsRecording(false);
	}, []);

	return {
		isRecording,
		method,
		startRecording,
		stopRecording,
	};
}
