# Project status

Current state: `ACQUIRING_DATA`. No report model is active.

## 보류 사유 (2026-07-29)

직전 커밋(`7f4e532`까지)에서 활성화한 `voice-4dim-vctk-101-v1` 모델을 두 가지 정당성 결함으로 철회했다.

1. **평가 누수** — `vtad_elo.py`가 VCTK-RVA의 `train.txt` + `seen.txt` + `unseen.txt`를 모두 Elo 입력으로 사용. `unseen.txt`는 VCTK-RVA의 held-out 평가 페어이므로, 이 페어로 계산한 화자 라벨은 평가 데이터를 포함한다. 게이트의 `heldOutSpeakerCount` 의미(평가 데이터에 닿지 않은 화자로 평가)가 위반됨. 23 화자는 `unseen.txt`에만 등장 → 라벨 100% 누수.
2. **`stability` 자리 표시자** — 네 번째 출력 축 `stability`는 라벨 소스가 없어 `0.5` 상수로 채워졌고, 모델은 그 축을 항상 `0.5`로 출력(`calibrationEce` stability `4.9e-5`로 확인). "4차원 음성 인상 모델"로 배포하나 해석 가능한 축은 3개.

## 현재 조치

- `vtad_elo.py`는 `train.txt` + `seen.txt`만 사용하도록 복원. 정직하게 라벨링 가능한 화자 수 = 78(게이트 `speakerCount >= 100` 미달).
- 누수 모델 ONNX(`voice-4dim-vctk-101-v1.onnx`)는 manifest에서 제거 + git에서 삭제.
- `apps/web/public/model-manifest.json`은 `activeModel: null`, `models: []`로 재설정. report 생성 불가 상태.
- DSP(WASM F0/스펙트럼/HNR)는 그대로 동작. 분석 페이지는 음향 특징 시각화까지 사용 가능. report 값 출력은 비활성.

## 재활성 조건 (다음 단계)

1. 동의 기반 다중 청취자 평점 소스 추가 확보(LibriTTS_R 심사 + 기타)로 깨끗하게 라벨링 가능한 화자 100+ 명 도달.
2. `stability` 축 제거 → 3-dim(impression · brightness · softness) 모델 재학습.
3. 화자 분리 분할 재생성(held-out 화자 라벨은 평가 데이터를 포함하지 않아야 함).
4. ONNX 내보내기 + deterministic fixture 추론 출력(`modelOutputs`)을 report-evidence JSON에 기록 + 해당 JSON을 커밋되는 위치(`ml/evidence/`)에 보관.
5. 게이트 통과 시에만 `reportEligible: true`, `activeModel` 설정.

## 라이선스 근거

- VCTK 0.92 원본 corpus: CC BY 4.0. 사본 `ml/licenses/source/vctk-0.92-README.txt`.
- VCTK-RVA 어노테이션: `permission_required`(라이선스 파일 없음). 평점 산출에 사용한 paired list는 비재배포 경로. 어노테이션 자체 재배포 금지.
- LibriTTS_R 라이선스 사본 `ml/licenses/source/LibriTTS_R/` 보관. 현재 감사만 완료, 학습 사용 전 라이선스 최종 심사 필요.

## 레거시 산물

- TIS 코퍼스 파이프라인(`make train-tis`): 활성 manifest 미사용.
- Kaggle `gender-recognition-by-voiceoriginal`: 라이선스 미심사. 사용 이력 없음.
- `ml/checkpoints/`의 `.pt`/`.metrics.json`/`report-evidence-101.json`/`calibration-101.json`은 gitignored. 누수 모델 산물이므로 비활성.

## 검증

- WASM DSP: `cargo test -p voice-dsp` 12/12 PASS.
- `verify_manifest` PASS(`active: 0`).
- E2E 프라이버시: `make test-e2e` PASS 예상. 녹음/분석 중 POST/PUT/PATCH 0건, 외부 origin 요청 0건.
- `make verify` 전체는 환경 항(`uv run`, eslint flat-config, `test-python` 네트워크 stall)으로 일부 hang. `docs/deployment.md` "빌드 환경 회피 항목" 절 참고.

다음 결정: 100+ 화자 동의 corpus + 3-dim 라벨 정합성을 갖춘 재학습 완료 후에만 report 모델 재활성.
