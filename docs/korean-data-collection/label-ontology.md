# Korean calibration dataset — label ontology

Status: proposed. Every output has one of the provenance values below.

| Field | Definition | Label source | Production default |
| --- | --- | --- | --- |
| `f0`, formants, spectrum, HNR, CPP, jitter, shimmer | DSP measurements of the recording | `direct_acoustic_measurement` | allowed |
| pitch stability, input quality, voice-expression spectrum | documented rules over measured values | `deterministic_derived_metric` | allowed |
| brightness, softness, listener-rated expression dimensions | blinded multi-rater human scores | `human_rated_model` after gate | off pending evidence |
| unlabeled-corpus estimates | teacher/student or automatic estimates | `pseudo_labeled_model` | never default UI |
| age, identity, biological sex, gender identity, personality, health, truthfulness | no valid product label | `unsupported` | never display |

All human-rated dimensions require: a precise rater-facing definition, scale anchors, rater count, agreement estimate, speaker-disjoint evaluation, distribution report, and wording limited to the recording. “Male/female” is not a replacement name for a biological-sex label.
