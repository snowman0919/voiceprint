# Voiceprint

브라우저 안에서 녹음 또는 로컬 음성 파일의 음향 특징을 측정하는 정적 웹 앱입니다. 원본 음성, PCM, 파형, 특징, 임베딩, 분석 결과를 서버로 전송하지 않습니다.

## 현재 구현

- Next.js static export, React, TypeScript strict mode
- AudioWorklet PCM ring buffer, Web Worker 분석, Rust/WASM DSP
- 24kHz band-limited resampling, F0, spectral centroid, HNR, 입력 품질, waveform
- JSON/CSV/PNG 로컬 다운로드와 관측 음향 요약만 담는 fragment 기반 공유 링크
- SHA-256 검증을 갖춘 Cache Storage 모델 다운로드 기반
- Docker/Nginx 정적 런타임, CSP·COOP·COEP·Permissions Policy
- Playwright E2E로 로컬 파일 분석 중 외부 요청과 write request가 없음을 검증

Kaggle 데이터는 라이선스·원본 오디오·화자 ID를 검증하기 전까지 학습에 사용하지 않습니다. 공식 OSF의 CC BY 4.0 TIS 코퍼스는 `trustworthy intent`라는 한정된 녹음 조건용 모델로만 학습할 수 있습니다. `make train-tis`와 `make sync-tis-model`은 로컬 체크포인트·ONNX·해시 manifest를 생성하며, 이 생성물은 저장소에 커밋하지 않습니다. 이는 일반적인 신뢰성·성격·개인 특성의 판정이 아닙니다.

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

기본 후보 데이터셋은 Kaggle `murtadhanajim/gender-recognition-by-voiceoriginal`입니다. 먼저 `make setup`으로 잠금된 Python 환경과 Kaggle CLI를 설치한 뒤, `KAGGLE_API_TOKEN`, legacy `KAGGLE_USERNAME`/`KAGGLE_KEY`, 또는 로컬 Kaggle credential을 설정하고 다음을 실행합니다.

```sh
make data-kaggle
make data-audit
make split
```

감사는 license와 파일 형식을 검사합니다. `scalar_only` 데이터는 waveform CNN/hybrid 학습으로 진입할 수 없으며, speaker ID 없는 데이터는 speaker-disjoint split을 만들 수 없습니다. 모델 라벨과 사용자가 지각한 음성 인상은 동일하지 않습니다.

공식 OSF의 [TIS 코퍼스](https://osf.io/45d8j/)는 CC BY 4.0으로 공개된 1,152개 녹음·96명 화자 데이터입니다. 다음 명령은 로컬 무시 경로에 내려받고, 화자 분리 학습 준비 상태를 감사합니다.

```sh
make data-tis
make data-tis-audit
make split-tis
```

TIS의 `trustworthy`/`neutral`은 화자가 의도해 낸 녹음 조건일 뿐, 청취자가 평가한 보편적 인상이나 사람의 신뢰성·성격을 뜻하지 않습니다.

목적에 가까운 후보로 [Palette of Voices](https://osf.io/n3twm/)의 CC BY 4.0 공개 자극과 사람 청취자 평가 요약도 재현 가능하게 받을 수 있습니다.

```sh
make data-palette
make data-palette-audit
```

이 자료는 20명 화자의 범주형 지각 비율만 포함하므로, 현재 사용자 보고서 모델 학습이나 manifest 활성화에는 사용할 수 없습니다. 화자 수가 더 큰 동의 기반 다중 평가자 연속 평점 데이터와 held-out 화자 평가가 확인되기 전까지 앱은 측정값과 결정론적 규칙만 표시합니다.

학습과 브라우저용 모델 생성은 다음과 같습니다. 생성된 모델을 포함한 정적 배포 빌드는 이후 `make build`로 만듭니다.

```sh
make train-tis
make sync-tis-model
make build
```

승인된 데이터가 준비된 뒤의 결정론적 학습·held-out 평가·ONNX export 절차는 [docs/training.md](docs/training.md)를 따릅니다.

## Docker

```sh
make docker-build
make docker-run
```

컨테이너는 build stage에서 WASM과 static export를 만들고, runtime에는 Nginx와 정적 자산만 포함합니다.

## 제한

현재 관측 결과는 음향 측정이며 의료 진단, 신원 확인, 실제 성별·성 정체성·연령·성격 판정이 아닙니다. 공유 fragment는 링크 작성자가 수정할 수 있으므로 공식 인증 결과가 아닙니다.
