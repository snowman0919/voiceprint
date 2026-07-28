# Voiceprint — AGENTS.md

기기 내장 음성 인상 분석기. 모든 오디오는 브라우저 안에서 처리. 한국어 주 UI.

## Quick start

```sh
make setup        # pnpm install --frozen-lockfile + uv sync --project ml
make dev          # pnpm dev → localhost:3000
make build        # wasm-pack → next build (static export)
make verify       # lint typecheck test validate-model-manifest docker-build
```

## Architecture

```
apps/web          Next.js static export (App Router, output:"export", trailingSlash:true)
crates/voice-dsp  Rust WASM DSP (edition 2024, wasm-bindgen, rustfft, hound)
ml/               Python ML pipeline (uv-managed, PyTorch→ONNX)
scripts/          build-wasm.sh (wasm-pack → copy → URL patch)
fixtures/audio/   Deterministic test WAVs
docs/             Architecture, privacy, model/data cards, deployment
```

## 빌드 파이프라인 주의사항

**WASM 빌드** (`scripts/build-wasm.sh`):
- `wasm-pack build crates/voice-dsp --target web --release`
- 출력: `apps/web/public/wasm/`, 글루 파일은 `apps/web/src/generated/voice_dsp.js`로 복사
- URL 패치: `import.meta.url` → `self.location.origin` (`perl -0pi` 사용)
- 생성된 디렉토리(`public/wasm/`, `src/generated/`)는 gitignored — 클린 체크아웃 시 스크립트가 생성

**타입체크** (`make typecheck`):
- WASM 글루 파일 필수 — `build-wasm`을 자동으로 먼저 실행
- `pnpm --dir apps/web exec tsc --noEmit`

**정적 내보내기** (`make build`):
- `next.config.ts`: `output: "export"`, `trailingSlash: true`, `images: { unoptimized: true }`
- API Routes, Server Actions, 동적 SSR, 데이터베이스 없음

## 명령어

| Command | 기능 | 비고 |
|---|---|---|
| `make dev` | pnpm dev | — |
| `make build` | wasm + next build | WASM 변경 후 반드시 실행 |
| `make lint` | ESLint (core-web-vitals + TS) | — |
| `make format-check` | Prettier (120 printWidth, trailingComma:all) | — |
| `make typecheck` | build-wasm → tsc --noEmit | WASM 글루에 의존 |
| `make test-wasm` | `cargo test -p voice-dsp` | — |
| `make test-web` | `vitest run src` | `src/`만, E2E 제외 |
| `make test-e2e` | `playwright test` | `fixtures/audio/sine-220.wav` 필요 |
| `make test-python` | `PYTHONPATH=ml uv run --project ml python -m unittest discover -s ml/tests` | — |
| `make test` | 전체 4개 테스트 스위트 | — |
| `make verify` | lint → typecheck → test → validate-model-manifest → docker-build | CI는 format-check + build로 verify 대체 |
| `make benchmark-dsp` | `cargo bench -p voice-dsp` | Criterion 벤치마크 |
| `make benchmark-dsp-compile` | `cargo bench -p voice-dsp --no-run` | CI는 컴파일만 |
| `make docker-build` | `docker build --tag voiceprint:local .` | Multi-stage, nginx runtime |
| `make docker-run` | `docker run --rm -p 8080:8080 voiceprint:local` | — |

## 기기 내장 분석 파이프라인

1. **AudioWorklet** (`worklets/capture.worklet.js`) → PCM 링 버퍼 (최대 60초)
2. **Web Worker** (`workers/quality.worker.ts`) → WASM `voice_dsp` 로드, F0/스펙트럼/HNR 실행
3. **React UI** 결과 렌더링 (파형, F0, 스펙트럼 특징, HNR)
4. **Model Worker** (`workers/model.worker.ts`) → ONNX Runtime Web (WebGPU→WASM fallback)

2-4단계 모두 브라우저 메모리에서 처리 — 네트워크 없음.

