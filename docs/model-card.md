# Model card

## Status

No trained model is distributed yet. Browser results currently show only deterministic local acoustic measurements from Rust/WASM.

## Intended model boundary

The future baseline may classify dataset-specific acoustic labels after license, source format, and speaker-disjoint splitting are verified. It will not infer identity, medical status, personality, actual age, actual sex, or gender identity.

Brightness, softness, and stability require validated labels before becoming model outputs. Until then they remain measurement-derived observations, not AI predictions.
# Model card

## Status

No trained model is distributed with this repository. `model-manifest.json` has no active model by design. The included PyTorch pipeline only accepts an approved waveform dataset whose manifest contains speaker-disjoint splits and four non-sensitive, 0–1 tendency targets: `impression`, `brightness`, `softness`, and `stability`.

The pipeline rejects biological-sex, identity, age, and speaker-name label columns before training. A Kaggle scalar-feature dataset cannot be repurposed as a waveform model or a user-facing identity/gender inference model.

## Intended use

If and only if a model passes the validation gate, it may describe the acoustic impression of a recording as a non-probabilistic tendency. It must not identify people, infer biology, diagnose a condition, or make claims about personality, emotion, or truthfulness.
