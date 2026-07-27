import tempfile
import unittest
from pathlib import Path

import torch

from voiceprint_ml.tis_model import TisIntentNet, TisDataset, expected_calibration_error


class TisModelTests(unittest.TestCase):
    def test_model_encoder_receives_gradient_from_binary_intent_loss(self):
        model = TisIntentNet()
        waveform = torch.randn(2, 1, 64_000)
        target = torch.tensor([0.0, 1.0])
        loss = torch.nn.functional.binary_cross_entropy_with_logits(model(waveform), target)
        loss.backward()
        self.assertGreater(float(model.encoder[0].weight.grad.abs().sum()), 0.0)

    def test_refuses_manifest_with_speaker_split_leakage(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "manifest.csv"
            manifest.write_text(
                """path,speaker_id,intent,split
a.wav,speaker,neutral,train
b.wav,speaker,trustworthy,test
""",
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "leaks speaker IDs"):
                TisDataset(manifest, Path(directory), "train", 16_000, 4)

    def test_calibration_error_separates_aligned_and_miscalibrated_scores(self):
        self.assertAlmostEqual(expected_calibration_error([0.1, 0.9], [0.0, 1.0]), 0.1)
        self.assertGreater(expected_calibration_error([0.9, 0.1], [0.0, 1.0]), 0.8)


if __name__ == "__main__":
    unittest.main()
