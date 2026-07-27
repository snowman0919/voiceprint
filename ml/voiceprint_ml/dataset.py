"""Dataset gate: only approved, speaker-disjoint, non-sensitive impression labels."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import pandas as pd

from .labels import OUTPUT_NAMES
from .manifest_gate import validate_manifest_rows

if TYPE_CHECKING:
    import torch

@dataclass(frozen=True)
class DatasetSpec:
    manifest: Path
    root: Path
    sample_rate: int
    input_seconds: int


def load_manifest(spec: DatasetSpec, split: str) -> pd.DataFrame:
    frame = pd.read_csv(spec.manifest)
    validate_manifest_rows(frame.to_dict("records"))
    selected = frame.loc[frame["split"] == split].copy()
    if selected.empty:
        raise ValueError(f"{split} split에 샘플이 없습니다.")
    return selected


class WaveformDataset:
    def __init__(self, spec: DatasetSpec, split: str) -> None:
        self.spec = spec
        self.frame = load_manifest(spec, split)
        self.samples = spec.sample_rate * spec.input_seconds

    def __len__(self) -> int:
        return len(self.frame)

    def __getitem__(self, index: int) -> tuple["torch.Tensor", "torch.Tensor"]:
        import torch
        import torchaudio
        row = self.frame.iloc[index]
        waveform, sample_rate = torchaudio.load(self.spec.root / row.path)
        waveform = waveform.mean(dim=0, keepdim=True)
        if sample_rate != self.spec.sample_rate:
            waveform = torchaudio.functional.resample(waveform, sample_rate, self.spec.sample_rate)
        if waveform.shape[1] < self.samples:
            waveform = torch.nn.functional.pad(waveform, (0, self.samples - waveform.shape[1]))
        else:
            waveform = waveform[:, :self.samples]
        target = torch.tensor(row.loc[list(OUTPUT_NAMES)].to_numpy(dtype="float32"))
        return waveform, target
