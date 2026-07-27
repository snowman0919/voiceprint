"""Download the declared Kaggle source without placing credentials in this repository."""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

DEFAULT_DATASET = "murtadhanajim/gender-recognition-by-voiceoriginal"


def download_dataset(dataset: str, output: Path) -> None:
    """Invoke Kaggle only when the managed environment exposes its CLI."""
    executable = shutil.which("kaggle")
    if executable is None:
        raise RuntimeError("Kaggle CLI is unavailable. Run `make setup` before `make data-kaggle`.")
    output.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [executable, "datasets", "download", "-d", dataset, "-p", str(output), "--unzip"],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    try:
        download_dataset(arguments.dataset, arguments.output)
    except RuntimeError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()
