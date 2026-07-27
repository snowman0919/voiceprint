"""Small waveform model for non-diagnostic acoustic-impression tendencies."""

from __future__ import annotations

import torch
from torch import nn

from .labels import OUTPUT_NAMES


class VoiceImpressionNet(nn.Module):
    """A compact strided CNN that accepts mono 16 kHz waveform segments."""

    def __init__(self, outputs: int = len(OUTPUT_NAMES)) -> None:
        super().__init__()
        channels = (1, 24, 48, 96, 128)
        layers: list[nn.Module] = []
        for source, target in zip(channels, channels[1:], strict=True):
            layers.extend((
                nn.Conv1d(source, target, kernel_size=9, stride=4, padding=4, bias=False),
                nn.BatchNorm1d(target),
                nn.GELU(),
            ))
        self.encoder = nn.Sequential(*layers, nn.AdaptiveAvgPool1d(1))
        self.head = nn.Sequential(nn.Flatten(), nn.Dropout(0.15), nn.Linear(channels[-1], outputs))

    def forward(self, waveform: torch.Tensor) -> torch.Tensor:
        return torch.sigmoid(self.head(self.encoder(waveform)))
