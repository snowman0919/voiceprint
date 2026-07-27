.PHONY: build-wasm test-wasm lint typecheck test-web test-e2e test-python data-kaggle data-audit docker-build docker-run build

build-wasm:
	./scripts/build-wasm.sh

test-wasm:
	cargo test -p voice-dsp

lint:
	pnpm lint

typecheck: build-wasm
	pnpm --dir apps/web exec tsc --noEmit

test-web:
	pnpm --filter web test

test-e2e:
	pnpm --dir apps/web test:e2e

test-python:
	PYTHONPATH=ml python3 -m unittest discover -s ml/tests

data-kaggle:
	PYTHONPATH=ml python3 -m voiceprint_ml.download_kaggle --output ml/data/kaggle

data-audit:
	PYTHONPATH=ml python3 -m voiceprint_ml.data_audit ml/data/kaggle --output ml/data/audit.json

split:
	PYTHONPATH=ml python3 -m voiceprint_ml.split ml/data/kaggle/manifest.csv ml/data/kaggle/split.csv

docker-build:
	docker build --tag voiceprint:local .

docker-run:
	docker run --rm --publish 8080:8080 voiceprint:local

build: build-wasm
	pnpm --dir apps/web build