## 프라이버시 불변 규칙 (E2E로 강제)

- 녹음/분석 중 POST/PUT/PATCH 요청 0건
- 분석 중 외부 오리진 요청 0건
- 결과 공유는 URL fragment `#r=...`로만 (query param 절대 사용 안 함)
- Fragment payload 제외: raw audio, PCM, 임베딩, 프레임별 배열, 마이크 기기명, 파일 경로, 브라우저 지문
- nginx.conf: CSP, COOP, COEP, Permissions-Policy (microphone=self), X-Content-Type-Options, Referrer-Policy
- Service Worker (`public/service-worker.js`) — 정적 에셋만 캐싱 (모델은 제외)

## ML 파이프라인 주의사항

- **Python은 `uv`로 관리**, `pip`나 `poetry` 아님. `uv sync --project ml --locked` 사용
- Kaggle 데이터는 라이선스 확인 후에만 학습 가능 (`make data-audit`)
- 민감 레이블(`gender`, `sex`, `age`)이 manifest에 있으면 학습 차단 (`manifest_gate.py`)
- 화자 분리 분할 필수 (`make split`) — 화자 간 데이터 누출 차단
- ONNX 내보내기: `make export-onnx` / `make export-tis-onnx`
- Model manifest 위치: `apps/web/public/model-manifest.json` — 현재 `activeModel: null, models: []`
- 아직 배포된 모델 없음. Manifest 검증(`verify_manifest.py`)이 빌드 전 통과해야 함

## 테스트 주의사항

- E2E는 `fixtures/audio/sine-220.wav` 필요 (48kHz, 220Hz 사인파)
- Playwright 설정: `webServer: { command: "pnpm dev" }` — 정적 내보내기 아닌 dev 서버 사용
- Vitest는 `src/`만 테스트 — Playwright 스펙을 실수로 집지 않음
- Rust 벤치마크: CI에서 컴파일만 (`benchmark-dsp-compile`) 실행은 안 함
- 모든 python 명령어에 `PYTHONPATH=ml` 필요
- `validate-formants`는 `FORMANT_WAV` 환경변수 필요

## 생성된 / gitignored 파일 (CI 또는 로컬 빌드가 생성)

- `apps/web/public/wasm/` — WASM 바이너리
- `apps/web/src/generated/` — WASM JS 글루 (worker가 임포트)
- `apps/web/out/` — 정적 내보내기 출력
- `apps/web/.next/` — Next.js 빌드 캐시
- `apps/web/public/models/` — ONNX 모델 파일
- `ml/checkpoints/` — PyTorch 체크포인트
- `ml/data/` — 다운로드한 데이터셋

위 파일들은 `.gitignore`에 등록되어 있으며 빌드 스크립트가 생성해야 함.

## 프레임워크 / 도구체인 버전

- Node 26, pnpm 11.17.0
- Rust stable + wasm32-unknown-unknown target + wasm-pack
- Next.js 16.2.12, React 19.2.4, onnxruntime-web 1.24.1
- Python ≥3.11, uv 0.9.x
- Docker multi-stage: rust:1.96-bookworm → node:26 → nginx:1.29-alpine

## 브랜드 / 명명

브랜드 정보는 단일 파일: `apps/web/src/lib/brand.ts`
- `brand.name`, `brand.description`, `brand.privacyPromise`, `brand.appVersion`, `brand.dspVersion`

## 문서 참조

- `README.md` — 설정, 빌드, 테스트, Docker, 데이터 파이프라인, 한계
- `docs/architecture.md` — 시스템 구성
- `docs/privacy.md` — 프라이버시 설계
- `docs/model-card.md`, `docs/data-card.md` — 모델/데이터 문서
- `docs/deployment.md` — 배포 (nginx, 압축, 보안 헤더)
- `docs/training.md` — 학습 파이프라인 절차
- `docs/validation.md` — 검증, 벤치마크 결과
- `goal.txt` — 전체 제품 스펙 (1888줄, 설계 의도의 표준 참조)
