"""Export a validated local checkpoint to the browser's fixed-shape ONNX input."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch

from .model import VoiceImpressionNet


def export(checkpoint: Path, output: Path, sample_rate: int = 16000, seconds: int = 20) -> None:
    payload = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = VoiceImpressionNet().eval()
    model.load_state_dict(payload["state_dict"])
    sample = torch.zeros(1, 1, sample_rate * seconds)
    output.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(model, sample, output, input_names=["waveform"], output_names=["tendencies"], opset_version=18)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    export(args.checkpoint, args.output)


if __name__ == "__main__":
    main()
