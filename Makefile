.PHONY: setup dev build-wasm test-wasm benchmark-dsp benchmark-dsp-compile benchmark lint typecheck test test-web test-e2e test-python data-kaggle data-tis data-audit data-tis-audit split split-tis train export-onnx model-manifest validate-onnx sync-model docker-build docker-run verify build

setup:
	pnpm install --frozen-lockfile
	uv sync --project ml

dev:
	pnpm dev

build-wasm:
	./scripts/build-wasm.sh

test-wasm:
	cargo test -p voice-dsp

benchmark-dsp:
	cargo bench -p voice-dsp

benchmark-dsp-compile:
	cargo bench -p voice-dsp --no-run

lint:
	pnpm lint

format-check:
	pnpm format:check

typecheck: build-wasm
	pnpm --dir apps/web exec tsc --noEmit

test-web:
	pnpm --filter web test

test-e2e:
	pnpm --dir apps/web test:e2e

test: test-wasm test-python test-web test-e2e

test-python:
	PYTHONPATH=ml python3 -m unittest discover -s ml/tests

data-kaggle:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.download_kaggle --output ml/data/kaggle

data-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.download_tis --output ml/data/tis

data-audit:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.data_audit ml/data/kaggle --output ml/data/audit.json

data-tis-audit:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.data_audit ml/data/tis --output ml/data/tis/audit.json

split:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.split ml/data/kaggle/manifest.csv ml/data/kaggle/split.csv

split-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.split ml/data/tis/tis-manifest.csv ml/data/tis/tis-split.csv

train:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.train --manifest ml/data/approved/manifest.csv --data-root ml/data/approved

export-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.export_onnx ml/checkpoints/voice-impression.pt apps/web/public/models/voice-impression-v1.onnx

model-manifest:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.create_manifest apps/web/public/models/voice-impression-v1.onnx --version 1.0.0 --quantization int8-dynamic

validate-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.validate_onnx ml/checkpoints/voice-impression.pt apps/web/public/models/voice-impression-v1.onnx

sync-model: validate-onnx model-manifest

benchmark: benchmark-dsp

docker-build:
	docker build --tag voiceprint:local .

docker-run:
	docker run --rm --publish 8080:8080 voiceprint:local

verify: lint typecheck test docker-build

build: build-wasm
	pnpm --dir apps/web build
