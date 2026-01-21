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
	const analyserRef = useRef<AnalyserNode | null>(null);
	const rafRef = useRef<number | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [method, setMethod] = useState<"superdough" | null>(null);
	const [levels, setLevels] = useState<number[]>([]);
	const preRollSeconds = 0.3;

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
			const stopVisualizer = () => {
				if (rafRef.current) {
					cancelAnimationFrame(rafRef.current);
					rafRef.current = null;
				}
				if (analyserRef.current && recorderRef.current) {
					recorderRef.current.detachAnalyser(analyserRef.current);
				}
				analyserRef.current = null;
				setLevels([]);
			};

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

				const analyser = recorder.createAnalyser(1024, 0.8);
				analyserRef.current = analyser;
				const data = new Uint8Array(analyser.fftSize);
				const bars = 32;
				const updateLevels = () => {
					if (!analyserRef.current) return;
					analyser.getByteTimeDomainData(data);
					const step = Math.max(1, Math.floor(data.length / bars));
					const next = Array.from({ length: bars }, (_, index) => {
						let sum = 0;
						const start = index * step;
						const end = Math.min(data.length, start + step);
						for (let i = start; i < end; i += 1) {
							const sample = (data[i] ?? 128) - 128;
							sum += sample * sample;
						}
						const rms = Math.sqrt(sum / (end - start)) / 128;
						return Math.min(1, rms * 3);
					});
					setLevels(next);
					rafRef.current = requestAnimationFrame(updateLevels);
				};
				updateLevels();

				// Start recording
				recorder.start();

				if (preRollSeconds > 0) {
					await new Promise((resolve) =>
						setTimeout(resolve, preRollSeconds * 1000),
					);
				}

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
				stopVisualizer();
				recorder.dispose();
				restoreTapRef.current?.();
				restoreTapRef.current = null;

				const samplesToTrim = Math.floor(preRollSeconds * result.sampleRate);
				const trimBuffers = (buffers: Float32Array[], trim: number) => {
					if (trim <= 0) return buffers;
					let remaining = trim;
					const next: Float32Array[] = [];
					for (const chunk of buffers) {
						if (remaining >= chunk.length) {
							remaining -= chunk.length;
							continue;
						}
						if (remaining > 0) {
							next.push(chunk.slice(remaining));
							remaining = 0;
							continue;
						}
						next.push(chunk);
					}
					return next;
				};

				const trimmedLeft = trimBuffers(result.left, samplesToTrim);
				const trimmedRight = trimBuffers(result.right, samplesToTrim);

				// Encode to WAV
				const wavBlob = encodeToWav(trimmedLeft, trimmedRight, {
					sampleRate: result.sampleRate,
					numChannels: 2,
				});

				const trimmedSamples = trimmedLeft.reduce(
					(total, chunk) => total + chunk.length,
					0,
				);
				const trimmedDuration = trimmedSamples / result.sampleRate;
				console.debug(
					`Recording complete. Duration: ${trimmedDuration.toFixed(2)}s`,
				);
				options.onComplete?.(wavBlob);
				setIsRecording(false);
			} catch (error) {
				options.onError?.(error as Error);
				if (recorderRef.current && analyserRef.current) {
					recorderRef.current.detachAnalyser(analyserRef.current);
				}
				if (rafRef.current) {
					cancelAnimationFrame(rafRef.current);
					rafRef.current = null;
				}
				analyserRef.current = null;
				setLevels([]);
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
		if (recorderRef.current && analyserRef.current) {
			recorderRef.current.detachAnalyser(analyserRef.current);
		}
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		analyserRef.current = null;
		setLevels([]);
		restoreTapRef.current?.();
		restoreTapRef.current = null;
		setIsRecording(false);
	}, []);

	return {
		isRecording,
		method,
		startRecording,
		stopRecording,
		levels,
	};
}
