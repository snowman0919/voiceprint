# Data card

## Proposed source

- Dataset: `murtadhanajim/gender-recognition-by-voiceoriginal`
- URL: https://www.kaggle.com/datasets/murtadhanajim/gender-recognition-by-voiceoriginal
- Intended use: baseline acoustic classification only.

## Current status

No dataset has been downloaded in this repository. Kaggle credentials were unavailable during initial setup, so license, file structure, source audio presence, speaker IDs, label distribution, duplicates, and redistribution terms are unverified.

Training is deliberately blocked until `make data-kaggle` and `make data-audit` complete and the resulting audit contains a declared license. If the audit reports `scalar_only`, only handcrafted-feature baselines may proceed; log-Mel CNN and hybrid waveform training remain blocked.

For a waveform dataset, the audit records SHA-256 per audio file, duplicate-content groups, WAV sample-rate/channel distributions, per-file WAV duration, unreadable WAV files, and any `label` class balance. Duplicate or unreadable WAV content blocks training before speaker-disjoint splitting.

## Label limitation

Any `male`/`female` speaker label is not a perceived voice-impression label. It must never be presented as actual sex, gender identity, or a probability of either. A validated perceived-impression model needs separately licensed multi-rater data.
