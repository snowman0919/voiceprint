import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from voiceprint_ml.download_kaggle import download_dataset


class KaggleDownloadTests(unittest.TestCase):
    def test_refuses_download_before_invoking_a_missing_cli(self):
        with tempfile.TemporaryDirectory() as directory, patch("voiceprint_ml.download_kaggle.shutil.which", return_value=None), patch(
            "voiceprint_ml.download_kaggle.subprocess.run"
        ) as run:
            with self.assertRaisesRegex(RuntimeError, "make setup"):
                download_dataset("owner/dataset", Path(directory) / "data")
            run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
