# Model card

## Status

No trained model is distributed yet. Browser results currently show only deterministic local acoustic measurements from Rust/WASM.

## Intended model boundary

The future baseline may classify dataset-specific acoustic labels after license, source format, and speaker-disjoint splitting are verified. It will not infer identity, medical status, personality, actual age, actual sex, or gender identity.

Brightness, softness, and stability require validated labels before becoming model outputs. Until then they remain measurement-derived observations, not AI predictions.
