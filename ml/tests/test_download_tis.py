import unittest
from pathlib import Path
from unittest.mock import patch

from voiceprint_ml.download_tis import page_url, parse_filename, remote_files


class TisDownloadTests(unittest.TestCase):
    def test_filename_preserves_documented_speaker_and_intent_labels(self):
        self.assertEqual(parse_filename(Path("1893_wof_n01.wav")), ("1893", "neutral"))
        self.assertEqual(parse_filename(Path("1901_bof_t05.wav")), ("1901", "trustworthy"))

    def test_refuses_filename_without_the_official_metadata_contract(self):
        with self.assertRaisesRegex(ValueError, "speaker/intent"):
            parse_filename(Path("unknown.wav"))

    def test_collects_every_osf_page_before_downloading_files(self):
        first = {
            "data": [
                {"attributes": {"name": "first.wav", "kind": "file"}, "links": {"download": "https://example/first"}}
            ],
            "links": {"next": "https://example/page-2"},
        }
        second = {
            "data": [
                {"attributes": {"name": "second.wav", "kind": "file"}, "links": {"download": "https://example/second"}}
            ],
            "links": {"next": None},
        }
        with patch("voiceprint_ml.download_tis._request", side_effect=[first, second]):
            self.assertEqual([file.relative_path.name for file in remote_files("https://example/page-1")], ["first.wav", "second.wav"])

    def test_requests_large_osf_pages_without_losing_existing_query_parameters(self):
        self.assertEqual(page_url("https://api.example/files?filter=name"), "https://api.example/files?filter=name&page%5Bsize%5D=100")


if __name__ == "__main__":
    unittest.main()
