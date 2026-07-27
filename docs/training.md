# Training

The repository distributes no training data or checkpoint. Before any run, audit a licensed dataset, resolve duplicate audio, and produce a speaker-disjoint `train`/`validation`/`test` manifest. The training loader rejects sensitive identity/biological labels and refuses a missing held-out split.

```sh
make setup
make data-audit
PYTHONPATH=ml python -m voiceprint_ml.split approved-manifest.csv ml/data/approved/manifest.csv
make train
make export-onnx
```

`ml/configs/train.json` uses fixed 16 kHz, 20-second mono inputs, batch size 8, AdamW, and a fixed seed. `device: auto` selects CUDA first (including an RTX 3080), then Apple MPS, then CPU. CUDA disables cuDNN benchmarking and enables deterministic selection where supported; PyTorch deterministic algorithms run in warning mode so unsupported operations are visible in logs rather than silently changing the run.

The best validation checkpoint is saved locally under `ml/checkpoints/` (ignored by Git). After training it is reloaded for a one-time untouched test-split loss, written beside it as `.metrics.json`. Do not add a model to the web manifest until the model card records the data audit, held-out metrics, ONNX parity, hash, and known limitations.
