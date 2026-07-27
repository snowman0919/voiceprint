import unittest

from voiceprint_ml.research_scaffold import (
    absolute_metrics,
    bootstrap_ci,
    descriptor_gate,
    manual_rows,
    pairwise_metrics,
    parse_absolute_rows,
    parse_pair_rows,
    repeated_grouped_folds,
    validate_right_stronger,
    validate_speaker_disjoint,
)


class ResearchScaffoldTests(unittest.TestCase):
    def test_manual_labels_cannot_be_silently_mixed_with_pseudo_labels(self) -> None:
        rows = parse_absolute_rows([
            {"utterance_id": "synthetic-1", "speaker_id": "speaker-1", "descriptor_id": "synthetic-tone", "label_kind": "manual", "value": 2.0, "rater_values": [1.0, 3.0]},
            {"utterance_id": "synthetic-2", "speaker_id": "speaker-2", "descriptor_id": "synthetic-tone", "label_kind": "pseudo", "value": 6.0},
        ])
        self.assertEqual([row.utterance_id for row in manual_rows(rows)], ["synthetic-1"])

    def test_grouped_fold_and_explicit_holdout_reject_speaker_leakage(self) -> None:
        rows = parse_absolute_rows([
            {"utterance_id": f"synthetic-{index}", "speaker_id": f"speaker-{index}", "descriptor_id": "synthetic-tone", "label_kind": "manual", "value": float(index)}
            for index in range(5)
        ])
        for train, test in repeated_grouped_folds(rows, folds=5, repeats=1):
            validate_speaker_disjoint([rows[index] for index in train], [rows[index] for index in test])
        with self.assertRaisesRegex(ValueError, "speaker leakage"):
            validate_speaker_disjoint([rows[0]], [rows[0]])

    def test_ordering_and_metrics_protect_pairwise_protocol(self) -> None:
        ordered = parse_pair_rows([{"descriptor_id": "synthetic-tone", "speaker_a": "a", "speaker_b": "b", "outcome": "B"}])
        validate_right_stronger(ordered)
        with self.assertRaisesRegex(ValueError, "right speaker"):
            validate_right_stronger(parse_pair_rows([{"descriptor_id": "synthetic-tone", "speaker_a": "a", "speaker_b": "b", "outcome": "tie"}]))
        self.assertEqual(pairwise_metrics(["A", "B", "A", "B"], [-2, 3, -1, 4])["accuracy"], 1.0)
        self.assertLess(pairwise_metrics(["A", "B", "A", "B"], [-2, 3, -1, 4])["eer"], 0.01)

    def test_metrics_and_bootstrap_have_numeric_decision_values(self) -> None:
        measured = absolute_metrics([1, 2, 3, 4], [1.1, 2.1, 2.9, 4.1])
        self.assertLess(measured["mae"], 0.2)
        low, high = bootstrap_ci([1, 2, 3, 4], samples=200)
        self.assertLess(low, high)

    def test_unverified_license_blocks_descriptor_activation(self) -> None:
        failures = descriptor_gate({"human_rated_labels": True, "license_verified": False})
        self.assertIn("license_verified", failures)
        self.assertIn("onnx_parity", failures)


if __name__ == "__main__":
    unittest.main()
