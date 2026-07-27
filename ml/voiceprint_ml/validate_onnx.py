"""Numerically compare the fixed-shape PyTorch checkpoint and ONNX export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

from .model import VoiceImpressionNet


def validate(checkpoint: Path, onnx_model: Path, sample_rate: int = 16_000, seconds: int = 20, tolerance: float = 1e-4) -> dict[str, float]:
    payload = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = VoiceImpressionNet().eval()
    model.load_state_dict(payload["state_dict"])
    generator = torch.Generator().manual_seed(20260727)
    waveform = torch.randn((1, 1, sample_rate * seconds), generator=generator)
    with torch.inference_mode():
        reference = model(waveform).numpy()
    session = ort.InferenceSession(onnx_model, providers=["CPUExecutionProvider"])
    candidate = session.run(["tendencies"], {"waveform": waveform.numpy()})[0]
    maximum_absolute_error = float(np.max(np.abs(reference - candidate)))
    if maximum_absolute_error > tolerance:
        raise RuntimeError(f"ONNX parity exceeded tolerance: {maximum_absolute_error} > {tolerance}")
    return {"maximum_absolute_error": maximum_absolute_error, "tolerance": tolerance}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("onnx_model", type=Path)
    parser.add_argument("--tolerance", type=float, default=1e-4)
    args = parser.parse_args()
    print(json.dumps(validate(args.checkpoint, args.onnx_model, tolerance=args.tolerance)))


if __name__ == "__main__":
    main()
