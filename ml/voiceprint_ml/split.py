"""Deterministic speaker-disjoint splits for validated dataset manifests."""

from __future__ import annotations

import argparse
import csv
import random
from collections import defaultdict
from pathlib import Path
from typing import Iterable


def speaker_disjoint_split(rows: Iterable[dict[str, str]], seed: int = 42) -> list[dict[str, str]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        speaker = row.get("speaker_id")
        if not speaker:
            raise ValueError("speaker_id is required; file-level split would leak speaker identity.")
        grouped[speaker].append(dict(row))
    speakers = list(grouped)
    if len(speakers) < 3:
        raise ValueError("at least three speakers are required for train/validation/test separation.")
    validation_count = max(1, round(len(speakers) * 0.1))
    test_count = max(1, round(len(speakers) * 0.1))
    train_count = len(speakers) - validation_count - test_count
    if train_count < 1:
        raise ValueError("speaker split leaves no training speakers.")
    # ponytail: stratify by mean brightness via decile buckets + per-bucket target-ratio split.
    # 78 speakers → label-balanced splits. Upgrade: multi-label stratification if dim>4 matters.
    import statistics
    speaker_brightness = {}
    for spk, clips in grouped.items():
        vals = [float(r["brightness"]) for r in clips if r.get("brightness") not in (None, "")]
        speaker_brightness[spk] = statistics.mean(vals) if vals else 0.5
    sorted_speakers = sorted(speakers, key=lambda s: speaker_brightness[s])
    # decile buckets; within each, assign by target ratio train/val/test
    n = len(sorted_speakers)
    n_buckets = min(10, n)
    output: list[dict[str, str]] = []
    bucket_size = n / n_buckets
    rng = random.Random(seed)
    target_total = {"train": train_count, "validation": validation_count, "test": test_count}
    counts = {"train": 0, "validation": 0, "test": 0}
    for b in range(n_buckets):
        start = int(round(b * bucket_size))
        end = int(round((b + 1) * bucket_size))
        bucket = sorted_speakers[start:end]
        rng.shuffle(bucket)
        # split this bucket by target ratio
        b_n = len(bucket)
        b_val = max(1, round(b_n * 0.1))
        b_test = max(1, round(b_n * 0.1))
        b_train = b_n - b_val - b_test
        # respect overall capacity; only add if counts under target
        i = 0
        for split_name, cap in [("train", b_train), ("validation", b_val), ("test", b_test)]:
            taken = 0
            while taken < cap and i < len(bucket) and counts[split_name] < target_total[split_name]:
                output.extend({**row, "split": split_name} for row in grouped[bucket[i]])
                counts[split_name] += 1
                taken += 1
                i += 1
        # leftover bucket speakers go to any underfilled split
        while i < len(bucket):
            for alt in ("train", "validation", "test"):
                if counts[alt] < target_total[alt]:
                    output.extend({**row, "split": alt} for row in grouped[bucket[i]])
                    counts[alt] += 1
                    i += 1
                    break
            else:
                i += 1
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--seed", type=int, default=42)
    arguments = parser.parse_args()
    with arguments.input.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    split_rows = speaker_disjoint_split(rows, arguments.seed)
    if not split_rows:
        raise ValueError("manifest is empty")
    with arguments.output.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=list(split_rows[0]))
        writer.writeheader()
        writer.writerows(split_rows)


if __name__ == "__main__":
    main()
