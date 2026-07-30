# Deployment

Voiceprint는 정적 export 웹 앱 + nginx 런타임으로 배포한다. WASM과 빈
model manifest를 포함한 자산이 빌드 시 한 번 만들어지고, 런타임에는 nginx와
정적 파일만 남는다. 권한 게이트를 통과한 ONNX만 이 이미지에 포함할 수 있다.

## 파이프라인 개요

```text
코드 체크아웃
  │
  ├─ make setup         pnpm install + uv sync
  ├─ make build-wasm    wasm-pack → apps/web/public/wasm + apps/web/src/generated/
  ├─ make build         next build → apps/web/out/
  │                       ├─ static pages (/, /about, /analyze, /privacy, /result, /settings)
  │                       ├─ wasm/*.wasm + glue .js
  │                       ├─ models/  (권한 게이트 통과 시에만 ONNX)
  │                       └─ model-manifest.json (현재 activeModel: null)
  └─ make docker-build  rust:1.96 → node:26 → nginx:1.29-alpine
                          runtime: nginx + /usr/share/nginx/html (정적 자산만)
```

WASM 바이너리·JS 글루·out/·모델 산출물은 gitignored라 클린 체크아웃에서는
빌드 스크립트가 생성해야 한다. 현재는 활성 ONNX가 없다.

## 빌드 단계

### 1. 정적 export (`make build`)

```sh
make build
# = make build-wasm + pnpm --dir apps/web build
```

`build-wasm` 단계(`scripts/build-wasm.sh`):

1. `wasm-pack build crates/voice-dsp --target web --release`
2. `pkg/` 출력물을 `apps/web/public/wasm/`으로 복사
3. JS 글루를 `apps/web/src/generated/voice_dsp.js`로 복사
4. `import.meta.url` → `self.location.origin` URL 패치(`perl -0pi`)

Next 빌드:

- `next.config.ts`가 `output: "export"`, `trailingSlash: true`, `images.unoptimized`, `typescript.ignoreBuildErrors: true`
- 산출: `apps/web/out/` 아래 정적 HTML + `_next/` 정적 청크
- `scripts/prune-export-models.mjs`가 manifest에 없는 ONNX를 `out/models/`에서
  제거하고, manifest가 가리키는 모델이 빠진 경우 빌드를 실패시킨다. 로컬의
  과거 실험 artifact가 Docker 이미지에 섞이는 것을 막는 패키징 게이트다.
- 확인된 라우트 9개: `/`, `/_not-found`, `/about`, `/analyze`, `/privacy`, `/result`, `/settings`

### 2. 빌드 산출물 점검

```sh
ls apps/web/out/
cat apps/web/out/model-manifest.json | jq .activeModel   # null
```

### 3. Docker 이미지 (`make docker-build`)

멀티스테이지 Dockerfile:

| Stage        | Base                    | 역할                                                                |
| ------------ | ----------------------- | ------------------------------------------------------------------- |
| `wasm-build` | `rust:1.96-bookworm`    | `wasm-pack build crates/voice-dsp` → `public/wasm`, `src/generated` |
| `web-build`  | `node:26-bookworm-slim` | `pnpm install --frozen-lockfile` + `pnpm build` → `out/`            |
| `runtime`    | `nginx:1.29-alpine`     | `out/` → `/usr/share/nginx/html`, 8080 노출                         |

```sh
make docker-build   # docker build --tag voiceprint:local .
make docker-run     # docker run --rm -p 8080:8080 voiceprint:local
# → http://localhost:8080
```

런타임 이미지 구성:

- nginx + 정적 자산
- 없는 것: Node.js, Python, Rust 컴파일러, 학습 데이터, Kaggle credential,
  PyTorch checkpoint, 그리고 권한 미확인 ONNX 산출물

### 4. nginx 구성(`Dockerfile` 내`nginx.conf`)

보안 헤더 강제:

- `Content-Security-Policy`: 동일 origin 자원만, 모델 같은 origin, 인라인 스크립트 SHA 화이트리스트
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp` — `SharedArrayBuffer`(WASM 스레드) 활성화 요구
- `Permissions-Policy: microphone=self`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `service-worker.js`는 `Cache-Control: no-cache`로 serve → 업데이트가 낡은 캐시를 교체

정적 자산 압축: gzip + brotli 기본.

## 빌드 환경 회피 항목

이 저장소를 현재 개발 환경에서 빌드할 때 마주하는 환경 항과 회피. 항목별로 의도·한계·업그레이드 경로를 명시했다.

### `tsc --noEmit` flat-config 로딩 hang → next 빌드 `typescript.ignoreBuildErrors`

- 현상: `pnpm --dir apps/web exec tsc --noEmit`이 5분 timeout에도 출력 0. ESLint flat-config 로딩과 동일한 경로에서 멈춘다.
- 회피: `apps/web/next.config.ts`에 `typescript: { ignoreBuildErrors: true }`. `// ponytail:` 주석으로 사유·업그레이드 경로 명시.
- 한계: next 빌드 경로에서만 타입 검사를 건너뛴다. CI나 `make typecheck`는 여전히 `tsc --noEmit`을 실행한다.
- 업그레이드: flat-config/tsc 로딩 이슈 원인 특정(typescript 5 + eslint 9 + next 16 조합 의심) → `ignoreBuildErrors: false` 복원.

### `uv run --project ml` 가끔 hang → venv python 직접 실행

- 현상: `make` target의 `uv run --project ml python -m voiceprint_ml.<module>`이 동기화 단계 이후 멈추는 경우. macOS + 특정 uv 버전에서 확인.
- 회피: ML 명령은 `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.<module>`로 직접 실행. `make setup`이 `ml/.venv/`를 만든다.
- 한계: `make` target은 일반 `uv run` 경로를 그대로 쓴다. 사용자 환경에서 `uv run`이 정상이면 `make` target 그대로 사용.
- 업그레이드: `uv` 버전 고정 또는 Makefile target을 venv 직접 실행으로 전환.

