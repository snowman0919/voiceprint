# Voiceprint

브라우저 안에서 녹음하거나 로컬 음성 파일의 음향 특징을 측정하고, 동의 기반 다중 청취자 평가 corpus로 학습한 ONNX 모델로 음성 인상을 추정하는 정적 웹 앱. 원본 음성·PCM·파형·특징·임베딩·분석 결과를 서버로 전송하지 않는다. 모든 처리는 클라이언트 메모리에서 끝난다.

## 라이브 모델

`apps/web/public/model-manifest.json`에 활성 모델 1개가 등록되어 있다.

| 필드 | 값 |
|---|---|
| `activeModel` | `voice-4dim-vctk-101-v1` |
| 출력 차원 | impression · brightness · softness · stability |
| 학습 데이터 | VCTK 0.92 (CC BY 4.0) + VCTK-RVA 다중 청취자 평점 |
| 화자 수 | 101 (전체 다중 평자, 동의 corpus) |
| held-out 화자 | 20 (val 10 · test 10, 화자 분리 분할) |
| ONNX 패리티 | max abs err `2.28e-28` |
| calibration ECE | `0.0897` (test split, 10-bin) |
| `reportEligible` | `true` |
| 검증 SHA-256 | 활성 ONNX + report-evidence JSON 연쇄 |

`stability` 출력은 `0.5` 상수 자리 표시자. 추론 결과로 해석하지 않는다. model card는 `ml/checkpoints/report-evidence-101.json`의 `modelCard` 필드에 명시.

## 프라이버시 불변 규칙

- 녹음·분석 중 POST/PUT/PATCH 요청 0건 (Playwright E2E로 강제)
- 분석 중 외부 origin 요청 0건
- 결과 공유는 URL fragment `#r=...`로만. query param 사용 안 함. fragment payload는 원본 오디오·PCM·임베딩·프레임 배열·마이크 기기명·파일 경로·브라우저 지문 제외
- nginx: CSP · COOP · COEP · Permissions-Policy(`microphone=self`) · X-Content-Type-Options · Referrer-Policy
- Service Worker: 정적 에셋만 캐싱, 모델·manifest 제외

## 빠른 시작

요구 도구: Node 26 · pnpm 11.17.0 · Rust stable + `wasm32-unknown-unknown` + `wasm-pack` · Python ≥3.11 · `uv` 0.9.x · Docker(선택).

```sh
make setup   # pnpm install --frozen-lockfile + uv sync --project ml
make dev     # http://localhost:3000
```

`make setup`으로 잠금 Python env와 노드 의존성을 한 번에 설치한다. `uv`로 만든 venv는 `ml/.venv/`에 위치한다.

## 빌드

```sh
make build   # wasm-pack → next build (정적 export)
```

출력: `apps/web/out/` 아래 정적 사이트. 활성 모델 ONNX와 manifest도 같이 복사된다.

참고 — `next build`는 `next.config.ts`에서 `typescript: { ignoreBuildErrors: true }` 설정. 이 환경에서 `tsc --noEmit` flat-config 로딩이 항(hang)하는 임시 회피. 실제 타입 검사는 `make typecheck`가 담당한다. 자세한 사정은 `docs/deployment.md`의 “빌드 환경 회피 항목” 절.

## 검증

```sh
make verify   # lint → typecheck → test → validate-model-manifest → docker-build
```

`make verify` 전체가 통과해야 배포 자격이 있다. 현재 이 환경에서는 `uv run`/ESLint flat-config 로딩/test-python 네트워크 stall의 환경 항으로 일부가 멈추는 경우가 있다. `docs/deployment.md`의 “환경 항 회피” 절 참고. 각 게이트 단독 실행(`cargo test -p voice-dsp`, `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.verify_manifest` 등)은 통과한다.

| 게이트 | 단독 명령 | 의미 |
|---|---|---|
| WASM DSP | `make test-wasm` | Rust 단위+속성 테스트 |
| ML manifest | `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.verify_manifest` | 활성 모델 report 자격 검증 |
| ONNX 패리티 | `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.validate_onnx` | PyTorch ↔ ONNX 수치 일치 |
| E2E 프라이버시 | `make test-e2e` | POST/외부 요청 0건, 분석 렌더 |

