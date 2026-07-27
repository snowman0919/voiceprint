.PHONY: build-wasm test-wasm lint typecheck test-web test-python data-kaggle data-audit build

build-wasm:
	./scripts/build-wasm.sh

test-wasm:
	cargo test -p voice-dsp

lint:
	pnpm lint

typecheck:
	pnpm --dir apps/web exec tsc --noEmit

test-web:
	pnpm --filter web test

test-python:
	PYTHONPATH=ml python3 -m unittest discover -s ml/tests

data-kaggle:
	PYTHONPATH=ml python3 -m voiceprint_ml.download_kaggle --output ml/data/kaggle

data-audit:
	PYTHONPATH=ml python3 -m voiceprint_ml.data_audit ml/data/kaggle --output ml/data/audit.json

build: build-wasm
	pnpm --dir apps/web build
