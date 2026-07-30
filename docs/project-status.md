# Project status

Current state: `DATA_REASSESSMENT_REQUIRED`.

## What is active now

- The user-facing report is fully on-device deterministic acoustic analysis:
  F0, resonance proxies, spectral measures, HNR, input quality, rule-based
  practice guidance, and an entertainment-only voice-expression spectrum.
- `apps/web/public/model-manifest.json` intentionally has no active report
  model. The app remains usable without it.
- The optional personal result service stores scalar results only. It never
  accepts raw audio, PCM, embeddings, contours, spectrograms, file paths, or
  browser fingerprints.

## Disabled model artifact

The former `voice-4dim-vctk-101-v1` ONNX artifact has been removed from the
repository and cannot be downloaded or activated. Its historical evidence file
is retained only for audit: it used VCTK-RVA-derived labels while the
annotation and vTAD code terms are `permission_required`. A personal-use
intent does not establish rights to train with those annotations, redistribute
the resulting checkpoint, or serve it publicly.

`create_manifest` now requires explicit evidence that annotation use, training,
model-weight distribution, and public-service use are all permitted before it
can activate a report model. `verify_manifest` enforces those release-rights
claims in the packaged manifest.

## Rights and research state

- LibriTTS-R and VCTK original audio terms are recorded as CC BY 4.0.
- LibriTTS-VI annotations and VCTK-RVA annotations/vTAD baseline code remain
  `unknown` / `permission_required`; see `docs/unresolved-rights.md` and
  `ml/licenses/asset-manifest.json`.
- Manual labels, pseudo-labels, and any future human-rating model must remain
  separate. Pseudo labels cannot be used as held-out human evaluation.
- No descriptor is production-enabled until its data rights, human labels,
  speaker-disjoint evidence, calibration, ONNX parity, browser latency, and
  model-card gate are all verified.

## Verification

- Rust DSP: `cargo test -p voice-dsp`.
- Python manifest gate: `PYTHONPATH=ml ml/.venv/bin/python -m unittest
  ml.tests.test_create_manifest` and `PYTHONPATH=ml ml/.venv/bin/python -m
  voiceprint_ml.verify_manifest`.
- Browser privacy integration: `make test-e2e` exercises that audio is not
  transmitted; the separate scalar-result API contract is covered by
  `make test-api`.

Next decision: obtain explicit annotation and model-release permission, or
collect a separately consented Korean calibration corpus. Until then, preserve
the useful deterministic report and keep learned descriptors off.
