# Deployment

Build the production image:

```sh
make docker-build
docker run --rm -p 8080:8080 voiceprint:local
```

The image builds Rust/WASM and Next static export in separate build stages. Its runtime stage contains Nginx and exported assets only: no Node.js, Python, training data, Kaggle credentials, checkpoints, or Rust compiler.

The service worker only runtime-caches same-origin static GET assets. It excludes the model manifest and models: model downloads use the app's explicit SHA-256 verification and Cache Storage path. Nginx serves `service-worker.js` with `Cache-Control: no-cache` so updates can replace old static caches.

Use `/result/#r=...` for static shared-result URLs. Fragments remain in the browser and are not sent as an HTTP request path.
