.PHONY: build-wasm test-wasm lint typecheck test-web build

build-wasm:
	wasm-pack build crates/voice-dsp --target web --out-dir ../../apps/web/public/wasm --release

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