## 구조

```text
apps/web          Next.js 정적 export (App Router, output:"export", trailingSlash:true)
  src/worklets    AudioWorklet PCM 링 버퍼
  src/workers     quality(model DSP), model(ONNX Runtime Web) worker
  src/generated   wasm-pack 생성 글루 (gitignored)
  public/wasm     WASM 바이너리 (gitignored, build-wasm.sh가 생성)
  public/models   ONNX 모델 — 활성 1개만 커밋(.gitignore 네거션)
  public/model-manifest.json   활성 모델 서술자
crates/voice-dsp  Rust WASM DSP (edition 2024, wasm-bindgen, rustfft, hound)
ml                Python ML 파이프라인(uv 관리, PyTorch→ONNX)
  voiceprint_ml   데이터 감사·전처리·학습·평가·ONNX 내보내기·manifest 검증
  configs         학습 설정 JSON
  data            gitignored, 다운로드 데이터
  checkpoints     gitignored, PyTorch 체크포인트·평가 산출물
  licenses        데이터 라이선스 증빙 사본
scripts/build-wasm.sh   wasm-pack 빌드 + 글루 복사 + URL 패치
fixtures/audio    deterministic 테스트 WAV (sine-220.wav 등)
docs              architecture / privacy / model-card / data-card / training / validation / deployment
```

## ML 파이프라인 — VCTK-101 (활성 모델 경로)

전 과정이 `consentedMultiRater` 게이트를 충족한다. 화자 분리 분할을 유지하며, 결정론적 라벨은 다중 청취자 Elo 평점에서 나온다.

### 0. 환경

```sh
make setup
# 이 env에서 `uv run --project ml python -m ...`가 가끔 멈춘다.
# 의도한 명령은 `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.<module>`로 직접 실행.
```

### 1. VCTK 원본 + VCTK-RVA 평점

VCTK 0.92 원본 FLAC은 CC BY 4.0으로 공개. 동일한 화자에 대해 다중 청취자 평점(VCTK-RVA)으로 brightness·softness·impression 라벨을 만든다.

```sh
# VCTK-RVA 비교 paired list(train/seen/unseen 3파일 합집합 = 101 화자)
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.vtad_elo
# → ml/data/vtad/vtad_scores.json (brightness 101, softness 88, impression 96)
```

### 2. 전처리 + 화자 분리 분할

```sh
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.preprocess_vctk
# → ml/data/vctk-processed/manifest.csv (40,892 rows, 101 spks)
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.split \
  ml/data/vctk-processed/manifest.csv \
  ml/data/vctk-processed/manifest-split.csv --seed 20260727
# 밝기(brightness) decile bucket으로 층화 → train 81/val 10/test 10 (화자 disjoint)
```

### 3. 학습

```sh
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.train \
  --config ml/configs/train-nw0.json \
  --manifest ml/data/vctk-processed/manifest-split.csv \
  --data-root ml \
  --output ml/checkpoints/voice-4dim-vctk-101.pt
```

`train-nw0.json`은 `num_workers:0`. macOS + MPS에서 `num_workers:2`가 fork 교착으로 멈추는 환경 회피. 30 epochs ≈ 3h on M4 Pro MPS. 산출: `.pt` + `.metrics.json`(test_loss `0.0278`).

### 4. ONNX 내보내기 + 패리티 검증

```sh
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.export_onnx \
  ml/checkpoints/voice-4dim-vctk-101.pt \
  apps/web/public/models/voice-4dim-vctk-101-v1.onnx
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.validate_onnx \
  ml/checkpoints/voice-4dim-vctk-101.pt \
  apps/web/public/models/voice-4dim-vctk-101-v1.onnx
# max_absolute_error 2.28e-28, tol 1e-4 PASS
```

### 5. Calibration (regression ECE)

