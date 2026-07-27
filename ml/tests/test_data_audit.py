import json
import tempfile
import unittest
import wave
from pathlib import Path

from voiceprint_ml.data_audit import audit_dataset, audit_summary, require_waveform_training


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

    def test_records_label_balance_when_a_manifest_defines_labels(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "dataset-metadata.json").write_text(json.dumps({"licenseName": "CC-BY-4.0"}))
            (root / "voice.csv").write_text("speaker_id,label\n001,man\n002,woman\n003,man\n")
            self.assertEqual(audit_dataset(root).label_balance, {"man": 2, "woman": 1})

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

    def test_summary_keeps_blocker_counts_without_dumping_every_file_hash(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "dataset-metadata.json").write_text(json.dumps({"licenseName": "CC-BY-4.0"}))
            for name in ("a.wav", "b.wav"):
                with wave.open(str(root / name), "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(16_000)
                    output.writeframes(b"\0\0" * 16_000)
            summary = audit_summary(audit_dataset(root))
            self.assertEqual(summary["duplicate_groups"], 1)
            self.assertNotIn("file_sha256", summary)

    def test_raw_audio_without_speaker_ids_cannot_be_marked_trainable(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "dataset-metadata.json").write_text(json.dumps({"licenseName": "CC-BY-4.0"}))
            with wave.open(str(root / "only.wav"), "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16_000)
                output.writeframes(b"\0\0" * 16_000)
            audit = audit_dataset(root)
            self.assertFalse(audit.trainable_waveform)
            self.assertIn("speaker IDs", " ".join(audit.blockers))


if __name__ == "__main__":
    unittest.main()
