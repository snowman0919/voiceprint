# Data card

## Proposed source

- Dataset: `murtadhanajim/gender-recognition-by-voiceoriginal`
- URL: https://www.kaggle.com/datasets/murtadhanajim/gender-recognition-by-voiceoriginal
- Intended use: baseline acoustic classification only.

## Current status

### Download audit: 2026-07-28

The declared Kaggle archive was downloaded locally with `make data-kaggle`; it is ignored by Git and is not in the Docker image. The public download command reported `Apache-2.0`, but the archive contains no `dataset-metadata.json` and the authenticated Kaggle metadata endpoint was unavailable in this environment. Therefore the exact license text, provenance, and redistribution/model-use terms are not yet recorded as verifiable local evidence.

`make data-audit` found 16,148 mono 16 kHz WAV files and no unreadable WAV files. It found 1,078 exact-content duplicate groups containing 2,156 files. The directory labels are `male` and `female`; they are not perceived voice-impression labels. No trusted speaker manifest was found.

Training remains blocked: first preserve authenticated Kaggle metadata and upstream license terms, remove or group duplicates by source speaker, establish speaker IDs, and obtain labels appropriate for the claimed output. The full local audit artifact contains per-file hashes and is intentionally not committed.

Training is deliberately blocked until `make data-kaggle` and `make data-audit` complete and the resulting audit contains a declared license. If the audit reports `scalar_only`, only handcrafted-feature baselines may proceed; log-Mel CNN and hybrid waveform training remain blocked.

For a waveform dataset, the audit records SHA-256 per audio file, duplicate-content groups, WAV sample-rate/channel distributions, per-file WAV duration, unreadable WAV files, and any `label` class balance. Duplicate or unreadable WAV content blocks training before speaker-disjoint splitting.

## Label limitation

Any `male`/`female` speaker label is not a perceived voice-impression label. It must never be presented as actual sex, gender identity, or a probability of either. A validated perceived-impression model needs separately licensed multi-rater data.
