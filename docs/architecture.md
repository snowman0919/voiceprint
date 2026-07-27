# Architecture

Voiceprint is a static Next.js export. Nginx only serves generated files; it has no API routes, database, server session, or audio endpoint.

```text
microphone/file -> AudioWorklet or local decoder -> Quality Worker -> Rust/WASM DSP
                                                       |                 |
                                                       +-> UI <- ONNX Runtime Web worker/session
```

Audio samples, PCM, trajectories, embeddings, and analysis results remain in browser memory. A user-selected model is fetched as a static asset, SHA-256 checked, then stored in Cache Storage. The result share payload is compressed into the URL fragment, which HTTP requests do not send to the static host.

The model manifest is intentionally empty until an approved dataset, reproducible checkpoint, ONNX export, checksum, and validation record exist. The app still offers local acoustic measurements without presenting them as a trained impression model.

## Execution boundaries

| Component | Runs in | Persistent data |
| --- | --- | --- |
| Capture | AudioWorklet | bounded in-memory PCM only |
| Quality and DSP | Web Worker + Rust/WASM | no persistent audio |
| Model | ONNX Runtime Web | verified model Cache Storage entry |
| Downloads | browser | only when the user saves a file |

WebGPU is attempted first for an installed model; ONNX Runtime Web falls back to WASM. The UI reports `GPU` or `CPU/WASM`, not a browser error message.
