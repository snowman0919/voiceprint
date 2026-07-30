# Korean calibration dataset — retention and deletion policy

Status: proposed policy requiring controller approval before collection.

- Raw audio: retain only for the consented research period; default 24 months after collection close, then cryptographically delete from primary and backup stores.
- Identity/contact and consent linkage: retain separately only as long as needed for compensation, audit, and withdrawals; review at 12 months.
- Derived features and ratings: retain only under their selected consent scope; delete or irreversibly aggregate after the approved research period.
- Model checkpoints: retain only while a documented consent scope allows the specific training/deployment purpose.
- Deletion requests: acknowledge, authenticate without over-collecting, propagate to processors/backups, and provide a completion record. State exceptions precisely.

Maintain deletion logs without retaining recordings. If a participant withdraws from a released model, explain the limits of removing information from already-distributed weights and stop future distribution where required.
