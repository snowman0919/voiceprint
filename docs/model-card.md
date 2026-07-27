# Model card

## Status

`make train-tis` trains a local TIS v1 model, and `make sync-tis-model` exports a browser-ready ONNX artifact and creates its SHA-256 manifest. Checkpoints, source audio, and generated ONNX files are intentionally excluded from Git. A release/deployment build must run these commands before the static Next.js build.

The recorded local run used Apple Metal with seed `20260728`. It selected epoch 5 by validation AUROC. On the held-out 10-speaker test partition (120 clips), it measured AUROC 0.814, average precision 0.809, balanced accuracy 0.667 at the fixed 0.5 threshold, macro F1 0.644, and 10-bin expected calibration error 0.149. ONNX Runtime CPU output matched PyTorch with a maximum absolute error of `7.99e-9` for the deterministic parity input.

The exported fixed four-second model has 163,369 parameters and a 658,960-byte ONNX artifact. In the recorded local CPU validation, mean warm ONNX Runtime CPU inference was 0.82 ms across 20 runs. This is a native CPU measurement, not a WebGPU, WASM, or mobile-browser claim.

For context, `make evaluate-tis` ran speaker-disjoint handcrafted baselines on the identical held-out speakers: Logistic Regression AUROC 0.566 / balanced accuracy 0.550, RBF SVM 0.559 / 0.492, and Random Forest 0.577 / 0.542. These are one local run on a small corpus, not evidence of general-purpose intent inference.

## Label and use boundary

TIS v1's only output is a score for the dataset's **speaker-produced trustworthy-intent recording condition**, averaged over up to three four-second local windows. It is not a probability, listener rating, truthfulness detector, personality assessment, or a claim about the person speaking. It is trained on short English research recordings and should not be generalized beyond that setting.

Brightness, softness, stability, identity, sex, age, medical status, personality, and actual intent are not TIS model outputs. The general pipeline rejects biological-sex, identity, age, and speaker-name label columns before training. A Kaggle scalar-feature dataset cannot be repurposed as a waveform model or a user-facing identity/gender inference model.

## Browser execution

The model is downloaded as a static asset, hash-verified, placed in Cache Storage, and loaded only by a Web Worker. The worker prefers WebGPU and falls back to ONNX Runtime Web WASM. The audio buffer and model output remain in browser memory and are not placed in the share fragment.
