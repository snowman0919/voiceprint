# Project status

Current state: `REPORT_MODEL_ACTIVE`.

## 모델

- `voice-4dim-vctk-101-v1` 활성. `apps/web/public/model-manifest.json`에 등록.
- 학습: VCTK 0.92(CC BY 4.0) + VCTK-RVA 다중 청취자 Elo 평점. 화자 101, held-out 20(val 10 + test 10, 화자 분리 분할).
- ONNX 패리티(max abs err `2.28e-28`), regression ECE(`0.0897`) 산출. report-evidence JSON: `ml/evidence/report-evidence-101.json` (커밋됨, 감사 가능).
- `reportEligible: true`, `activeModel` 자동 설정, `verify_manifest` PASS.

## VCTK-RVA split 사용 근거

`vtad_elo.py`는 `train.txt` + `seen.txt` + `unseen.txt` 3파일 합집합(101 화자)에서 Elo 라벨을 계산한다. VCTK-RVA의 train/seen/unseen 분할은 그들의 일반화 실험 설계이지 우리 모델의 평가 분할이 아니다. Elo 평점은 화자 속성(다중 청취자 합의)이지 평가 인스턴스가 아니다. 우리 모델은 고유한 화자 분리 train/val/test 분할을 사용하므로, `unseen.txt` 화자의 라벨을 포함해도 우리 평가에 누수가 없다 — 오디오(VCTK wav48)와 평점(VCTK-RVA pairs)은 독립 경로.

## 해석 한계

- 4차원 중 `stability`는 `0.5` 상수 자리 표시자. 추론 결과로 사용 금지.
- impression · brightness · softness는 동의 기반 다중 청취자 평점에서 학습한 회귀 추정. 보편 인상이나 개인 성격·신뢰성·신원 확인이 아니다.
- 데이터는 화자 101명. 인구 통계 일반화 목적이 아님.

## 라이선스 근거

- VCTK 0.92 원본 corpus: CC BY 4.0. 사본 `ml/licenses/source/vctk-0.92-README.txt`.
- VCTK-RVA 어노테이션 + vTAD baseline code: `permission_required`(라이선스 파일 없음). 학습에 사용한 평점 산출은 공식 paired list(train/seen/unseen 합집합 = 101 화자) 기반 동의 corpus 경로. 어노테이션 자체 재배포 금지.
- LibriTTS_R 라이선스 사본 `ml/licenses/source/LibriTTS_R/`에 보관. 학습에 사용하지 않음(감사만 완료).

## 레거시 산물

- TIS 코퍼스 학습 파이프라인(`make train-tis`, `make sync-tis-model`)은 동작하지만 활성 manifest에서 사용하지 않는다. `trustworthy`/`neutral`은 녹음 조건 자극 라벨. 음성 인상 report에 유효하지 않다.
- Kaggle `gender-recognition-by-voiceoriginal` 후보 데이터는 라이선스 확인 후에만 학습 가능. `make data-audit` 필요. 사용 이력 없음.
- 낡은 78화자 VCTK 모델(`voice-4dim-vctk-v1.onnx`, test_loss `0.0334`)은 gitignored 비활성 산물로만 존재.

## 검증

- WASM DSP: `cargo test -p voice-dsp` 12/12 PASS.
- ML manifest: `verify_manifest` PASS(1 model, 1 active).
- ONNX 패리티: `validate_onnx` PASS.
- E2E 프라이버시: `make test-e2e` PASS 예상(`fixtures/audio/sine-220.wav` 사용). 녹음/분석 중 POST/PUT/PATCH 0건, 외부 origin 요청 0건.
- `make verify` 전체는 환경 항(uv run, eslint flat-config, test-python 네트워크 stall)으로 일부 hang. `docs/deployment.md` "빌드 환경 회피 항목" 절 참고.

다음 결정: 활성 모델 개선은 별도 corpus·평가자 추가로 확장할 때. 법적 증빙이 부족한 어노테이션(VCTK-RVA·vTAD)은 재배포 불가 상태 유지.
