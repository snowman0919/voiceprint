import csv
import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np

from voiceprint_ml.extract_features import extract


class FeatureExtractionTests(unittest.TestCase):
    def test_pcm_cache_preserves_measured_loudness_and_pitch_like_crossing_rate(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sample_rate = 16_000
            samples = (0.5 * np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate) * 32767).astype("<i2")
            wav = root / "tone.wav"
            with wave.open(str(wav), "wb") as target:
                target.setnchannels(1)
                target.setsampwidth(2)
                target.setframerate(sample_rate)
                target.writeframes(samples.tobytes())
            manifest = root / "manifest.csv"
            manifest.write_text("path,speaker_id\ntone.wav,speaker-1\n", encoding="utf-8")
            table = extract(manifest, root, root / "features.parquet")
            record = table.iloc[0]
            self.assertAlmostEqual(record["duration_seconds"], 1.0, places=6)
            self.assertAlmostEqual(record["rms"], 0.5 / np.sqrt(2), delta=0.002)
            self.assertAlmostEqual(record["zero_crossings_per_second"], 880.0, delta=3.0)

    def test_refuses_a_manifest_without_speaker_grouping(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "manifest.csv"
            manifest.write_text("path\ntone.wav\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "speaker_id"):
                extract(manifest, Path(directory), Path(directory) / "features.parquet")
