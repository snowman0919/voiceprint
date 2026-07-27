.PHONY: build-wasm test-wasm lint typecheck test-web build

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

build: build-wasm
	pnpm --dir apps/web build
