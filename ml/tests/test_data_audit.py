import json
import tempfile
import unittest
import wave
from pathlib import Path

from voiceprint_ml.data_audit import audit_dataset, require_waveform_training


class DatasetAuditTest(unittest.TestCase):
    def test_scalar_dataset_cannot_enter_waveform_training(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "dataset-metadata.json").write_text(json.dumps({"licenseName": "CC-BY-4.0"}))
            (root / "voice.csv").write_text("meanfreq,label\n0.1,male\n")
            audit = audit_dataset(root)

            self.assertEqual(audit.kind, "scalar_only")
            with self.assertRaisesRegex(RuntimeError, "waveform CNN"):
                require_waveform_training(audit)

    def test_duplicate_wav_content_blocks_training_before_split(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "dataset-metadata.json").write_text(json.dumps({"licenseName": "CC-BY-4.0"}))
            for name in ("a.wav", "b.wav"):
                with wave.open(str(root / name), "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(16_000)
                    output.writeframes(b"\0\0" * 16_000)
            audit = audit_dataset(root)

            self.assertEqual(audit.wav_sample_rates, {"16000": 2})
            self.assertEqual(len(audit.duplicate_files), 1)
            with self.assertRaisesRegex(RuntimeError, "Duplicate audio content"):
                require_waveform_training(audit)


if __name__ == "__main__":
    unittest.main()
