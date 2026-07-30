# Korean calibration dataset — privacy threat model

Voice is biometric-like personal data and may reveal identity through linkage. Main threats and controls:

| Threat | Control |
| --- | --- |
| identity linked to audio | separate consent/contact store; random study IDs; least-privilege access |
| public re-identification from released WAV | default no public audio; distinct release consent; do not promise irreversibility |
| rater recognizes participant | no names, profiles, or contact data; random ordering; conflict reporting |
| model memorization or membership inference | evaluate attacks before weight release; minimize raw-audio exposure; document residual risk |
| replay/shared-link exposure | avoid audio in links; time-limit result records; delete controls |
| accidental logs/backups | prohibit raw payload logs; encrypted storage; backup inventory and deletion propagation |

Complete a data-protection impact assessment and access-control review before collection. No security claim is implied by this draft.
