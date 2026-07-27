"""Reproducible local training for approved voice-impression datasets."""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

from .dataset import DatasetSpec, WaveformDataset
from .model import VoiceImpressionNet


def select_device(requested: str) -> torch.device:
    if requested != "auto":
        return torch.device(requested)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> float:
    model.eval()
    values: list[float] = []
    with torch.inference_mode():
        for waveforms, targets in loader:
            values.append(nn.functional.smooth_l1_loss(model(waveforms.to(device)), targets.to(device)).item())
    return float(np.mean(values))


def train(config: dict[str, object], manifest: Path, data_root: Path, output: Path) -> None:
    set_seed(int(config["seed"]))
    device = select_device(str(config["device"]))
    spec = DatasetSpec(manifest, data_root, int(config["sample_rate"]), int(config["input_seconds"]))
    train_set, validation_set = WaveformDataset(spec, "train"), WaveformDataset(spec, "validation")
    loader_options = {"batch_size": int(config["batch_size"]), "num_workers": int(config["num_workers"]), "pin_memory": device.type == "cuda"}
    train_loader = DataLoader(train_set, shuffle=True, **loader_options)
    validation_loader = DataLoader(validation_set, shuffle=False, **loader_options)
    model = VoiceImpressionNet().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=float(config["learning_rate"]), weight_decay=float(config["weight_decay"]))
    best_loss = float("inf")
    output.parent.mkdir(parents=True, exist_ok=True)
    for epoch in range(1, int(config["epochs"]) + 1):
        model.train()
        for waveforms, targets in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = nn.functional.smooth_l1_loss(model(waveforms.to(device)), targets.to(device))
            loss.backward()
            optimizer.step()
        validation_loss = evaluate(model, validation_loader, device)
        print(json.dumps({"epoch": epoch, "validation_loss": validation_loss, "device": str(device)}))
        if validation_loss < best_loss:
            best_loss = validation_loss
            torch.save({"state_dict": model.state_dict(), "config": config, "validation_loss": best_loss}, output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("ml/configs/train.json"))
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("ml/checkpoints/voice-impression.pt"))
    args = parser.parse_args()
    train(json.loads(args.config.read_text()), args.manifest, args.data_root, args.output)


if __name__ == "__main__":
    main()
