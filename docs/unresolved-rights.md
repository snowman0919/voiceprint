# Unresolved rights report

Project state: `DATA_REASSESSMENT_REQUIRED`.

The four-asset manifest is [asset-manifest.json](../ml/licenses/asset-manifest.json). Access to a public GitHub repository is not a license grant.

## Verified only for original audio assets

- LibriTTS-R SLR141: official document archive contains `LICENSE.txt`, naming Google LLC and CC BY 4.0. Exact source archive SHA-256: `b59b03462911e559a4ab84f7229752b3578b715d534a31d17b88054eb3cc7389`; extracted license SHA-256: `00d4ddef5c6a1302ca880619402c29b1316e34cadcffb507bbb92360c1366644`.
- VCTK 0.92: University of Edinburgh CSTR official bitstream contains `license_text.txt`, CC BY 4.0. Exact license SHA-256: `b34e17103bfb246f2549fc82a279e6ba28834e0cb42f76a92efc14b72e3a3723`; official README SHA-256: `ba814954324641403096c224e20061f80819d50dcde6b98dd253dc8c21395d44`.
- CC BY 4.0 legal text was retrieved from Creative Commons official legalcode, SHA-256 `6d55b998ed5c54f43426d059a8c549ed58a3321e5463e6a6af1c6b56ab78c333`.

CC BY 4.0 requires attribution and does not impose ShareAlike. It permits licensed material reuse and adaptations, including commercial use, subject to the rights actually controlled by the licensor. This is a recorded license reading, not legal advice or a clearance of other rights.

## Blocking rights

| Asset | What is missing | Required before use |
| --- | --- | --- |
| LibriTTS-VI manual annotations | Explicit license or written permission | Research training, derived cache, annotation redistribution, model weights, public service |
| LibriTTS-VI pseudo annotations | Explicit license or written permission; confirmation whether terms differ | Any pseudo-label training or representation-learning cache |
| VCTK-RVA annotations | Explicit license or written permission | Pairwise training, derived cache, checkpoint publication, public service |
| vTAD baseline code | Source-code license or written permission | Copying, modification, redistribution, or checkpoint distribution derived from it |

At the audited commits, both GitHub API `license` fields were `null`, and neither checkout contained `LICENSE` or `COPYING`. Hence all fields above remain `unknown` / `permission_required`. No actual annotations or vTAD source code are imported into this repository; cloned copies are ignored local audit material.

## Enforced policy

- Original audio downloads stay local-only. Never commit them, put them in Docker image, or publish them as a CI artifact.
- Manual labels are never merged with pseudo labels. Pseudo labels never form held-out evaluation evidence.
- Before annotation rights resolve: no annotation training, cache, redistribution, public checkpoint, or descriptor activation.
- A future paper-based independent baseline must not copy function names, structure, comments, or code from vTAD. It must cite the paper and check patent/additional-use terms first.

## State transition

Remain `DATA_REASSESSMENT_REQUIRED`. Move to `PUBLIC_DATA_LICENSE_VERIFIED` only after every original-audio and annotation condition in the request is verified. If annotation use is allowed but weight distribution/public web service is not, use `LICENSE_VERIFIED_RESEARCH_ONLY`; production remains off.
