"""Fetch the CC-BY Trustworthy Intent in Speech corpus from its official OSF node."""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.error import HTTPError, URLError
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen

OSF_NODE = "45d8j"
ROOT_FILES = f"https://api.osf.io/v2/nodes/{OSF_NODE}/files/osfstorage/"
USER_AGENT = "Voiceprint-data-audit/0.1 (research dataset downloader)"
FILENAME = re.compile(r"^(?P<speaker>\d+)_[a-z]+_(?P<intent>[nt])\d+[a-z]*\.wav$", re.IGNORECASE)


@dataclass(frozen=True)
class RemoteFile:
    relative_path: Path
    download_url: str


def _request(url: str):
    with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=60) as response:
        return json.load(response)


def page_url(url: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.setdefault("page[size]", "100")
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def remote_files(url: str, prefix: Path = Path()) -> list[RemoteFile]:
    files: list[RemoteFile] = []
    next_page: str | None = page_url(url)
    while next_page:
        page = _request(next_page)
        for entry in page["data"]:
            attributes = entry["attributes"]
            path = prefix / attributes["name"]
            if attributes["kind"] == "folder":
                child_url = entry["relationships"]["files"]["links"]["related"]["href"]
                files.extend(remote_files(child_url, path))
            else:
                files.append(RemoteFile(path, entry["links"]["download"]))
        next_page = page.get("links", {}).get("next")
    return files


def retry_delay(error: Exception, attempt: int) -> int:
    if isinstance(error, HTTPError) and error.code == 429:
        retry_after = error.headers.get("Retry-After") if error.headers else None
        if retry_after and retry_after.isdigit():
            return max(5, int(retry_after))
        return 15 * (attempt + 1)
    return 2**attempt


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file() and destination.stat().st_size > 0:
        return
    temporary = destination.with_suffix(f"{destination.suffix}.partial")
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=120) as response, temporary.open("wb") as target:
                shutil.copyfileobj(response, target)
            temporary.replace(destination)
            return
        except (HTTPError, URLError, OSError, TimeoutError) as error:
            temporary.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(retry_delay(error, attempt))


def parse_filename(path: Path) -> tuple[str, str]:
    match = FILENAME.match(path.name)
    if not match:
        raise ValueError(f"TIS filename does not contain speaker/intent metadata: {path.name}")
    return match["speaker"], "trustworthy" if match["intent"].lower() == "t" else "neutral"


def write_manifest(output: Path) -> None:
    wav_files = sorted(output.rglob("*.wav"))
    rows = []
    for file in wav_files:
        speaker_id, intent = parse_filename(file)
        rows.append({"path": str(file.relative_to(output)), "speaker_id": speaker_id, "intent": intent})
    with (output / "tis-manifest.csv").open("w", encoding="utf-8", newline="") as target:
        writer = csv.DictWriter(target, fieldnames=["path", "speaker_id", "intent"])
        writer.writeheader()
        writer.writerows(rows)


def download_tis(output: Path) -> None:
    files = remote_files(ROOT_FILES)
    # OSF's public download endpoint rate-limits bursty clients.  Four workers
    # allow resumable progress without turning a transient 429 into a failure.
    with ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(lambda remote: download(remote.download_url, output / remote.relative_path), files))
    (output / "dataset-metadata.json").write_text(
        json.dumps(
            {
                "name": "Trustworthy Intent in Speech (TIS) Corpora Dataset",
                "source": f"https://osf.io/{OSF_NODE}/",
                "licenseName": "CC-BY-4.0",
                "citation": "Maltezou-Papastylianou, Scherer & Paulmann (2025), Scientific Data 12, 921.",
                "labelMeaning": "speaker-produced trustworthy intent versus neutral intent; not a listener-rated general voice impression",
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
    download_tis(arguments.output)


if __name__ == "__main__":
    main()
