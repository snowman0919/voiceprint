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
    random.Random(seed).shuffle(speakers)
    targets = (round(len(speakers) * 0.8), round(len(speakers) * 0.1))
    output: list[dict[str, str]] = []
    for index, speaker in enumerate(speakers):
        split = "train" if index < targets[0] else "validation" if index < sum(targets) else "test"
        output.extend({**row, "split": split} for row in grouped[speaker])
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