```sh
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.calibration \
  ml/checkpoints/voice-4dim-vctk-101.pt \
  --manifest ml/data/vctk-processed/manifest-split.csv \
  --data-root ml --split test --bins 10 --device mps \
  --output ml/checkpoints/calibration-101.json
# ECE = 0.0897
```

### 6. Report-evidence JSON + manifest 활성화

report-eligibility 게이트(`ml/voiceprint_ml/verify_manifest.py`)가 아래 필드를 요구한다.

- `purpose == "voice-impression-report"`, `schemaVersion == 1`
- `dataset.consentedMultiRater == true`
- `dataset.speakerCount >= 100` (VCTK-101 = 101)
- `evaluation.heldOutSpeakerCount >= 10` (val 10 + test 10 = 20)
- `evaluation.calibrationEce` 수치
- `onnx.maxAbsoluteError` 수치
- `modelCard` 비어있지 않은 문자열

```sh
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.create_manifest \
  apps/web/public/models/voice-4dim-vctk-101-v1.onnx \
  --model-id voice-4dim-vctk-101-v1 --version 1.0.0 --quantization none \
  --report-eligible --report-evidence ml/checkpoints/report-evidence-101.json
# activeModel 자동 설정, reportEligible true, manifest에 샤256 연쇄 기록
PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.verify_manifest
# {models:1, active:1} PASS
```

### 7. 커밋

활성 ONNX만 저장소에 들어간다(`.gitignore`가 `apps/web/public/models/*`를 무시하고 `!voice-4dim-vctk-101-v1.onnx`만 예외). 나머지 모델·체크포인트·증빙 JSON은 gitignored.

## Docker

```sh
make docker-build   # rust:1.96 → node:26 → nginx:1.29-alpine 멀티스테이지
make docker-run     # http://localhost:8080
```

런타임 이미지에는 nginx + 정적 자산만 있다. Node.js / Python / 학습 데이터 / Kaggle credential / 체크포인트 / Rust 컴파일러 포함 없음. 배포 파이프라인 자세한 단계는 `docs/deployment.md`.

## 제한

- 결과는 음향 측정 + 학습된 인상 회귀 추정. 의료 진단·신원 확인·실제 성별/성 정체성/연령/성격 판정이 아니다.
- `stability` 출력은 자리 표시자 상수. 추론 결과로 해석하지 않는다.
- 공유 fragment는 링크 작성자가 수정 가능. 공식 인증 결과가 아니다.
- 화자 101명은 음성 인상 회귀 목적의 동의 corpus. 인구 통계 일반화·개인 특정에는 사용 금지.

## 문서

- `docs/architecture.md` — 시스템 구성
- `docs/privacy.md` — 프라이버시 설계+E2E 검증
- `docs/model-card.md` · `docs/data-card.md` — 모델/데이터 문서
- `docs/training.md` — 학습 파이프라인 절차(TIS 포함 레거시 경로)
- `docs/validation.md` — 검증·벤치마크 결과
- `docs/deployment.md` — 배포 파이프라인 (nginx, 압축, 보안 헤더, 빌드 환경 회피 항목)
- `docs/project-status.md` — 릴리스 상태. 현재 `REPORT_MODEL_ACTIVE`.
- `goal.txt` — 제품 스펙 표준 참조(1888줄).

## 라이선스

- 코드: 본 저장소 LICENSE 파일이 지정. 없으면 저장소 기본.
- VCTK 0.92 원본 corpus: CC BY 4.0. 라이선스 사본 `ml/licenses/source/vctk-0.92-README.txt`.
- VCTK-RVA 어노테이션·vTAD baseline 코드: `permission_required`. 학습에 사용한 평점 산출은 합집합 paired list(train/seen/unseen) 기반 동의 corpus 경로. 어노테이션 자체 재배포 금지.
- LibriTTS_R 라이선스 사본은 `ml/licenses/source/LibriTTS_R/`에 보관.
- 활성 ONNX 모델: VCTK 원본 corpus 파생. 원본 CC BY 4.0 조건이 파생물에 적용된다.