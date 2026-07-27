import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError

import pandas as pd
from unittest.mock import patch

from voiceprint_ml.download_palette_of_voices import direct_osf_file_url, download_rated_audio, expected_wav_files, speaker_id, verify_open_license, write_manifest


class PaletteOfVoicesDownloadTests(unittest.TestCase):
    def test_preserves_human_perception_columns_and_speaker_grouping(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in ("POV_001_sent01_X.wav", "POV_002_sent02_A.wav"):
                (root / filename).write_bytes(b"wav")
            pd.DataFrame(
                [
                    {"fileName": "POV_001_sent01_X", "CHF-Man": 20, "CHF-Woman": 70, "CHM-Man": 30, "CHM-Woman": 60, "GSE-Man": 40, "GSE-Woman": 50},
                    {"fileName": "POV_002_sent02_A", "CHF-Man": 80, "CHF-Woman": 10, "CHM-Man": 75, "CHM-Woman": 15, "GSE-Man": 65, "GSE-Woman": 25},
                ]
            ).to_excel(root / "MunsonDolquist2025_SummaryPerceptionData.xlsx", sheet_name="Data", index=False)
            write_manifest(root)
            rows = (root / "perception-manifest.csv").read_text(encoding="utf-8")
            self.assertIn("001", rows)
            self.assertIn("70", rows)

    def test_refuses_audio_without_the_documented_speaker_contract(self) -> None:
        with self.assertRaisesRegex(ValueError, "speaker ID"):
            speaker_id("unknown.wav")

    def test_uses_the_official_file_host_without_the_rate_limited_ui_redirect(self) -> None:
        self.assertEqual(
            direct_osf_file_url("https://osf.io/download/680697d41c21259fad63ee38/"),
            "https://files.osf.io/v1/resources/n3twm/providers/osfstorage/680697d41c21259fad63ee38",
        )

    def test_resolves_legacy_osf_aliases_before_requesting_the_file(self) -> None:
        with patch("voiceprint_ml.download_palette_of_voices.urlopen") as request:
            request.return_value.__enter__.return_value.geturl.return_value = "https://files.osf.io/v1/resources/n3twm/providers/osfstorage/current-id"
            self.assertEqual(
                direct_osf_file_url("https://osf.io/download/vqu4x/"),
                "https://files.osf.io/v1/resources/n3twm/providers/osfstorage/current-id",
            )

    def test_uses_only_audio_declared_by_the_human_perception_summary(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            summary = Path(directory) / "summary.xlsx"
            pd.DataFrame({"fileName": ["POV_001_sent01_X", "POV_002_sent02_A"]}).to_excel(summary, sheet_name="Data", index=False)
            self.assertEqual(expected_wav_files(summary), {"POV_001_sent01_X.wav", "POV_002_sent02_A.wav"})

    def test_names_the_failed_rated_audio_instead_of_hiding_a_partial_download(self) -> None:
        with patch("voiceprint_ml.download_palette_of_voices.download", side_effect=HTTPError("https://example", 404, "missing", None, None)):
            with self.assertRaisesRegex(RuntimeError, "POV_001_sent01_X.wav"):
                download_rated_audio("https://osf.io/download/file/", Path("POV_001_sent01_X.wav"))

    def test_refuses_download_when_the_osf_license_is_not_cc_by_4(self) -> None:
        node = {"data": {"relationships": {"license": {"links": {"related": {"href": "https://example/license"}}}}}}
        license = {"data": {"attributes": {"name": "CC-By-NC 4.0"}}}
        with patch("voiceprint_ml.download_palette_of_voices._request", side_effect=[node, license]):
            with self.assertRaisesRegex(ValueError, "not approved"):
                verify_open_license()
