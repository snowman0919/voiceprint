import unittest

from voiceprint_ml.manifest_gate import validate_manifest_rows


class DatasetGateTests(unittest.TestCase):
    def test_rejects_biological_sex_label_before_training(self) -> None:
        row = {"path": "x.wav", "speaker_id": "a", "split": "train", "impression": 0.5, "brightness": 0.5, "softness": 0.5, "stability": 0.5, "gender": "female"}
        with self.assertRaisesRegex(ValueError, "금지된 민감 라벨"):
            validate_manifest_rows([row])
