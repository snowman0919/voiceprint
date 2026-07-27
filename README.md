# Voiceprint

브라우저 안에서 녹음 또는 로컬 음성 파일의 음향 특징을 측정하는 정적 웹 앱입니다. 원본 음성, PCM, 파형, 특징, 임베딩, 분석 결과를 서버로 전송하지 않습니다.

## 현재 구현

- Next.js static export, React, TypeScript strict mode
- AudioWorklet PCM ring buffer, Web Worker 분석, Rust/WASM DSP
- 24kHz band-limited resampling, F0, spectral centroid, HNR, 입력 품질, waveform
- JSON/CSV/PNG 로컬 다운로드와 fragment 기반 공유 codec
- SHA-256 검증을 갖춘 Cache Storage 모델 다운로드 기반
- Docker/Nginx 정적 런타임, CSP·COOP·COEP·Permissions Policy
- Playwright E2E로 로컬 파일 분석 중 외부 요청과 write request가 없음을 검증

학습 모델은 아직 배포하지 않았습니다. Kaggle 데이터의 라이선스·원본 오디오·화자 ID를 확인하기 전에는 학습과 인상 예측을 의도적으로 차단합니다.

## 구조

```text
apps/web       Static client application
crates/voice-dsp  Rust/WASM audio DSP
ml             Data audit, speaker-disjoint split, training environment lock
fixtures/audio Deterministic browser/DSP fixture
docs           Privacy, data, model, deployment records
```

## 시작

필수 도구: Node 26, pnpm 11, Rust stable with `wasm32-unknown-unknown`, `wasm-pack`, Python 3.11+, Docker (선택).

```sh
pnpm install
cargo install wasm-pack --locked
make build
pnpm dev
```

`make build`는 Rust WASM을 생성하고 Next 정적 export를 수행합니다. 개발 서버는 `http://localhost:3000`입니다.

## 검증

```sh
make lint typecheck test-wasm test-python test-web test-e2e build
```

`test-e2e`는 `fixtures/audio/sine-220.wav`를 브라우저에 선택한 뒤 waveform·F0 결과가 표시되는지, POST/PUT/PATCH·외부 origin 요청이 없는지 확인합니다.

## 데이터와 학습

기본 후보 데이터셋은 Kaggle `murtadhanajim/gender-recognition-by-voiceoriginal`입니다. `KAGGLE_API_TOKEN`, legacy `KAGGLE_USERNAME`/`KAGGLE_KEY`, 또는 로컬 Kaggle credential을 설정한 뒤 다음을 실행합니다.

```sh
make data-kaggle
make data-audit
make split
```

감사는 license와 파일 형식을 검사합니다. `scalar_only` 데이터는 waveform CNN/hybrid 학습으로 진입할 수 없으며, speaker ID 없는 데이터는 speaker-disjoint split을 만들 수 없습니다. 모델 라벨과 사용자가 지각한 음성 인상은 동일하지 않습니다.

## Docker

```sh
make docker-build
make docker-run
```

컨테이너는 build stage에서 WASM과 static export를 만들고, runtime에는 Nginx와 정적 자산만 포함합니다.

## 제한

현재 관측 결과는 음향 측정이며 의료 진단, 신원 확인, 실제 성별·성 정체성·연령·성격 판정이 아닙니다. 공유 fragment는 링크 작성자가 수정할 수 있으므로 공식 인증 결과가 아닙니다.
