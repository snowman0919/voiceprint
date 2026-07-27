# Validation

## Current automated evidence

- Rust DSP tests validate F0, silence handling, centroid, periodic/noise HNR gating, and band-limited resampling behavior.
- Python tests reject unlabeled/unsafe data routes and speaker leakage in deterministic split assignment.
- Browser unit tests prevent PCM/waveform fields from downloads and share payloads, and validate ONNX WebGPU→WASM fallback ordering.
- Playwright loads a real local WAV, runs analysis, and asserts that no POST/PUT/PATCH request is made and every observed request remains on the local static origin.
- CI builds the static export, installs Chromium for the browser flow, and builds the multi-stage Docker image.

## Before publishing a trained model

1. Audit the exact dataset version and license; stop if redistribution or model use is unclear.
2. Confirm speaker-disjoint train/validation/test splits and no duplicate-source leakage.
3. Evaluate each target against held-out speakers, including calibration and subgroup caveats supported by approved metadata.
4. Compare browser preprocessing and ONNX outputs against the reference Python pipeline within stated tolerances.
5. Run browser inference on WebGPU and WASM paths, then record latency, memory, and fallback rate.
6. Add model hash, input contract, known limitations, and validation metrics to the model card before populating `model-manifest.json`.
