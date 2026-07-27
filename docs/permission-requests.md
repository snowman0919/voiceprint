# Annotation and baseline permission package — drafts only

Do not send automatically.

## Contact matrix

| Asset                     | Rights contact                                                      | Corresponding-author contact                                                                        | Maintainer route                                                   | Status                                 |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------- |
| LibriTTS-VI               | unknown                                                             | unknown from audited repository                                                                     | [GitHub Issues](https://github.com/sony/LibriTTS-VI/issues)        | permission required                    |
| VCTK-RVA annotations      | unknown                                                             | authors listed in [vTAD paper](https://arxiv.org/abs/2505.09661); corresponding author not verified | [GitHub Issues](https://github.com/vTAD2025-Challenge/vTAD/issues) | permission required                    |
| vTAD baseline code        | unknown                                                             | unknown                                                                                             | [GitHub Issues](https://github.com/vTAD2025-Challenge/vTAD/issues) | permission required                    |
| VCTK 0.92 original corpus | University of Edinburgh CSTR; corpus README lists Junichi Yamagishi | `jyamagis@inf.ed.ac.uk` appears in official VCTK 0.92 README                                        | official DOI record                                                | CC BY 4.0 recorded; no request drafted |

No personal contact detail is inferred from a paper or repository. Resolve unknown corresponding-author addresses from an official paper page or use the GitHub issue route.

## LibriTTS-VI draft

Subject: Permission request for LibriTTS-VI annotations and derived research model

Hello LibriTTS-VI authors/maintainers,

We are auditing rights before using the repository's manual annotations and estimated/pseudo annotations. We found no explicit repository license at commit `063084fa09ccd349b97e2a26b9f10b6ece00fb72`.

Please state separately whether you permit: (1) research use of manual annotations, (2) non-commercial and commercial model training, (3) publication/distribution of trained weights, (4) use in an on-device public web service, (5) annotation redistribution, (6) required attribution, and (7) your preferred license. Please also confirm whether estimated/pseudo labels have different terms from manual annotations. We will keep manual and pseudo labels separate and will not use pseudo labels as held-out human evaluation.

If permission is not available, please tell us the appropriate rights holder/contact. We will not use the annotations until terms are explicit.

Regards,
[name / organization / project URL]

## VCTK-RVA annotations and vTAD code draft

Subject: Permission request for VCTK-RVA annotations and vTAD baseline code

Hello vTAD authors/maintainers,

We are auditing the VCTK-RVA annotation files and vTAD baseline code before use. We found no explicit repository license at commit `b4ab83d51d1243e4b420b06a266ea2726fbd52a2`.

Please answer separately for annotations and baseline source code: (1) research use, (2) non-commercial and commercial model training, (3) trained-weight publication, (4) use in an on-device public web service, (5) annotation redistribution, (6) modified baseline-code redistribution, (7) required attribution, and (8) preferred license. Please identify any patent or additional terms.

Until you confirm, we will neither train on annotations nor copy, modify, redistribute, or distribute checkpoints from the baseline code. A paper-based independent implementation, if pursued, will be documented as independent and will not copy repository code.

Regards,
[name / organization / project URL]
