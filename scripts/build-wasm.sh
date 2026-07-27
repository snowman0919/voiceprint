#!/bin/sh
set -eu

wasm-pack build crates/voice-dsp --target web --out-dir ../../apps/web/public/wasm --release
cp apps/web/public/wasm/voice_dsp.js apps/web/src/generated/voice_dsp.js
perl -0pi -e "s#new URL\('voice_dsp_bg\.wasm', import\.meta\.url\)#new URL('/wasm/voice_dsp_bg.wasm', self.location.origin)#" apps/web/src/generated/voice_dsp.js
