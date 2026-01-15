## Strudel Flow Audio Export (Tap-Based)

This project records Strudel audio by tapping the Web Audio graph directly.
No screen capture API is used.

### Why this exists

Strudel's `@strudel/web` bundle does not expose a concrete output AudioNode.
There is no stable public API that returns the Superdough output node.
To record what you hear, we capture the node that connects to the
`AudioDestinationNode` and attach a parallel tap.

### How it works

1. **Capture the output node**
   - Early in app startup, `installAudioOutputCapture()` patches
     `AudioNode.prototype.connect`.
   - The first time any node connects to an `AudioDestinationNode`, we store
     that node as the output node for that `AudioContext`.

2. **Install the tap when recording starts**
   - `installStrudelTap()` waits until the output node exists.
   - It creates a `GainNode` tap and connects the output node to it in
     parallel (audio continues to the speakers normally).

3. **Record via AudioWorklet**
   - An `AudioWorkletProcessor` collects Float32 audio frames from the tap.
   - Frames are encoded into a WAV file with accurate duration metadata.

### Files involved

- `apps/frontend/src/main.tsx`
  - Calls `installAudioOutputCapture()` before React renders.
- `apps/frontend/src/lib/audio-recorder.ts`
  - Captures the output node and manages the tap.
  - Implements the AudioWorklet recorder and WAV encoding pipeline.
- `apps/frontend/src/hooks/use-audio-export.ts`
  - Orchestrates recording and handles duration/progress.

### AudioWorklet + WAV details

- **AudioWorklet** runs on the audio thread and copies per‑buffer
  `Float32Array` chunks into JS via `postMessage`.
- Chunks are buffered in memory during recording and counted for duration.
- WAV encoding is done in `apps/frontend/src/lib/wav-encoder.ts`:
  - 16‑bit PCM interleaved stereo
  - Proper RIFF headers so duration is accurate in players

### Duration sync

- `useAudioExport` can wait for the next cycle start
  (using CPM/BPC) before recording.
- Recording length is controlled by a fixed timeout and the
  captured frame count is used to compute the final duration.

### Export call flow

1. User clicks Export
2. `useAudioExport.startRecording`
3. Wait for cycle start (optional)
4. `installStrudelTap` waits for output node
5. AudioWorklet starts capturing from tap
6. Stop after duration; encode WAV
7. Upload and return share link

### Notes

- The tap is **parallel**, so you can hear playback while recording.
- If recording ever returns silence, the output node likely wasn't captured
  (e.g. playback never started). Start playback and retry.

### Troubleshooting

- **Silent WAV**
  - Start playback before exporting so the output node connects.
  - Hard reload if the audio graph was created before the capture hook ran.
- **Export error: output not captured**
  - Ensure playback has started at least once.
  - Verify `installAudioOutputCapture()` runs before `initStrudel()`.
