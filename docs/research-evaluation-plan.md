# License-gated voice-impression research plan

All code in this plan operates on synthetic fixtures until annotation permissions resolve. It does not read the local LibriTTS-VI or vTAD annotation checkouts.

## LibriTTS-VI plan after permission

The audited manual TSV has 130 examples, each associated with a distinct speaker ID. Preserve per-rater values and manual/pseudo separation. Run repeated grouped 5-fold OOF evaluation, leave-one-out OOF prediction, nested grouped cross-validation for selection, and bootstrap confidence intervals. Outer held-out speakers must never tune hyperparameters.

Compare descriptor mean, ridge, elastic net, ordinal regression, handcrafted MLP, frozen audio embedding plus linear head, frozen embedding plus small MLP, and handcrafted/embedding fusion. Full pretrained encoder fine-tuning is prohibited by default. Report MAE, RMSE, Spearman, Pearson, ordinal agreement, calibration, bootstrap CI, rater-variance-normalized error, inter-rater agreement, and improvement over simple acoustic baseline. Manual labels alone decide final performance; pseudo labels may only support explicitly labelled semi-supervised/pretraining/consistency ablations.

## VCTK-RVA plan after permission

Keep official `train`, `seen`, and `unseen` splits unchanged. Official rows encode `speaker A|speaker B` with right-side B stronger; a tie must use explicit tie schema and cannot enter ordered-row parser. Compare handcrafted acoustic difference, frozen speaker-embedding difference, Siamese MLP, and descriptor-conditioned difference network. Report overall and descriptor-macro ACC, seen/unseen ACC, EER, confidence interval, descriptor confusion, and speaker leakage audit.

The actual checkout contains 3,408 train pairs across 78 speakers, 235 seen pairs across 76 speakers, and 229 unseen pairs across 23 speakers; its 34 gender-qualified descriptor IDs reduce to 18 descriptor names. These counts are audit facts, not authorization to train.

## Release gate

Every descriptor needs human-rated labels, verified license, speaker-disjoint evaluation, majority and acoustic baseline improvement, bootstrap CI, no severe subgroup failure, ONNX parity, browser latency, complete model card, and label-faithful wording. Any failed item remains feature-flagged off. `pseudo_labeled_model` and `unsupported` never appear in default production UI.
