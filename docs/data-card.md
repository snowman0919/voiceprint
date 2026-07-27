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

### Palette of Voices (Munson & Dolquist 2025)

The official [OSF project](https://osf.io/n3twm/) declares CC BY 4.0 and explicitly says that speakers consented to open-access sharing of the stimuli. It provides English WAV stimuli, an XLSX summary of human listener-group perception rates, and source-derived acoustic measures. `make data-palette` verifies the live OSF license before downloading into ignored local storage; it resolves both current and legacy OSF file IDs, then creates a `perception-manifest.csv` that preserves source speaker IDs and separate perceived `Man`/`Woman` percentages for the three listener groups (cisgender heterosexual women, cisgender heterosexual men, and gender/sexuality-expansive listeners). `make data-palette-audit` checks its audio and duplicate content.

The completed 2026-07-28 audit found 242 readable 44.1 kHz mono WAV files, zero exact-content duplicate groups, and 20 source speaker IDs. The official summary contains 240 rated rows; all 240 map to a locally downloaded WAV and form the generated perception manifest. Two OSF WAVs not referenced by that summary remain outside the training candidate. The local feature-cache run produced 240 scalar records, with durations from 1.732 to 6.273 seconds; source audio and cache files remain ignored.

This is a purpose-aligned research candidate, but it is **not** a report model dataset: its 20 speakers are too few for a robust held-out-speaker production claim, and its category-selection percentages are not independent continuous masculinity/femininity ratings. It is never converted into speaker identity or biological-sex labels, and it must not activate a user-report model without a larger, purpose-specific consented multi-rater dataset and a documented held-out evaluation.

### LibriTTS-VI

The official [Sony LibriTTS-VI repository](https://github.com/sony/LibriTTS-VI) was downloaded locally for audit at commit `063084fa09ccd349b97e2a26b9f10b6ece00fb72`. Its actual files contain 130 manual TSV rows, four ratings per available manual score, and 130 distinct source speaker IDs. The 11-dimension estimated JSON has 375,035 utterance keys. Manual and pseudo labels are separate assets: manual labels may support future supervised validation only after annotation rights resolve; estimated labels remain pseudo labels and must never be held-out human-evaluation evidence.

LibriTTS-R audio/metadata was separately audited from official SLR141 documents: Google LLC grants CC BY 4.0. The actual LibriTTS-VI annotation repository had neither a repository license nor GitHub license metadata at audit time. Therefore actual annotation parsing, training, cache creation, redistribution, checkpoint publication, and descriptor activation are blocked pending explicit terms or written permission. Local source audio stays outside Git, Docker, and CI artifacts. See [four-asset manifest](../ml/licenses/asset-manifest.json) and [unresolved rights](unresolved-rights.md).

### VCTK-RVA / vTAD

The official [vTAD repository](https://github.com/vTAD2025-Challenge/vTAD) was downloaded locally for audit at commit `b4ab83d51d1243e4b420b06a266ea2726fbd52a2`. It includes ordered pair annotations, but no raw audio. `train.txt` contains 3,408 pairs across 78 speakers; `seen.txt` has 235 pairs/76 speakers; `unseen.txt` has 229 pairs/23 speakers. Each ordered annotation uses `speaker A|speaker B` with B stronger. The checkout has no tie rows; a tie must never be fabricated or put into that ordered schema. Its 34 gender-qualified IDs correspond to 18 descriptor names.

VCTK audio/metadata is a separate asset: official CSTR VCTK 0.92 documentation declares CC BY 4.0. The VCTK-RVA annotations and vTAD baseline code have no explicit repository license or GitHub license metadata. Thus no real annotation training, derived cache, code copying/modification, checkpoint distribution, or production descriptor is allowed. Original VCTK audio stays local-only and excluded from Git, Docker, and CI artifacts.

### FEMASC

The [FEMASC publication](https://doi.org/10.4218/etrij.2024-0608) describes five listener-rated vocal-expression categories and six volunteer reviewers. However, it also describes a locally assembled and augmented corpus combining benchmark sources and YouTube material. No authoritative public audio download, source-file manifest, license for the assembled corpus, documented speaker grouping, or consent record was located. It is therefore excluded from download, training, and report-model evidence.

Additional voice-impression candidates are audited but excluded unless their provenance meets the report-model gate. [TTS-AGI voice-annotation-data-v2](https://huggingface.co/datasets/TTS-AGI/voice-annotation-data-v2) declares CC BY 4.0 and exposes 18.6k clips with taxonomy labels, including a perceived-gender dimension. Its card does not establish the source-speaker provenance, speaker grouping, or consented multi-rater agreement needed for a held-out-speaker report model, so it has not been downloaded or trained. [LAION reference AI voices with timbre annotations](https://huggingface.co/datasets/laion/reference_ai_voices_with_timbre_annotations) declares Apache-2.0 but states that annotations are generated automatically by a large language model; it is excluded because synthetic automated labels cannot establish human perception ground truth.
