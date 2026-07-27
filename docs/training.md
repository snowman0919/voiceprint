# Training

The repository distributes no training data or checkpoint. Run `make setup` first: ML commands use the lockfile-managed `uv` environment rather than a globally installed Python. Before any run, audit a licensed dataset, resolve duplicate audio, and produce a speaker-disjoint `train`/`validation`/`test` manifest. The training loader rejects sensitive identity/biological labels and refuses a missing held-out split.

```sh
make setup
make data-audit
PYTHONPATH=ml python -m voiceprint_ml.split approved-manifest.csv ml/data/approved/manifest.csv
make train
make export-onnx
make validate-onnx
make model-manifest
```

`ml/configs/train.json` uses fixed 16 kHz, 20-second mono inputs, batch size 8, AdamW, and a fixed seed. `device: auto` selects CUDA first (including an RTX 3080), then Apple MPS, then CPU. CUDA disables cuDNN benchmarking and enables deterministic selection where supported; PyTorch deterministic algorithms run in warning mode so unsupported operations are visible in logs rather than silently changing the run.

The best validation checkpoint is saved locally under `ml/checkpoints/` (ignored by Git). After training it is reloaded for a one-time untouched test-split loss, written beside it as `.metrics.json`. Do not add a model to the web manifest until the model card records the data audit, held-out metrics, ONNX parity, hash, and known limitations.

`make model-manifest` hashes the exact ONNX bytes in `apps/web/public/models/` and writes the size, local URL, input contract, and SHA-256 into the static manifest. Review the generated metadata and its matching model card before committing either artifact.

`make validate-onnx` runs the checkpoint and exported ONNX model against the same seeded waveform using CPU ONNX Runtime. It fails when maximum absolute output error exceeds `1e-4`; record the result in the model card before browser deployment.

`make evaluate-tis` (also available as `make train-baseline` or `make evaluate`) trains Logistic Regression, RBF SVM, and Random Forest on the same TIS speaker-disjoint training split, then writes held-out test AUROC, average precision, balanced accuracy, and macro F1 to ignored `ml/checkpoints/tis-baselines.json`. These baselines use only compact waveform summary features and remain limited to the corpus's recording-condition label.
