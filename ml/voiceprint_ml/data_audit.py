"""Fail-closed dataset inspection before any training begins."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path

AUDIO_SUFFIXES = {".wav", ".flac", ".mp3", ".ogg", ".m4a", ".webm"}


@dataclass(frozen=True)
class DatasetAudit:
    root: str
    kind: str
    audio_files: int
    tabular_files: int
    sample_columns: list[str]
    metadata_license: str | None
    file_sha256: dict[str, str]
    trainable_waveform: bool
    blockers: list[str]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _metadata_license(root: Path) -> str | None:
    metadata = root / "dataset-metadata.json"
    if not metadata.exists():
        return None
    try:
        payload = json.loads(metadata.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return payload.get("licenseName") or payload.get("license")


def audit_dataset(root: Path) -> DatasetAudit:
    files = [path for path in root.rglob("*") if path.is_file()]
    audio_files = [path for path in files if path.suffix.lower() in AUDIO_SUFFIXES]
    tabular_files = [path for path in files if path.suffix.lower() in {".csv", ".tsv", ".parquet"}]
    columns: list[str] = []
    csv_file = next((path for path in tabular_files if path.suffix.lower() in {".csv", ".tsv"}), None)
    if csv_file:
        with csv_file.open(encoding="utf-8", newline="") as source:
            columns = next(csv.reader(source), [])
    license_name = _metadata_license(root)
    blockers: list[str] = []
    if not license_name:
        blockers.append("Dataset license is missing or unreadable; training is blocked.")
    if audio_files:
        kind = "raw_audio"
    elif tabular_files:
        kind = "scalar_only"
        blockers.append("No original audio found; waveform CNN and hybrid training are blocked.")
    else:
        kind = "unknown"
        blockers.append("No supported audio or tabular files found.")
    hashes = {str(path.relative_to(root)): _sha256(path) for path in files if path.suffix.lower() in AUDIO_SUFFIXES}
    return DatasetAudit(
        root=str(root),
        kind=kind,
        audio_files=len(audio_files),
        tabular_files=len(tabular_files),
        sample_columns=columns,
        metadata_license=license_name,
        file_sha256=hashes,
        trainable_waveform=kind == "raw_audio" and bool(license_name),
        blockers=blockers,
    )


def require_waveform_training(audit: DatasetAudit) -> None:
    if not audit.trainable_waveform:
        raise RuntimeError(" ".join(audit.blockers))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    audit = audit_dataset(arguments.dataset)
    arguments.output.write_text(json.dumps(asdict(audit), indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(asdict(audit), ensure_ascii=False))


if __name__ == "__main__":
    main()
