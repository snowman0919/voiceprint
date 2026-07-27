"""Speaker-disjoint training for the CC-BY TIS recording-condition corpus.

The corpus label means a speaker attempted to communicate trustworthy intent in
that recording.  It is not a personality, identity, or listener-rated trait.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
import torch
from scipy.io import wavfile
from scipy.signal import resample_poly
from sklearn.metrics import average_precision_score, balanced_accuracy_score, f1_score, roc_auc_score
from torch import nn
from torch.utils.data import DataLoader, Dataset

INTENT_LABELS = {"neutral": 0.0, "trustworthy": 1.0}


@dataclass(frozen=True)
class TisConfig:
    seed: int = 20260728
    sample_rate: int = 16_000
    input_seconds: int = 4
    batch_size: int = 16
    epochs: int = 35
    patience: int = 8
    learning_rate: float = 3e-4
    weight_decay: float = 1e-2
    num_workers: int = 0
    device: str = "auto"


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
        torch.backends.cudnn.benchmark = False
        torch.backends.cudnn.deterministic = True
    torch.use_deterministic_algorithms(True, warn_only=True)


def expected_calibration_error(probabilities: list[float], targets: list[float], bins: int = 10) -> float:
    """Equal-width ECE for a binary model; empty bins do not change the score."""
    if len(probabilities) != len(targets) or not probabilities or bins < 1:
        raise ValueError("calibration requires equally sized non-empty predictions and targets")
    scores = np.asarray(probabilities, dtype=np.float64)
    labels = np.asarray(targets, dtype=np.float64)
    if np.any(~np.isfinite(scores)) or np.any((scores < 0) | (scores > 1)) or np.any(~np.isfinite(labels)):
        raise ValueError("calibration inputs must be finite probabilities")
    total = len(scores)
    error = 0.0
    for index in range(bins):
        lower, upper = index / bins, (index + 1) / bins
        selected = (scores >= lower) & (scores < upper if index < bins - 1 else scores <= upper)
        if selected.any():
            error += selected.mean() * abs(scores[selected].mean() - labels[selected].mean())
    return float(error)


def waveform_from_wav(path: Path, sample_rate: int, samples: int) -> torch.Tensor:
    source_rate, source = wavfile.read(path)
    if source.ndim == 2:
        source = source.mean(axis=1)
    if np.issubdtype(source.dtype, np.integer):
        source = source.astype(np.float32) / float(np.iinfo(source.dtype).max)
    else:
        source = source.astype(np.float32)
    if source_rate != sample_rate:
        divisor = math.gcd(source_rate, sample_rate)
        source = resample_poly(source, sample_rate // divisor, source_rate // divisor).astype(np.float32)
    waveform = torch.from_numpy(np.ascontiguousarray(source)).unsqueeze(0)
    if waveform.shape[1] < samples:
        waveform = nn.functional.pad(waveform, (0, samples - waveform.shape[1]))
    return waveform[:, :samples]


class TisDataset(Dataset[tuple[torch.Tensor, torch.Tensor]]):
    def __init__(self, manifest: Path, root: Path, split: str, sample_rate: int, input_seconds: int) -> None:
        with manifest.open(encoding="utf-8", newline="") as source:
            rows = list(csv.DictReader(source))
        required = {"path", "speaker_id", "intent", "split"}
        if not rows or not required.issubset(rows[0]):
            raise ValueError("TIS manifest must contain path, speaker_id, intent, and split columns.")
        self.rows = [row for row in rows if row["split"] == split]
        if not self.rows:
            raise ValueError(f"TIS {split} split is empty.")
        if any(row["intent"] not in INTENT_LABELS for row in self.rows):
            raise ValueError("TIS manifest contains an unsupported intent label.")
        split_by_speaker: dict[str, set[str]] = {}
        for row in rows:
            split_by_speaker.setdefault(row["speaker_id"], set()).add(row["split"])
        leaked = [speaker for speaker, splits in split_by_speaker.items() if len(splits) != 1]
        if leaked:
            raise ValueError("TIS manifest leaks speaker IDs across splits.")
        self.root = root
        self.sample_rate = sample_rate
        self.samples = sample_rate * input_seconds

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor]:
        row = self.rows[index]
        waveform = waveform_from_wav(self.root / row["path"], self.sample_rate, self.samples)
        return waveform, torch.tensor(INTENT_LABELS[row["intent"]], dtype=torch.float32)


class TisIntentNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        channels = (1, 24, 48, 96, 128)
        layers: list[nn.Module] = []
        for source, target in zip(channels[:-1], channels[1:], strict=True):
            layers.extend((nn.Conv1d(source, target, kernel_size=9, stride=4, padding=4, bias=False), nn.BatchNorm1d(target), nn.GELU()))
        self.encoder = nn.Sequential(*layers, nn.AdaptiveAvgPool1d(1))
        self.head = nn.Sequential(nn.Flatten(), nn.Dropout(0.15), nn.Linear(channels[-1], 1))

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        return self.head(self.encoder(waveform)).squeeze(1)


def evaluate(model: nn.Module, loader: DataLoader, device: torch.device) -> tuple[dict[str, float], list[float], list[float]]:
    model.eval()
    logits: list[float] = []
    targets: list[float] = []
    losses: list[float] = []
    with torch.inference_mode():
        for waveform, target in loader:
            output = model(waveform.to(device))
            losses.append(nn.functional.binary_cross_entropy_with_logits(output, target.to(device)).item())
            logits.extend(output.cpu().tolist())
            targets.extend(target.tolist())
    probabilities = torch.sigmoid(torch.tensor(logits)).tolist()
    predicted = [score >= 0.5 for score in probabilities]
    return {
        "loss": float(np.mean(losses)),
        "auroc": float(roc_auc_score(targets, probabilities)),
        "average_precision": float(average_precision_score(targets, probabilities)),
        "balanced_accuracy": float(balanced_accuracy_score(targets, predicted)),
        "macro_f1": float(f1_score(targets, predicted, average="macro")),
        "expected_calibration_error": expected_calibration_error(probabilities, targets),
    }, probabilities, targets


def train_tis(config: TisConfig, manifest: Path, root: Path, output: Path) -> dict[str, object]:
    set_seed(config.seed)
    device = select_device(config.device)
    datasets = {split: TisDataset(manifest, root, split, config.sample_rate, config.input_seconds) for split in ("train", "validation", "test")}
    loaders = {
        "train": DataLoader(datasets["train"], batch_size=config.batch_size, shuffle=True, generator=torch.Generator().manual_seed(config.seed), num_workers=config.num_workers),
        "validation": DataLoader(datasets["validation"], batch_size=config.batch_size, shuffle=False, num_workers=config.num_workers),
        "test": DataLoader(datasets["test"], batch_size=config.batch_size, shuffle=False, num_workers=config.num_workers),
    }
    model = TisIntentNet().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay)
    output.parent.mkdir(parents=True, exist_ok=True)
    best_auc = -float("inf")
    stale_epochs = 0
    for epoch in range(1, config.epochs + 1):
        model.train()
        for waveform, target in loaders["train"]:
            optimizer.zero_grad(set_to_none=True)
            loss = nn.functional.binary_cross_entropy_with_logits(model(waveform.to(device)), target.to(device))
            loss.backward()
            optimizer.step()
        validation, _, _ = evaluate(model, loaders["validation"], device)
        print(json.dumps({"epoch": epoch, "validation": validation, "device": str(device)}))
        if validation["auroc"] > best_auc:
            best_auc = validation["auroc"]
            stale_epochs = 0
            torch.save({"state_dict": model.state_dict(), "config": asdict(config), "validation": validation}, output)
        else:
            stale_epochs += 1
            if stale_epochs >= config.patience:
                break
    payload = torch.load(output, map_location=device, weights_only=True)
    model.load_state_dict(payload["state_dict"])
    test, probabilities, targets = evaluate(model, loaders["test"], device)
    rows = datasets["test"].rows
    with output.with_suffix(".test-predictions.csv").open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["path", "speaker_id", "intent", "score"])
        writer.writeheader()
        writer.writerows({"path": row["path"], "speaker_id": row["speaker_id"], "intent": row["intent"], "score": score} for row, score in zip(rows, probabilities, strict=True))
    metrics: dict[str, object] = {"label": "speaker-produced trustworthy intent versus neutral", "device": str(device), "seed": config.seed, "validation": payload["validation"], "test": test, "test_examples": len(targets), "test_speakers": len({row["speaker_id"] for row in rows})}
    output.with_suffix(".metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics))
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=Path("ml/configs/tis.json"))
    parser.add_argument("--manifest", type=Path, default=Path("ml/data/tis/tis-split.csv"))
    parser.add_argument("--data-root", type=Path, default=Path("ml/data/tis"))
    parser.add_argument("--output", type=Path, default=Path("ml/checkpoints/tis-intent-v1.pt"))
    args = parser.parse_args()
    config = TisConfig(**json.loads(args.config.read_text(encoding="utf-8")))
    train_tis(config, args.manifest, args.data_root, args.output)


if __name__ == "__main__":
    main()
