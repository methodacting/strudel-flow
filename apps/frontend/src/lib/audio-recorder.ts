/**
 * Audio recorder using Superdough's AudioWorklet for direct audio capture
 * Records directly from the Strudel audio engine without requiring screen capture
 */

export interface AudioRecorderCallbacks {
	onProgress?: (remaining: number) => void;
}

export interface AudioRecorderResult {
	left: Float32Array[];
	right: Float32Array[];
	sampleRate: number;
	duration: number;
}

/**
 * AudioWorklet processor code for recording audio
 * This runs in a separate thread to process audio in real-time
 */
const RECORDER_PROCESSOR_CODE = `
	class RecorderProcessor extends AudioWorkletProcessor {
		constructor() {
			super();
			this.recording = false;
			this.port.onmessage = (e) => {
				if (e.data === "start") this.recording = true;
				if (e.data === "stop") this.recording = false;
			};
		}

		process(inputs, outputs, parameters) {
			if (!this.recording) return true;
			const input = inputs[0];
			if (!input || input.length === 0) return true;

			// Copy channels (transferable Float32Array for efficiency)
			const ch0 = input[0];
			const ch1 = input[1] || input[0]; // Mono fallback

			// Clone the buffers since we're transferring them
			this.port.postMessage(
				{ ch0: ch0.slice(), ch1: ch1.slice() },
				[],
			);

			return true;
		}
	}

	registerProcessor("recorder-processor", RecorderProcessor);
`;

/**
 * Audio recorder class that manages the AudioWorklet and buffer collection
 */
export class AudioRecorder {
	private audioContext: AudioContext;
	private recorderNode: AudioWorkletNode | null = null;
	private masterGain: GainNode | null = null;
	private sinkGain: GainNode | null = null;
	private buffers: { left: Float32Array[]; right: Float32Array[] } = {
		left: [],
		right: [],
	};
	private isRecording = false;
	private sampleRate: number;
	private frames = 0;

	/**
	 * Create a new AudioRecorder
	 * @param audioContext - The Web Audio context to use
	 * @param masterGain - The master gain node to connect to (Superdough output)
	 */
	constructor(audioContext: AudioContext, masterGain: GainNode) {
		this.audioContext = audioContext;
		this.masterGain = masterGain;
		this.sampleRate = audioContext.sampleRate;
	}

	/**
	 * Initialize the AudioWorklet processor
	 */
	async initialize(): Promise<void> {
		// Create the AudioWorklet processor from inline code
		const blob = new Blob([RECORDER_PROCESSOR_CODE], {
			type: "application/javascript",
		});
		const url = URL.createObjectURL(blob);

		try {
			await this.audioContext.audioWorklet.addModule(url);
		} finally {
			URL.revokeObjectURL(url);
		}

		// Create the recorder node
		this.recorderNode = new AudioWorkletNode(this.audioContext, "recorder-processor", {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 2,
			channelCountMode: "explicit",
		});
		this.sinkGain = new GainNode(this.audioContext, {
			gain: 0,
			channelCount: 2,
			channelCountMode: "explicit",
		});

		// Set up message handler to receive audio data
		this.recorderNode.port.onmessage = (e: MessageEvent) => {
			if (!this.isRecording) return;

			const { ch0, ch1 } = e.data;
			this.buffers.left.push(new Float32Array(ch0));
			this.buffers.right.push(new Float32Array(ch1));
			this.frames += this.buffers.left[this.buffers.left.length - 1].length;
		};
	}

	/**
	 * Start recording audio
	 * Routes audio: master -> recorder -> silent sink
	 */
	start(): void {
		if (!this.recorderNode || !this.masterGain || !this.sinkGain) {
			throw new Error("AudioRecorder not initialized. Call initialize() first.");
		}

		if (this.isRecording) return;

		// Clear previous buffers
		this.buffers.left.length = 0;
		this.buffers.right.length = 0;
		this.frames = 0;

		// Route: master -> recorder -> silent sink -> destination
		this.masterGain.connect(this.recorderNode);
		this.recorderNode.connect(this.sinkGain);
		this.sinkGain.connect(this.audioContext.destination);

		// Start the processor
		this.recorderNode.port.postMessage("start");
		this.isRecording = true;

		console.log("AudioRecorder: Recording started");
	}

