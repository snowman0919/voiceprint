# Data card

## Proposed source

- Dataset: `murtadhanajim/gender-recognition-by-voiceoriginal`
- URL: https://www.kaggle.com/datasets/murtadhanajim/gender-recognition-by-voiceoriginal
- Intended use: baseline acoustic classification only.

## Current status

### Licensed bounded-label source: 2026-07-28

- Dataset: _Human voices communicating trustworthy intent: A demographically diverse speech audio dataset_ (TIS)
- Official source: https://osf.io/45d8j/
- License: CC BY 4.0, declared by the dataset README for the project, WAVs, and CSV files.
- Citation: Maltezou-Papastylianou, C., Scherer, R. & Paulmann, S. (2025). _Scientific Data_, 12, 921. https://doi.org/10.1038/s41597-025-05267-3
- Contents declared by the accompanying publication: 1,152 English, 48 kHz mono WAVs from 96 speakers, with each speaker recording neutral and speaker-produced trustworthy-intent utterances.

`make data-tis` retrieves this corpus directly from the official OSF node into ignored local storage. `make data-tis-audit` and `make split-tis` respectively record content integrity and produce a speaker-disjoint split. The label is a recording condition — a speaker's attempted trustworthy intent — not listener-rated general trustworthiness, personality, or a trait of the person speaking. It may only support a model and UI wording scoped to that recording condition; it cannot validate the app's broader voice-impression outputs.

The download audit found 1,151 WAV files currently exposed by the OSF node (one fewer than the publication's declared 1,152): all are readable 48 kHz mono audio, with no exact-content duplicates. The official CSV metadata yields 96 speaker IDs. The intent balance is 575 `trustworthy` and 576 `neutral`; each speaker contributes 11–12 recordings. The generated speaker-disjoint split assigns 76 speakers/911 recordings to training, 10/120 to validation, and 10/120 to test. The audit has no waveform-training blocker. The one-file discrepancy is recorded rather than silently filled or inferred.

### Download audit: 2026-07-28

The declared Kaggle archive was downloaded locally with `make data-kaggle`; it is ignored by Git and is not in the Docker image. The [public Kaggle listing](https://www.kaggle.com/datasets/murtadhanajim/gender-recognition-by-voiceoriginal) and download command report `Apache-2.0` (accessed 2026-07-28). The listing also says the source was obtained online through a reference link; the archive contains no `dataset-metadata.json` and the authenticated Kaggle metadata endpoint was unavailable in this environment. Therefore the upstream source license, provenance, and redistribution/model-use terms are not yet independently recorded as verifiable evidence.

`make data-audit` found 16,148 mono 16 kHz WAV files and no unreadable WAV files. It found 1,078 exact-content duplicate groups containing 2,156 files. The directory labels are `male` and `female`; they are not perceived voice-impression labels. No trusted speaker manifest was found.

Training remains blocked: first preserve authenticated Kaggle metadata and upstream license terms, remove or group duplicates by source speaker, establish speaker IDs, and obtain labels appropriate for the claimed output. The full local audit artifact contains per-file hashes and is intentionally not committed.

Training is deliberately blocked until `make data-kaggle` and `make data-audit` complete and the resulting audit contains a declared license. If the audit reports `scalar_only`, only handcrafted-feature baselines may proceed; log-Mel CNN and hybrid waveform training remain blocked.

For a waveform dataset, the audit records SHA-256 per audio file, duplicate-content groups, WAV sample-rate/channel distributions, per-file WAV duration, unreadable WAV files, and any `label` class balance. Duplicate or unreadable WAV content blocks training before speaker-disjoint splitting.

## Label limitation

Any `male`/`female` speaker label is not a perceived voice-impression label. It must never be presented as actual sex, gender identity, or a probability of either. A validated perceived-impression model needs separately licensed multi-rater data.

## Investigated but not approved

### LibriTTS-VI

The official [Sony LibriTTS-VI repository](https://github.com/sony/LibriTTS-VI) publishes 130 utterances with four professional raters across ten subjective voice-impression scales, plus estimated 11-dimensional values for LibriTTS-R. This is a promising source for a future, more specific impression model. However, its repository has no declared license, and the underlying LibriTTS-R audio has separate provenance and terms. Therefore it has not been downloaded or used for training. Estimated labels also must not be presented as equivalent to the 130 manually rated examples.

Additional voice-impression candidates are audited but excluded unless their provenance meets the report-model gate. [TTS-AGI voice-annotation-data-v2](https://huggingface.co/datasets/TTS-AGI/voice-annotation-data-v2) declares CC BY 4.0 and exposes 18.6k clips with taxonomy labels, including a perceived-gender dimension. Its card does not establish the source-speaker provenance, speaker grouping, or consented multi-rater agreement needed for a held-out-speaker report model, so it has not been downloaded or trained. [LAION reference AI voices with timbre annotations](https://huggingface.co/datasets/laion/reference_ai_voices_with_timbre_annotations) declares Apache-2.0 but states that annotations are generated automatically by a large language model; it is excluded because synthetic automated labels cannot establish human perception ground truth.
