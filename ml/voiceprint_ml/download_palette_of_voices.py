"""Download the CC-BY Palette of Voices stimuli and preserve human perception labels."""

from __future__ import annotations

import argparse
import csv
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

import pandas as pd

from .download_tis import _request, download, remote_files

OSF_NODE = "n3twm"
ROOT_FILES = f"https://api.osf.io/v2/nodes/{OSF_NODE}/files/osfstorage/"
NODE_URL = f"https://api.osf.io/v2/nodes/{OSF_NODE}/"
SUMMARY_FILE = "MunsonDolquist2025_SummaryPerceptionData.xlsx"
FILENAME = re.compile(r"^POV_(?P<speaker>\d{3})_sent\d{2}_[A-Z]\.wav$")


def speaker_id(filename: str) -> str:
    match = FILENAME.match(filename)
    if not match:
        raise ValueError(f"Palette of Voices filename has no documented speaker ID: {filename}")
    return match["speaker"]


def direct_osf_file_url(download_url: str) -> str:
    """Avoid the rate-limited UI redirect while retaining OSF's official file host."""
    file_id = urlsplit(download_url).path.rstrip("/").split("/")[-1]
    if not file_id:
        raise ValueError(f"OSF download URL has no file ID: {download_url}")
    if len(file_id) <= 5:
        # Older OSF aliases resolve to a current storage ID; deriving the URL
        # from the alias would produce a 404.
        with urlopen(Request(download_url, method="HEAD"), timeout=30) as response:
            return response.geturl()
    return f"https://files.osf.io/v1/resources/{OSF_NODE}/providers/osfstorage/{file_id}"


def verify_open_license() -> None:
    node = _request(NODE_URL)
    try:
        license_url = node["data"]["relationships"]["license"]["links"]["related"]["href"]
        license_name = _request(license_url)["data"]["attributes"]["name"]
    except (KeyError, TypeError) as error:
        raise ValueError("OSF project license is missing or unreadable; download is blocked") from error
    if license_name != "CC-By Attribution 4.0 International":
        raise ValueError(f"OSF project license is not approved for this download: {license_name}")


def write_manifest(output: Path) -> None:
    summary = output / SUMMARY_FILE
    if not summary.is_file():
        raise FileNotFoundError(f"missing official perception summary: {summary}")
    rows = pd.read_excel(summary, sheet_name="Data")
    required = {"fileName", "CHF-Man", "CHF-Woman", "CHM-Man", "CHM-Woman", "GSE-Man", "GSE-Woman"}
    missing = required.difference(rows.columns)
    if missing:
        raise ValueError(f"official perception summary is missing columns: {', '.join(sorted(missing))}")
    with (output / "perception-manifest.csv").open("w", encoding="utf-8", newline="") as target:
        fields = ["path", "speaker_id", "chf_man_pct", "chf_woman_pct", "chm_man_pct", "chm_woman_pct", "gse_man_pct", "gse_woman_pct"]
        writer = csv.DictWriter(target, fieldnames=fields)
        writer.writeheader()
        for record in rows.to_dict(orient="records"):
            filename = f"{record['fileName']}.wav"
            if not (output / filename).is_file():
                raise FileNotFoundError(f"summary row has no downloaded WAV: {filename}")
            writer.writerow(
                {
                    "path": filename,
                    "speaker_id": speaker_id(filename),
                    "chf_man_pct": record["CHF-Man"],
                    "chf_woman_pct": record["CHF-Woman"],
                    "chm_man_pct": record["CHM-Man"],
                    "chm_woman_pct": record["CHM-Woman"],
                    "gse_man_pct": record["GSE-Man"],
                    "gse_woman_pct": record["GSE-Woman"],
                }
            )


def expected_wav_files(summary: Path) -> set[str]:
    rows = pd.read_excel(summary, sheet_name="Data")
    if "fileName" not in rows:
        raise ValueError("official perception summary is missing fileName")
    return {f"{name}.wav" for name in rows["fileName"].dropna()}


def download_rated_audio(download_url: str, destination: Path) -> None:
    try:
        download(direct_osf_file_url(download_url), destination)
    except Exception as error:
        raise RuntimeError(f"failed to download rated audio {destination.name}") from error


def download_palette_of_voices(output: Path) -> None:
    verify_open_license()
    files = remote_files(ROOT_FILES)
    summary_remote = next((file for file in files if file.relative_path.name == SUMMARY_FILE), None)
    if summary_remote is None:
        raise FileNotFoundError("official perception summary is absent from OSF")
    summary_path = output / SUMMARY_FILE
    download(direct_osf_file_url(summary_remote.download_url), summary_path)
    expected = expected_wav_files(summary_path)
    selected = [file for file in files if file.relative_path.name in expected]
    if len(selected) != len(expected):
        found = {file.relative_path.name for file in selected}
        raise FileNotFoundError(f"OSF is missing {len(expected.difference(found))} rated audio files")
    # Keep OSF requests resumable while avoiding a long serial download.
    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(lambda remote: download_rated_audio(remote.download_url, output / remote.relative_path), selected))
    (output / "dataset-metadata.json").write_text(
        json.dumps(
            {
                "name": "Palette of Voices / Munson and Dolquist (2025) Materials",
                "source": f"https://osf.io/{OSF_NODE}/",
                "licenseName": "CC-BY-4.0",
                "citation": "Munson & Dolquist (2025), The Perception of (Trans)masculinity in Speech.",
                "labelMeaning": "Human listener-group percentages for perceived Man/Woman categories; not speaker identity or biological sex.",
                "reportModelStatus": "candidate only: limited to 20 documented speakers and categorical perception labels; not eligible for a user-report model.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    write_manifest(output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    download_palette_of_voices(arguments.output)


if __name__ == "__main__":
    main()