	/**
	 * Stop recording and return the captured audio
	 * @returns The recorded audio data
	 */
	stop(): AudioRecorderResult {
		if (!this.recorderNode) {
			throw new Error("AudioRecorder not initialized.");
		}

		if (!this.isRecording) {
			throw new Error("Not currently recording");
		}

		// Stop the processor
		this.recorderNode.port.postMessage("stop");
		this.isRecording = false;

		// Disconnect the recorder tap
		try {
			this.recorderNode.disconnect();
		} catch {
			// Ignore
		}
		try {
			this.masterGain?.disconnect(this.recorderNode);
		} catch {
			// Ignore
		}
		try {
			this.sinkGain?.disconnect();
		} catch {
			// Ignore
		}

		const duration = this.frames / this.sampleRate;
		console.log(`AudioRecorder: Recording stopped. Duration: ${duration.toFixed(2)}s`);

		return {
			left: this.buffers.left,
			right: this.buffers.right,
			sampleRate: this.sampleRate,
			duration,
		};
	}

	/**
	 * Get the current recording state
	 */
	getIsRecording(): boolean {
		return this.isRecording;
	}

	/**
	 * Get the current duration in seconds
	 */
	getCurrentDuration(): number {
		return this.frames / this.sampleRate;
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		if (this.recorderNode) {
			try {
				this.recorderNode.disconnect();
			} catch {
				// Ignore
			}
			this.recorderNode = null;
		}
		if (this.sinkGain) {
			try {
				this.sinkGain.disconnect();
			} catch {
				// Ignore
			}
			this.sinkGain = null;
		}
		this.isRecording = false;
	}
}

/**
 * ============================================================================
 * IMPORTANT: WE ARE NOT USING THE SCREEN CAPTURE API
 * ============================================================================
 *
 * This file MUST use only Strudel's internal audio system.
 * NO getDisplayMedia, NO MediaRecorder with screen capture.
 * ONLY direct Web Audio API integration with Superdough.
 *
 * Based on the debug logs, we know:
 * - strudelScope.dough() calls: vr.node.connect(t.destination)
 * - There's a global 'vr' variable with a .node property
 * - This is the actual output node we need to tap into
 *
 * The challenge: accessing this internal variable from published @strudel/web
 */
type StrudelTapHandle = {
	audioContext: AudioContext;
	tapNode: GainNode;
	restoreTap: () => void;
};

let connectPatchInstalled = false;
const capturedOutputs = new WeakMap<AudioContext, AudioNode>();

export function installAudioOutputCapture(): void {
	if (connectPatchInstalled) return;
	connectPatchInstalled = true;

	const originalConnect = AudioNode.prototype.connect;
	AudioNode.prototype.connect = function (...args: unknown[]) {
		const destination = args[0];
		if (destination instanceof AudioDestinationNode) {
			const ctx = destination.context;
			const existing = capturedOutputs.get(ctx);
			if (!existing) {
				capturedOutputs.set(ctx, this);
			}
		}
		return originalConnect.apply(this, args as Parameters<AudioNode["connect"]>);
	};
}

function getCapturedOutputNode(audioContext: AudioContext): AudioNode | null {
	return capturedOutputs.get(audioContext) ?? null;
}

let tapState: {
	audioContext: AudioContext;
	tapNode: GainNode;
	outputNode: AudioNode;
	restoreTap: () => void;
} | null = null;

function getStrudelAudioContext(): AudioContext {
	// @ts-expect-error - strudelScope is a global exposed by @strudel/web
	const strudelScope = window.strudelScope;
	if (!strudelScope) {
		throw new Error(
			"Strudel scope not found. Make sure @strudel/web is initialized.",
		);
	}

	const audioContext = strudelScope.getAudioContext?.();
	if (!audioContext) {
		throw new Error(
			"AudioContext not found. Make sure Strudel is initialized with audio.",
		);
	}

	return audioContext;
}

