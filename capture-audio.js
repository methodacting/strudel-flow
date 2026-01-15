(async () => {
  const ctl = strudelScope.getSuperdoughAudioController();
  const ctx = ctl.audioContext;
  const master = ctl.output.destinationGain;

  // Worklet code (inline module)
  const workletCode = `
    class RecorderProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.recording = false;
        this.port.onmessage = (e) => {
          if (e.data === "start") this.recording = true;
          if (e.data === "stop") this.recording = false;
        };
      }
      process(inputs) {
        if (!this.recording) return true;
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        // Copy channels (Float32Array)
        const ch0 = input[0];
        const ch1 = input[1] || input[0]; // mono fallback
        this.port.postMessage({ ch0, ch1 }, [ch0.buffer, ch1.buffer]);
        return true;
      }
    }
    registerProcessor("recorder-processor", RecorderProcessor);
  `;

  const blob = new Blob([workletCode], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);

  const recNode = new AudioWorkletNode(ctx, "recorder-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
    channelCountMode: "explicit",
  });

  // Route: master -> recorder -> speakers (passthrough)
  // (If you don't want to change routing, you can just connect master->recNode and recNode->destination,
  // but avoid double-connecting master to destination.)
  try { master.disconnect(); } catch { }
  master.connect(recNode);
  recNode.connect(ctx.destination);

  // Buffer store
  const left = [];
  const right = [];
  let frames = 0;
  const sampleRate = ctx.sampleRate;

  recNode.port.onmessage = (e) => {
    const { ch0, ch1 } = e.data;
    left.push(new Float32Array(ch0));
    right.push(new Float32Array(ch1));
    frames += left[left.length - 1].length;
  };

  function floatTo16BitPCM(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function writeWav({ left, right, sampleRate }) {
    // Interleave stereo
    const total = left.reduce((n, a) => n + a.length, 0);
    const interleaved = new Int16Array(total * 2);
    let o = 0;

    for (let i = 0; i < left.length; i++) {
      const L = floatTo16BitPCM(left[i]);
      const R = floatTo16BitPCM(right[i]);
      for (let j = 0; j < L.length; j++) {
        interleaved[o++] = L[j];
        interleaved[o++] = R[j];
      }
    }

    const byteRate = sampleRate * 2 * 2; // sr * channels * bytesPerSample
    const blockAlign = 2 * 2;            // channels * bytesPerSample
    const dataSize = interleaved.byteLength;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(off, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
    }

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);        // PCM chunk size
    view.setUint16(20, 1, true);         // PCM
    view.setUint16(22, 2, true);         // channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);        // bits
    writeString(36, "data");
    view.setUint32(40, dataSize, true);

    // PCM data
    new Uint8Array(buffer, 44).set(new Uint8Array(interleaved.buffer));

    return new Blob([buffer], { type: "audio/wav" });
  }

  // Controls
  window.__sdWav = {
    start() {
      left.length = 0; right.length = 0; frames = 0;
      recNode.port.postMessage("start");
      console.log("WAV recording started");
    },
    stop() {
      recNode.port.postMessage("stop");
      const blob = writeWav({ left, right, sampleRate });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "strudel.wav";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const seconds = frames / sampleRate;
      console.log(`WAV saved. Duration ~${seconds.toFixed(2)}s`);
    },
  };

  console.log("Ready. Use __sdWav.start() and __sdWav.stop()");
})();

