# Architecture

Voiceprint is a static Next.js export. Nginx only serves generated files; it has no API routes, database, server session, or audio endpoint.

```text
microphone/file -> AudioWorklet or local decoder -> Quality Worker -> Rust/WASM DSP
                                                       |                 |
                                                       +-> UI <- ONNX Runtime Web worker/session
```

Audio samples, PCM, trajectories, embeddings, and analysis results remain in browser memory. A user-selected model is fetched as a static asset, SHA-256 checked, then stored in Cache Storage. The result share payload is compressed into the URL fragment, which HTTP requests do not send to the static host.

The source checkout keeps the model manifest empty because generated checkpoints and ONNX files are not committed. `make train-tis` and `make sync-tis-model` exercise the local ONNX pipeline only; the resulting TIS recording-condition model is not a report model and must not be deployed in the user-facing manifest. The app offers local acoustic measurements and deterministic expression rules until a purpose-specific, consented multi-rater model is available.

## Execution boundaries

| Component       | Runs in                | Persistent data                    |
| --------------- | ---------------------- | ---------------------------------- |
| Capture         | AudioWorklet           | bounded in-memory PCM only         |
| Quality and DSP | Web Worker + Rust/WASM | no persistent audio                |
| Model           | ONNX Runtime Web       | verified model Cache Storage entry |
| Downloads       | browser                | only when the user saves a file    |

WebGPU is attempted first for an installed model; ONNX Runtime Web falls back to WASM. Before inference, the model Worker uses the shared Rust/WASM band-limited resampler to derive the fixed 16 kHz model stream. The UI reports `GPU` or `CPU/WASM`, not a browser error message.