async function waitForOutputCapture(
	audioContext: AudioContext,
	maxAttempts = 40,
	delayMs = 50,
): Promise<AudioNode> {
	let warned = false;
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const outputNode = getCapturedOutputNode(audioContext);
		if (outputNode) return outputNode;
		if (!warned && attempt >= 10) {
			console.warn(
				"AudioRecorder: waiting for Strudel output node capture. " +
				"Start playback if audio is not running yet.",
			);
			warned = true;
		}
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	throw new Error(
		"Strudel output node not captured. Start playback and try again.",
	);
}

export async function installStrudelTap(): Promise<StrudelTapHandle> {
	// @ts-expect-error - strudelScope is a global exposed by @strudel/web
	const strudelScope = window.strudelScope as Record<string, unknown> | undefined;
	if (!strudelScope) {
		throw new Error(
			"Strudel scope not found. Make sure @strudel/web is initialized.",
		);
	}

	const audioContext = getStrudelAudioContext();

	if (tapState && tapState.audioContext === audioContext) {
		return {
			audioContext: tapState.audioContext,
			tapNode: tapState.tapNode,
			restoreTap: tapState.restoreTap,
		};
	}

	const outputNode = await waitForOutputCapture(audioContext);
	if (!outputNode) {
		throw new Error(
			"Strudel output not captured. Start playback and try again.",
		);
	}

	const tapNode = new GainNode(audioContext, {
		gain: 1,
		channelCount: 2,
		channelCountMode: "explicit",
	});
	let restored = false;

	try {
		outputNode.connect(tapNode);
	} catch (error) {
		console.warn("AudioRecorder: failed to connect Strudel output to tap", error);
	}

	const restoreTap = () => {
		if (restored) return;
		try {
			outputNode.disconnect(tapNode);
		} catch {
			// Ignore
		}
		restored = true;
	};

	tapState = { audioContext, tapNode, outputNode, restoreTap };

	return {
		audioContext,
		tapNode,
		restoreTap,
	};
}

/**
 * Create an AudioRecorder instance from the Superdough audio engine
 * This is the main entry point for recording
 */
export async function createSuperdoughRecorder(): Promise<{
	recorder: AudioRecorder;
	restoreTap: () => void;
}> {
	const controller = await installStrudelTap();
	const audioContext = controller.audioContext;
	const masterGain = controller.tapNode;

	const recorder = new AudioRecorder(audioContext, masterGain);
	await recorder.initialize();

	return {
		recorder,
		restoreTap: controller.restoreTap,
	};
}

/**
 * Wait until the next cycle start before executing a callback
 * @param cpm - Cycles per minute
 * @param bpc - Beats per cycle
 * @returns Promise that resolves at the next cycle start
 */
export async function waitForCycleStart(cpm: number, bpc: number): Promise<void> {
	// @ts-expect-error - strudelScope is a global exposed by @strudel/web
	const strudelScope = window.strudelScope;
	if (!strudelScope) {
		throw new Error("Strudel scope not found");
	}

	const audioContext = strudelScope.getAudioContext?.();
	if (!audioContext) {
		throw new Error("AudioContext not found");
	}

	// Calculate cycle duration in seconds
	const cycleDuration = (60 / cpm) * bpc;

	// Get current audio time
	const currentTime = audioContext.currentTime;

	// Calculate when the next cycle starts
	const nextCycleStart = Math.ceil(currentTime / cycleDuration) * cycleDuration;
	const waitTime = nextCycleStart - currentTime;

	// Wait until the next cycle start
	if (waitTime > 0) {
		console.log(`Waiting ${waitTime.toFixed(3)}s for next cycle start...`);
		await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
	}

	console.log("Cycle start reached, beginning recording");
}
