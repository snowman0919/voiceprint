import hashlib
import tempfile
import unittest
from pathlib import Path

from voiceprint_ml.create_manifest import create_manifest


class ModelManifestTests(unittest.TestCase):
    def test_manifest_hashes_the_exact_browser_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            model = Path(directory) / "voice-impression-v1.onnx"
            payload = b"onnx-artifact-bytes"
            model.write_bytes(payload)

            manifest = create_manifest(model, model_id="voice-impression-v1", version="1.0.0", input_sample_rate=16_000, input_seconds=20, opset=18, quantization="int8-dynamic", minimum_app_version="0.1.0")

            entry = manifest["models"][0]
            self.assertEqual(entry["size"], len(payload))
            self.assertEqual(entry["sha256"], hashlib.sha256(payload).hexdigest())
            self.assertEqual(entry["url"], "/models/voice-impression-v1.onnx")
