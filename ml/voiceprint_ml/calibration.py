"""Expected Calibration Error over the held-out test split.

Regression calibration: bin predictions and labels into M buckets over [0,1],
ECE = sum over bins of (bin_count/N) * |mean_pred - mean_label|, averaged
across the output dims. Random waveform crops are not used; each test clip is
loaded fully (padded/truncated to input_seconds) so the score reflects real
inference.

ponytail: M=10 uniform bins, simple mean over dims. If a per-dim weighted ECE
is needed later, split by OUTPUT_NAMES variance and recompute.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .dataset import DatasetSpec, WaveformDataset
from .labels import OUTPUT_NAMES
from .model import VoiceImpressionNet


def expected_calibration_error(
    checkpoint: Path,
    spec: DatasetSpec,
    split: str = "test",
    bins: int = 10,
    device: str = "cpu",
) -> dict[str, float]:
    payload = torch.load(checkpoint, map_location=device, weights_only=True)
    model = VoiceImpressionNet().to(device).eval()
    model.load_state_dict(payload["state_dict"])
    dataset = WaveformDataset(spec, split)
    predictions = np.zeros((len(dataset), len(OUTPUT_NAMES)), dtype=np.float32)
    labels = np.zeros_like(predictions)
    with torch.inference_mode():
        for index in range(len(dataset)):
            waveform, target = dataset[index]
            waveform = waveform.unsqueeze(0).to(device)
            out = model(waveform).cpu().numpy()[0]
            predictions[index] = out
            labels[index] = target.numpy()
    edges = np.linspace(0.0, 1.0, bins + 1)
    centers = 0.5 * (edges[:-1] + edges[1:])
    ece_per_dim = []
    for dim in range(len(OUTPUT_NAMES)):
        bin_idx = np.clip(np.digitize(predictions[:, dim], edges) - 1, 0, bins - 1)
        weighted = 0.0
        for b in range(bins):
            mask = bin_idx == b
            count = int(mask.sum())
            if count == 0:
                continue
            mean_pred = predictions[mask, dim].mean()
            mean_label = labels[mask, dim].mean()
            weighted += (count / len(dataset)) * abs(mean_pred - mean_label)
        ece_per_dim.append(float(weighted))
    return {
        "calibrationEce": float(np.mean(ece_per_dim)),
        "calibrationEcePerDim": dict(zip(OUTPUT_NAMES, ece_per_dim)),
        "samples": int(len(dataset)),
        "bins": bins,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--split", default="test")
    parser.add_argument("--sample-rate", type=int, default=16_000)
    parser.add_argument("--input-seconds", type=int, default=20)
    parser.add_argument("--bins", type=int, default=10)
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--output", type=Path, help="optional JSON output path")
    args = parser.parse_args()
    spec = DatasetSpec(
        manifest=args.manifest,
        root=args.data_root,
        sample_rate=args.sample_rate,
        input_seconds=args.input_seconds,
    )
    result = expected_calibration_error(
        args.checkpoint, spec, split=args.split, bins=args.bins, device=args.device
    )
    text = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()