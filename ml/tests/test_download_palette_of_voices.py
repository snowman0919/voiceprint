import tempfile
import unittest
from pathlib import Path

import pandas as pd

from voiceprint_ml.download_palette_of_voices import speaker_id, write_manifest


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