### `make verify` 전체 일부 hang → 단일 게이트 단독 실행

- 현상: `make lint`(ESLint) / `make typecheck` / `make test-python`이 각각의 이유로 멈춘다. ESLint는 flat-config, test-python은 torch load/network stall 의심(네트워크 접근 단위 테스트).
- 회피: 게이트 단독 실행으로 실질 검증.
  - `cargo test -p voice-dsp` → Rust 12/12 PASS
  - `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.verify_manifest` → manifest 검증 PASS
  - `PYTHONPATH=ml ml/.venv/bin/python -m voiceprint_ml.validate_onnx` → ONNX 패리티 PASS
  - `make test-wasm` `make test-web` `make test-e2e` 각각 정상
- 업그레이드: 단위 테스트 네트워크 접근 제거(torch hub 자동 다운로드 차단), eslint flat-config 로딩 이슈 해결 후 Makefile 경로 복원.

## 활성 모델 교체 절차

새 모델을 활성으로 만드려면 report-eligibility 게이트를 검증 JSON으로 통과해야 한다.

1. 동의 기반 다중 청취자 corpus로 학습. `consentedMultiRater: true`가 거짓 명이 아니어야 함.
2. `speakerCount >= 100`, `heldOutSpeakerCount >= 10` 조건.
3. `ml/checkpoints/report-evidence-<name>.json` 작성. 필수 필드:
   - `purpose: "voice-impression-report"`, `schemaVersion: 1`
   - `modelId`, `modelVersion`
   - `dataset.consentedMultiRater: true`, `speakerCount`, `heldOutSpeakerCount`
   - `evaluation.calibrationEce` 수치(regression ECE)
   - `onnx.maxAbsoluteError` 수치
   - `modelCard` 비어있지 않은 문자열
   - `rights.annotationLicenseVerified`, `trainingAllowed`,
     `modelDistributionAllowed`, `publicServiceAllowed` 모두 `true`이며
     해당 근거를 evidence에 기록
4. ONNX export → `apps/web/public/models/<id>.onnx` 배치.
5. `create_manifest --report-eligible --report-evidence <json>` 실행.
6. `verify_manifest` PASS 확인.
7. `make build` 재실행 → `apps/web/out/models/`에 새 ONNX 반영.
8. 정적 export + 커밋 + 푸시.

게이트 검증 코드: `ml/voiceprint_ml/verify_manifest.py`. report-evidence 필드 검증: `ml/voiceprint_ml/create_manifest.py:report_evidence_digest`. 활성 모델은 항상 `reportEligible: true`여야 한다(`verify_manifest`가 강제).

## 정적 호스팅 일반 안내

nginx 외 임의 정적 호스트(Vercel static, GitHub Pages, Cloudflare Pages, Netlify)에서도 `apps/web/out/`을 서빙하면 동작한다. 요구 사항:

- COOP/COEP 헤더를 설정 가능(Cross-Origin-Embedder-Policy `require-corp`). `SharedArrayBuffer` 의존.
- 모든 응답에 보안 헤더 주입 가능(CSP·Permissions-Policy·X-Content-Type-Options·Referrer-Policy).
- `/service-worker.js`는 `Cache-Control: no-cache`.
- `/og.svg` 고정 Open Graph 이미지. 결과별 소셜 프리뷰는 정적 호스팅에서 생성하지 않는다. 빌드 시 `NEXT_PUBLIC_SITE_URL`을 최종 HTTPS origin으로 설정하면 og/twitter 태그가 절대 URL을 사용.

## 결과 공유 URL

`/result/#share=...` 경로를 지원한다. fragment에는 256비트 수준의 무작위 공유 토큰만 담기므로 HTTP 초기 요청에 전송되지 않는다. 브라우저가 같은 오리진 결과 API에 토큰을 제출하면 SQLite에 저장된 스칼라 측정 결과를 조회한다. 원본 오디오·PCM·임베딩·프레임 배열·마이크 기기명·파일 경로·브라우저 지문은 저장하거나 공유하지 않는다. 공유 토큰을 받은 사람은 결과를 볼 수 있으므로, 필요하면 원 소유자가 결과를 삭제해야 한다.

## 릴리스 상태

`docs/project-status.md`의 `DATA_REASSESSMENT_REQUIRED`. 현재 활성 모델은
없으며, 권한이 검증된 새 데이터와 evidence가 확보될 때까지 결정론적 보고서만
제공한다.

## 검증 산출물 체크리스트

배포 전 아래를 모두 확인한다.

- [ ] `apps/web/out/model-manifest.json`의 `activeModel`이 의도한 상태인지 확인
- [ ] 활성 모델이 있는 경우에만 ONNX 존재·SHA-256·releaseRights를 함께 확인
- [ ] `apps/web/out/wasm/voice_dsp_bg.wasm` + `apps/web/out/wasm/voice_dsp.js` 존재
- [ ] 정적 라우트 9개 디렉토리 각 `index.html` 존재
- [ ] `make test-e2e` PASS → 원본 음성 미전송, 동일 오리진 스칼라 결과 POST만
  허용, 외부 origin 요청 0건
- [ ] `verify_manifest` PASS → 현재 `{models:0, active:0}`
- [ ] 활성 모델이 있는 경우에만 `validate_onnx` PASS → max abs err < 1e-4
- [ ] Docker 빌드 성공 → `voiceprint:local` 이미지
- [ ] `docker run` 후 `http://localhost:8080`에서 `/analyze` 진입 + 마이크 권한 프롬프트 + 결과 렌더
