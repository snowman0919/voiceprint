.PHONY: setup dev build-wasm test-wasm benchmark-dsp benchmark-dsp-compile benchmark lint typecheck test test-web test-e2e test-python data-kaggle data-tis data-palette data-audit data-tis-audit data-palette-audit features split split-tis train train-tis train-baseline evaluate-tis evaluate export-onnx export-tis-onnx model-manifest model-manifest-tis validate-onnx validate-tis-onnx validate-model-manifest validate-formants benchmark-rtx3080 sync-model sync-tis-model docker-build docker-run deploy verify build

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
	PYTHONPATH=ml uv run --project ml python -m unittest discover -s ml/tests

data-kaggle:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.download_kaggle --output ml/data/kaggle

data-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.download_tis --output ml/data/tis

data-palette:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.download_palette_of_voices --output ml/data/palette-of-voices

data-audit:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.data_audit ml/data/kaggle --output ml/data/audit.json

data-tis-audit:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.data_audit ml/data/tis --output ml/data/tis/audit.json

data-palette-audit:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.data_audit ml/data/palette-of-voices --output ml/data/palette-of-voices/audit.json

features:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.extract_features ml/data/approved/manifest.csv --data-root ml/data/approved --output ml/data/approved/features.parquet

split:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.split ml/data/kaggle/manifest.csv ml/data/kaggle/split.csv

split-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.split ml/data/tis/tis-manifest.csv ml/data/tis/tis-split.csv

train:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.train --manifest ml/data/approved/manifest.csv --data-root ml/data/approved

train-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.tis_model

train-baseline evaluate-tis evaluate:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.tis_baselines

export-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.export_onnx ml/checkpoints/voice-impression.pt apps/web/public/models/voice-impression-v1.onnx

export-tis-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.tis_onnx export ml/checkpoints/tis-intent-v1.pt apps/web/public/models/tis-intent-v1.onnx

model-manifest:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.create_manifest apps/web/public/models/voice-impression-v1.onnx --version 1.0.0 --quantization int8-dynamic

model-manifest-tis:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.create_manifest apps/web/public/models/tis-intent-v1.onnx --model-id tis-intent-v1 --version 1.0.0 --input-seconds 4 --quantization none

validate-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.validate_onnx ml/checkpoints/voice-impression.pt apps/web/public/models/voice-impression-v1.onnx

validate-tis-onnx:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.tis_onnx validate ml/checkpoints/tis-intent-v1.pt apps/web/public/models/tis-intent-v1.onnx

validate-model-manifest:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.verify_manifest

validate-formants:
	@test -n "$(FORMANT_WAV)" || (echo "Set FORMANT_WAV to a WAV path."; exit 2)
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.validate_formants "$(FORMANT_WAV)"

benchmark-rtx3080:
	PYTHONPATH=ml uv run --project ml python -m voiceprint_ml.hardware_dry_run --required-device "RTX 3080"

sync-model: validate-onnx model-manifest validate-model-manifest

sync-tis-model: export-tis-onnx validate-tis-onnx model-manifest-tis validate-model-manifest

benchmark: benchmark-dsp

docker-build:
	docker build --tag voiceprint:local .

docker-run:
	docker run --rm --publish 8080:8080 voiceprint:local

deploy:
	git pull --ff-only origin main
	docker compose up --detach --build --remove-orphans voiceprint
	docker compose ps voiceprint

verify: lint typecheck test validate-model-manifest docker-build

build: build-wasm
	pnpm --dir apps/web build
