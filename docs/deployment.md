# Deployment

Build the production image:

```sh
make docker-build
docker run --rm -p 8080:8080 voiceprint:local
```

The image builds Rust/WASM and Next static export in separate build stages. Its runtime stage contains Nginx and exported assets only: no Node.js, Python, training data, Kaggle credentials, checkpoints, or Rust compiler.

The service worker only runtime-caches same-origin static GET assets. It excludes the model manifest and models: model downloads use the app's explicit SHA-256 verification and Cache Storage path. Nginx serves `service-worker.js` with `Cache-Control: no-cache` so updates can replace old static caches.

Use `/result/#r=...` for static shared-result URLs. Fragments remain in the browser and are not sent as an HTTP request path.

`/og.svg` is a fixed Open Graph image. It contains product branding only; static hosting does not generate result-specific social previews. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin during the static build so Open Graph and Twitter tags use an absolute production URL.
