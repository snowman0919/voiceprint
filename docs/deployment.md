# Deployment

Build the production image:

```sh
make docker-build
docker run --rm -p 8080:8080 voiceprint:local
```

The image builds Rust/WASM and Next static export in separate build stages. Its runtime stage contains Nginx and exported assets only: no Node.js, Python, training data, Kaggle credentials, checkpoints, or Rust compiler.

Use `/result/#r=...` for static shared-result URLs. Fragments remain in the browser and are not sent as an HTTP request path.
