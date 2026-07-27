"""Download the declared Kaggle source without placing credentials in this repository."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

DEFAULT_DATASET = "murtadhanajim/gender-recognition-by-voiceoriginal"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    arguments.output.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["kaggle", "datasets", "download", "-d", arguments.dataset, "-p", str(arguments.output), "--unzip"],
        check=True,
    )


if __name__ == "__main__":
    main()
