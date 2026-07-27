import unittest
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from voiceprint_ml.download_tis import download, page_url, parse_filename, remote_files, retry_delay


class TisDownloadTests(unittest.TestCase):
    def test_filename_preserves_documented_speaker_and_intent_labels(self):
        self.assertEqual(parse_filename(Path("1893_wof_n01.wav")), ("1893", "neutral"))
        self.assertEqual(parse_filename(Path("1901_bof_t05.wav")), ("1901", "trustworthy"))
        self.assertEqual(parse_filename(Path("1923_wom_t07c_version2.wav")), ("1923", "trustworthy"))

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

    def test_retries_a_temporary_download_failure_before_writing_a_final_file(self):
        with self.assertRaises(URLError), patch("voiceprint_ml.download_tis.urlopen", side_effect=URLError("offline")), patch(
            "voiceprint_ml.download_tis.time.sleep"
        ) as sleep:
            download("https://example/audio.wav", Path("/tmp/voiceprint-unreachable.wav"))
        self.assertEqual(sleep.call_count, 3)

    def test_honors_osf_rate_limit_backoff_before_retrying(self):
        headers = Message()
        headers["Retry-After"] = "23"
        error = HTTPError("https://osf.io/download/example", 429, "Too Many Requests", headers, None)
        self.assertEqual(retry_delay(error, 0), 23)


if __name__ == "__main__":
    unittest.main()
