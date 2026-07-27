# Validation

## Current automated evidence

- Rust DSP tests validate F0, silence handling, 25 ms/10 ms STFT tonal-bin placement and epsilon flooring, centroid, periodic/noise HNR gating, and band-limited resampling behavior.
- Python tests reject unlabeled/unsafe data routes and speaker leakage in deterministic split assignment.
- Browser unit tests prevent PCM/waveform fields from downloads and share payloads, and validate ONNX WebGPU→WASM fallback ordering.
- Playwright loads a real local WAV, renders the actual Worker/WASM waveform and log-power spectrogram, and asserts that no POST/PUT/PATCH request is made and every observed request remains on the local static origin.
- A model-injected local build may warm the hash-verified TIS ONNX pipeline, retains the same no-external-request assertion, and verifies that the baseline does not appear in the user report.
- CI builds the static export, installs Chromium for the browser flow, and builds the multi-stage Docker image.

## DSP benchmark

`make benchmark-dsp` measures F0, HNR, and a 1024-point spectrum on an 80 ms 24 kHz periodic frame. Record the machine, browser/WASM version when applicable, and benchmark output when comparing releases; do not compare optimized native timings directly with browser timings.

## TIS v1 validation record

- Dataset audit: 1,151 readable 48 kHz mono WAVs, 96 speakers, zero exact-content duplicate groups; the public paper declares 1,152 files and the one-file discrepancy is documented in the data card.
- Evaluation: seed `20260728`, validation-selected epoch 5, held-out 10-speaker test set (120 clips): AUROC 0.814, average precision 0.809, balanced accuracy 0.667 at threshold 0.5.
- Export: ONNX Runtime CPU and PyTorch have a maximum absolute output difference of `7.99e-9` on the deterministic parity input.
- Browser: the model is worker-only, uses WebGPU then WASM fallback, and averages no more than three four-second local windows.

## Before publishing a new trained model

1. Audit the exact dataset version and license; stop if redistribution or model use is unclear.
2. Confirm speaker-disjoint train/validation/test splits and no duplicate-source leakage.
3. Evaluate each target against held-out speakers, including calibration and subgroup caveats supported by approved metadata.
4. Compare browser preprocessing and ONNX outputs against the reference Python pipeline within stated tolerances.
5. Run browser inference on WebGPU and WASM paths, then record latency, memory, and fallback rate.
6. Add model hash, input contract, known limitations, and validation metrics to the model card before populating `model-manifest.json`.
