"""Fail-closed dataset inspection before any training begins."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import wave
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
    duplicate_files: list[list[str]]
    wav_sample_rates: dict[str, int]
    wav_channels: dict[str, int]
    wav_duration_seconds: dict[str, float]
    unreadable_audio: list[str]
    label_balance: dict[str, int]
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


def _wav_metadata(path: Path) -> tuple[int, int, float]:
    with wave.open(str(path), "rb") as source:
        return source.getframerate(), source.getnchannels(), source.getnframes() / source.getframerate()


def _label_balance(path: Path | None) -> dict[str, int]:
    if not path:
        return {}
    try:
        with path.open(encoding="utf-8", newline="") as source:
            rows = csv.DictReader(source)
            if not rows.fieldnames or "label" not in rows.fieldnames:
                return {}
            counts: dict[str, int] = {}
            for row in rows:
                label = row.get("label")
                if label:
                    counts[label] = counts.get(label, 0) + 1
            return counts
    except (OSError, UnicodeDecodeError, csv.Error):
        return {}


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
    hashes = {str(path.relative_to(root)): _sha256(path) for path in audio_files}
    by_hash: dict[str, list[str]] = {}
    for relative, digest in hashes.items():
        by_hash.setdefault(digest, []).append(relative)
    duplicates = [paths for paths in by_hash.values() if len(paths) > 1]
    sample_rates: dict[str, int] = {}
    channels: dict[str, int] = {}
    durations: dict[str, float] = {}
    unreadable: list[str] = []
    for path in audio_files:
        if path.suffix.lower() != ".wav":
            continue
        relative = str(path.relative_to(root))
        try:
            rate, channel_count, duration = _wav_metadata(path)
            sample_rates[str(rate)] = sample_rates.get(str(rate), 0) + 1
            channels[str(channel_count)] = channels.get(str(channel_count), 0) + 1
            durations[relative] = duration
        except (EOFError, OSError, wave.Error):
            unreadable.append(relative)
    if duplicates:
        blockers.append("Duplicate audio content found; resolve it before speaker-disjoint splitting.")
    if unreadable:
        blockers.append("Unreadable WAV files found; training is blocked.")
    return DatasetAudit(
        root=str(root),
        kind=kind,
        audio_files=len(audio_files),
        tabular_files=len(tabular_files),
        sample_columns=columns,
        metadata_license=license_name,
        file_sha256=hashes,
        duplicate_files=duplicates,
        wav_sample_rates=sample_rates,
        wav_channels=channels,
        wav_duration_seconds=durations,
        unreadable_audio=unreadable,
        label_balance=_label_balance(csv_file),
        trainable_waveform=kind == "raw_audio" and bool(license_name) and not duplicates and not unreadable,
        blockers=blockers,
    )


def require_waveform_training(audit: DatasetAudit) -> None:
    if not audit.trainable_waveform:
        raise RuntimeError(" ".join(audit.blockers))


def audit_summary(audit: DatasetAudit) -> dict[str, object]:
    """Keep CLI logs reviewable while the JSON artifact retains per-file evidence."""
    return {
        "root": audit.root,
        "kind": audit.kind,
        "audio_files": audit.audio_files,
        "tabular_files": audit.tabular_files,
        "metadata_license": audit.metadata_license,
        "duplicate_groups": len(audit.duplicate_files),
        "duplicate_files": sum(len(group) for group in audit.duplicate_files),
        "unreadable_audio_files": len(audit.unreadable_audio),
        "wav_sample_rates": audit.wav_sample_rates,
        "wav_channels": audit.wav_channels,
        "label_balance": audit.label_balance,
        "trainable_waveform": audit.trainable_waveform,
        "blockers": audit.blockers,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    audit = audit_dataset(arguments.dataset)
    arguments.output.write_text(json.dumps(asdict(audit), indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(audit_summary(audit), ensure_ascii=False))


if __name__ == "__main__":
    main()
