import json
import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
