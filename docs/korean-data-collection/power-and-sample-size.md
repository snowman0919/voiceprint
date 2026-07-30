# Korean calibration dataset — power and sample-size rationale

Status: planning estimate, not a claim of statistical approval.

- Pilot: at least 150 speakers. This supports checking recruitment, recording quality, rater reliability, consent completion, and speaker-disjoint pipeline behavior; it is not enough for broad subgroup claims.
- Recommended collection: 500+ speakers, each with two controlled passages and one free utterance. This creates repeated observations while retaining speaker-level split integrity.
- Rating load: 3 utterances × 8 ratings × 500 speakers = 12,000 rating assignments, plus repeats, anchors, exclusions, and reserve capacity.

Power calculations must be finalized using pilot variance components: speaker variance, utterance variance, rater variance, missingness, and target confidence width for each descriptor. Do not treat utterances from the same speaker as independent samples. Reserve complete speakers for validation/test and report confidence intervals by speaker bootstrap.
