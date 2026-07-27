"""Create a reproducible scalar audio-feature cache from a speaker manifest."""

from __future__ import annotations

import argparse
import csv
import wave
from pathlib import Path

import numpy as np
import pandas as pd


def read_pcm_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_rate = source.getframerate()
        width = source.getsampwidth()
        frames = source.readframes(source.getnframes())
    if channels != 1 or width not in {1, 2, 4}:
        raise ValueError(f"only mono 8/16/32-bit PCM WAV is supported: {path}")
    dtype = {1: np.uint8, 2: "<i2", 4: "<i4"}[width]
    raw = np.frombuffer(frames, dtype=dtype)
    if width == 1:
        return (raw.astype(np.float32) - 128.0) / 128.0, sample_rate
    return raw.astype(np.float32) / float(1 << (width * 8 - 1)), sample_rate


def scalar_features(samples: np.ndarray, sample_rate: int) -> dict[str, float]:
    if sample_rate <= 0 or samples.size == 0:
        raise ValueError("audio must contain samples at a positive sample rate")
    transitions = np.count_nonzero(np.signbit(samples[1:]) != np.signbit(samples[:-1]))
    return {
        "duration_seconds": samples.size / sample_rate,
        "sample_rate": float(sample_rate),
        "rms": float(np.sqrt(np.mean(np.square(samples, dtype=np.float64)))),
        "peak": float(np.max(np.abs(samples))),
        "clipping_ratio": float(np.mean(np.abs(samples) >= 0.999)),
        "zero_crossings_per_second": float(transitions * sample_rate / max(samples.size - 1, 1)),
        "dc_offset": float(np.mean(samples, dtype=np.float64)),
    }


def extract(manifest: Path, data_root: Path, output: Path) -> pd.DataFrame:
    with manifest.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    if not rows or not {"path", "speaker_id"}.issubset(rows[0]):
        raise ValueError("feature manifest requires path and speaker_id columns")
    records = []
    for row in rows:
        path = data_root / row["path"]
        samples, sample_rate = read_pcm_wav(path)
        records.append({"path": row["path"], "speaker_id": row["speaker_id"], **scalar_features(samples, sample_rate)})
    table = pd.DataFrame(records)
    output.parent.mkdir(parents=True, exist_ok=True)
    table.to_parquet(output, index=False)
    return table


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--data-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    table = extract(arguments.manifest, arguments.data_root, arguments.output)
    print({"records": len(table), "output": str(arguments.output)})


if __name__ == "__main__":
    main()
