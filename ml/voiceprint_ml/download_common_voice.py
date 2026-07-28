"""Download Common Voice (CC0-1.0) from HF Hub parquet, prepare training manifest.

Common Voice is CC0-1.0 licensed — public domain, no redistribution restrictions.
"""

from __future__ import annotations

import argparse
import csv
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download

REPO = "fixie-ai/common_voice_17_0"
TARGET_DIR = "ml/data/common-voice"
# gender values in CV17 en: "male_masculine", "female_feminine", "" (empty)
VALID_GENDERS = frozenset({"male_masculine", "female_feminine"})


def _download_parquet(lang: str, split: str, shard: int, total: int) -> Path:
    path = f"{lang}/{split}-{shard:05d}-of-{total:05d}.parquet"
    return Path(hf_hub_download(REPO, path, repo_type="dataset"))


def _read_parquet(path: Path) -> list[dict[str, object]]:
    """Read parquet, unnest audio.bytes → 'bytes' key."""
    table = pq.read_table(path, columns=["client_id", "gender", "path", "audio.bytes"])
    # pyarrow flattens audio.bytes → top-level 'bytes' column
    return table.to_pylist()


def _filter_rows(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    for r in rows:
        g = r.get("gender")
        if isinstance(g, str) and g.strip() in VALID_GENDERS:
            out.append(r)
    return out


def _extract_audio(
    rows: list[dict[str, object]],
    clips_dir: Path,
    workers: int = 8,
) -> list[dict[str, str]]:
    clips_dir.mkdir(parents=True, exist_ok=True)
    results: list[dict[str, str]] = []

    def _process(row: dict[str, object]) -> dict[str, str] | None:
        mp3_bytes = row.get("bytes")
        if not isinstance(mp3_bytes, (bytes, bytearray)):
            return None
        path_str = str(row.get("path", ""))
        if not path_str:
            return None
        cid = str(row.get("client_id", "")).strip()
        gender = str(row.get("gender", "")).strip().lower()
        stem = Path(path_str).stem
        wav_path = clips_dir / f"{stem}.wav"
        if not wav_path.exists():
            mp3_tmp = clips_dir / f"{stem}.mp3"
            mp3_tmp.write_bytes(mp3_bytes)
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(mp3_tmp), "-ac", "1", "-ar", "16000", str(wav_path)],
                capture_output=True,
                check=True,
            )
            mp3_tmp.unlink(missing_ok=True)
        # Store path relative to repo root for manifest
        rel = wav_path.relative_to(clips_dir.parent.parent.parent)
        return {
            "path": str(rel),
            "speaker_id": cid,
            "impression": "1.0" if gender == "female_feminine" else "0.0",
            "brightness": "0.5",
            "softness": "0.5",
            "stability": "0.5",
        }

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for f in as_completed(pool.submit(_process, r) for r in rows):
            result = f.result()
            if result:
                results.append(result)
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="en")
    parser.add_argument("--train-files", type=int, default=3)
    parser.add_argument("--test-files", type=int, default=1)
    parser.add_argument("--val-files", type=int, default=1)
    parser.add_argument("--output", type=Path, default=Path(TARGET_DIR))
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    output = args.output.resolve()
    clips_dir = output / "clips"
    manifest_path = output / "manifest_raw.csv"
    os.makedirs(output, exist_ok=True)

    # CV17 en split counts: train=90, validation=19, test=19
    specs: list[tuple[str, int, int]] = []
    for i in range(args.train_files):
        specs.append(("train", i, 90))
    for i in range(args.val_files):
        specs.append(("validation", i, 19))
    for i in range(args.test_files):
        specs.append(("test", i, 19))

    print(f"[common-voice] downloading {args.lang} ({args.train_files}T/{args.val_files}V/{args.test_files}Te shards)")

    manifest_rows: list[dict[str, str]] = []
    for split, shard, total in specs:
        print(f"  {split} shard {shard}/{total}")
        parquet_path = _download_parquet(args.lang, split, shard, total)
        rows = _read_parquet(parquet_path)
        filtered = _filter_rows(rows)
        print(f"    {len(rows)} total → {len(filtered)} with gender labels")
        extracted = _extract_audio(filtered, clips_dir, args.workers)
        for r in extracted:
            r["split"] = split
        manifest_rows.extend(extracted)
        print(f"    extracted: {len(extracted)} clips")

    print(f"\nTotal: {len(manifest_rows)} clips, {len(set(r['speaker_id'] for r in manifest_rows))} speakers")

    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["path", "speaker_id", "impression", "brightness", "softness", "stability", "split"])
        w.writeheader()
        w.writerows(manifest_rows)
    print(f"Manifest: {manifest_path}")


if __name__ == "__main__":
    main()
