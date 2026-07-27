FROM rust:1.96-bookworm AS wasm-build
WORKDIR /workspace
COPY crates crates
RUN rustup target add wasm32-unknown-unknown && cargo install wasm-pack --locked
RUN mkdir -p apps/web/public/wasm apps/web/src/generated
RUN wasm-pack build crates/voice-dsp --target web --out-dir ../../apps/web/public/wasm --release \
 && cp apps/web/public/wasm/voice_dsp.js apps/web/src/generated/voice_dsp.js \
 && sed -i "s#new URL('voice_dsp_bg.wasm', import.meta.url)#new URL('/wasm/voice_dsp_bg.wasm', self.location.origin)#" apps/web/src/generated/voice_dsp.js

FROM node:26-bookworm-slim AS web-build
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN npm install --global pnpm@11.17.0 && pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY --from=wasm-build /workspace/apps/web/public/wasm apps/web/public/wasm
COPY --from=wasm-build /workspace/apps/web/src/generated apps/web/src/generated
RUN pnpm --dir apps/web build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /workspace/apps/web/out /usr/share/nginx/html
EXPOSE 8080
