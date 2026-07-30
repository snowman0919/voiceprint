# Korean calibration dataset — pilot acceptance criteria

Proceed to a larger collection only when all criteria are met:

1. consent completion and withdrawal workflows pass an independent review;
2. no minors are enrolled; all scope choices are recorded separately;
3. at least 150 unique speakers complete the protocol, with no speaker overlap across held-out splits;
4. at least 8 valid blinded ratings per accepted utterance, repeated-item reliability threshold pre-registered, and rater exclusions documented;
5. recording quality, clipping, missingness, mobile/desktop coverage, and device-class distribution meet pre-registered thresholds;
6. human-rating agreement and descriptor distributions are reported without collapsing rater variance;
7. privacy threat-model controls, deletion drill, and access audit pass;
8. any model experiment beats majority and simple acoustic baselines under nested speaker-disjoint evaluation with bootstrap confidence intervals;
9. ONNX parity and browser latency pass per descriptor; and
10. descriptor wording, model card, licensing, and deployment consent are approved.

Failure on any item leaves the associated descriptor disabled. The pilot can still inform script, consent, and annotation improvements without producing a production model.
