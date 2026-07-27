import unittest

from voiceprint_ml.split import speaker_disjoint_split


class SpeakerSplitTest(unittest.TestCase):
    def test_repeated_speaker_never_leaks_between_splits(self) -> None:
        rows = [{"file": f"speaker-{speaker}-{clip}.wav", "speaker_id": f"speaker-{speaker}"} for speaker in range(20) for clip in range(3)]
        assigned = speaker_disjoint_split(rows)
        speaker_splits = {}
        for row in assigned:
            speaker_splits.setdefault(row["speaker_id"], set()).add(row["split"])

        self.assertTrue(all(len(splits) == 1 for splits in speaker_splits.values()))
        self.assertEqual(assigned, speaker_disjoint_split(rows))


if __name__ == "__main__":
    unittest.main()
