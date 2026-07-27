"""Export and numerically verify the bounded TIS intent model for ONNX Runtime Web."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn

from .tis_model import TisIntentNet


class TisProbabilityNet(nn.Module):
    def __init__(self, model: TisIntentNet) -> None:
        super().__init__()
        self.model = model

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.model(waveform)).unsqueeze(1)


def load_probability_model(checkpoint: Path) -> TisProbabilityNet:
    payload = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = TisIntentNet()
    model.load_state_dict(payload["state_dict"])
    return TisProbabilityNet(model).eval()


def export(checkpoint: Path, output: Path, sample_rate: int = 16_000, seconds: int = 4) -> None:
    model = load_probability_model(checkpoint)
    sample = torch.zeros(1, 1, sample_rate * seconds)
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(
        model,
        sample,
        output,
        input_names=["waveform"],
        output_names=["trustworthy_intent"],
        opset_version=18,
    )
    onnx.checker.check_model(onnx.load(output))


def validate(checkpoint: Path, onnx_model: Path, sample_rate: int = 16_000, seconds: int = 4, tolerance: float = 1e-4) -> dict[str, float]:
    model = load_probability_model(checkpoint)
    waveform = torch.randn((1, 1, sample_rate * seconds), generator=torch.Generator().manual_seed(20260728))
    with torch.inference_mode():
        reference = model(waveform).numpy()
    session = ort.InferenceSession(onnx_model, providers=["CPUExecutionProvider"])
    candidate = session.run(["trustworthy_intent"], {"waveform": waveform.numpy()})[0]
    maximum_absolute_error = float(np.max(np.abs(reference - candidate)))
    if maximum_absolute_error > tolerance:
        raise RuntimeError(f"ONNX parity exceeded tolerance: {maximum_absolute_error} > {tolerance}")
    return {"maximum_absolute_error": maximum_absolute_error, "tolerance": tolerance}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("export", "validate"))
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("onnx_model", type=Path)
    parser.add_argument("--tolerance", type=float, default=1e-4)
    args = parser.parse_args()
    if args.command == "export":
        export(args.checkpoint, args.onnx_model)
    else:
        print(json.dumps(validate(args.checkpoint, args.onnx_model, tolerance=args.tolerance)))


if __name__ == "__main__":
    main()
