# Architecture

Voiceprint is a static Next.js export served by Nginx. A separate same-origin result service is optional for personal use; it has no audio endpoint and persists scalar result records in SQLite.

```text
microphone/file -> AudioWorklet or local decoder -> Quality Worker -> Rust/WASM DSP
                                                       |                 |
                                                       +-> UI <- ONNX Runtime Web worker/session
                                                       |
                                                       +-> scalar result API -> SQLite (optional)
```

Audio samples, PCM, trajectories, and embeddings remain in browser memory and are discarded after analysis. A user-selected model is fetched as a static asset, SHA-256 checked, then stored in Cache Storage. When the optional personal-result service is enabled, only the displayed scalar measurements are persisted; the share secret remains in the URL fragment while the result stays in SQLite.

The source checkout includes the verified `tis-intent-v1.onnx` static artifact so deployment packaging and ONNX Runtime Web compatibility can be checked. It has `reportEligible: false`, `activeModel: null`, and is never loaded for or shown in a user report: its recording-condition label does not match the product report. The app offers local acoustic measurements and deterministic expression rules until a purpose-specific, consented multi-rater model is available.

## Execution boundaries

| Component       | Runs in                | Persistent data                    |
| --------------- | ---------------------- | ---------------------------------- |
| Capture         | AudioWorklet           | bounded in-memory PCM only         |
| Quality and DSP | Web Worker + Rust/WASM | no persistent audio                |
| Model           | ONNX Runtime Web       | verified model Cache Storage entry |
| Downloads       | browser                | only when the user saves a file    |
| Result service  | Node.js + SQLite       | scalar result for 365 days only    |

WebGPU is attempted first for an installed model; ONNX Runtime Web falls back to WASM. Before inference, the model Worker uses the shared Rust/WASM band-limited resampler to derive the fixed 16 kHz model stream. The UI reports `GPU` or `CPU/WASM`, not a browser error message.
