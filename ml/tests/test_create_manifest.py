import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from voiceprint_ml.create_manifest import create_manifest
from voiceprint_ml.verify_manifest import verify_manifest


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

    def test_rejects_manifest_when_the_packaged_artifact_changes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "public"
            artifact = root / "models" / "model.onnx"
            artifact.parent.mkdir(parents=True)
            artifact.write_bytes(b"reference-bytes")
            manifest = root / "model-manifest.json"
            manifest.write_text(
                json.dumps(create_manifest(artifact, model_id="model", version="1.0.0", input_sample_rate=16_000, input_seconds=4, opset=18, quantization="none", minimum_app_version="0.1.0")),
                encoding="utf-8",
            )
            self.assertEqual(verify_manifest(manifest, root), {"models": 1, "active": 1})
            artifact.write_bytes(b"modified--bytes")
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                verify_manifest(manifest, root)
