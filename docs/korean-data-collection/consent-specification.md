# Korean calibration dataset — consent specification

Status: planning only. No collection endpoint, recruitment, or recording is authorized by this document.

## Separate, opt-in consents

Participants must be able to independently accept or decline each item without losing the ability to decline all participation:

1. participation in the research study;
2. recording and internal research use of their voice;
3. use of de-identified features and ratings for model training;
4. distribution of trained model weights for the stated purpose;
5. use of those weights in a public on-device web service; and
6. public release of original audio (default: **no**; separate explicit opt-in).

The form must name controller, contact, lawful basis, study purpose, data categories, retention period, withdrawal route, recipients/processors, transfer locations, compensation, and risks. It must show the exact model/deployment scope; consent for research does not imply weight publication or public-service use.

## Eligibility and withdrawal

- Adults only. Do not collect minors without a separately approved safeguarding and guardian-consent protocol.
- Verify age eligibility without retaining identity documents unless a reviewed legal basis requires it.
- Withdrawal before de-identification: delete raw recordings, participant linkage, and pending ratings.
- Withdrawal after de-identification: stop new uses and delete linkable data; explain clearly when already-released aggregated statistics or trained weights cannot be selectively removed.
- Do not condition payment on consent to public audio release.

## Required records

Store consent version, timestamp, selected scopes, withdrawal status, and a pseudonymous participant ID separately from recordings. Maintain an immutable consent-version archive and a change log. Obtain privacy/legal review and ethics approval, where applicable, before launch.
