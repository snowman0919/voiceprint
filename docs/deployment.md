# Deployment

Build the acoustic-measurement static image:

```sh
make docker-build
docker run --rm -p 8080:8080 voiceprint:local
```

`sync-tis-model` remains a local ONNX-pipeline regression command: it creates an ignored TIS artifact and verifies its URL, file size, and digest against exact local bytes. Its generated manifest sets `reportEligible: false` and leaves `activeModel` empty. An active report model additionally requires a SHA-256-linked `--report-evidence` JSON recording a purpose-specific consented multi-rater dataset (at least 100 speakers), held-out-speaker evaluation (at least 10 speakers), calibration, ONNX parity, and model card. Do not include TIS in a user report or release manifest: its trustworthy-intent recording-condition label does not validate this product's voice-expression report. The source checkout's empty manifest is the supported release state until a purpose-specific, consented multi-rater model is available.

The image builds Rust/WASM and Next static export in separate build stages. Its runtime stage contains Nginx and exported assets only: no Node.js, Python, training data, Kaggle credentials, checkpoints, or Rust compiler. The optional generated ONNX static asset is the only model-related runtime file.

The service worker only runtime-caches same-origin static GET assets. It excludes the model manifest and models: model downloads use the app's explicit SHA-256 verification and Cache Storage path. Nginx serves `service-worker.js` with `Cache-Control: no-cache` so updates can replace old static caches.

Use `/result/#r=...` for static shared-result URLs. Fragments remain in the browser and are not sent as an HTTP request path.

`/og.svg` is a fixed Open Graph image. It contains product branding only; static hosting does not generate result-specific social previews. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin during the static build so Open Graph and Twitter tags use an absolute production URL.
