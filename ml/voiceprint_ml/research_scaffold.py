"""License-safe evaluation primitives; callers supply only approved annotations."""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from math import sqrt
from random import Random

import numpy as np
from scipy.stats import pearsonr, spearmanr
from sklearn.metrics import roc_curve


@dataclass(frozen=True)
class AbsoluteRow:
    utterance_id: str
    speaker_id: str
    descriptor_id: str
    label_kind: str  # "manual" or "pseudo" only
    value: float
    rater_values: tuple[float, ...] = ()


@dataclass(frozen=True)
class PairRow:
    descriptor_id: str
    speaker_a: str
    speaker_b: str
    outcome: str  # "A", "tie", or "B"; B means right side is stronger


def parse_absolute_rows(rows: Iterable[Mapping[str, object]]) -> list[AbsoluteRow]:
    parsed: list[AbsoluteRow] = []
    for index, row in enumerate(rows, start=1):
        try:
            kind = str(row["label_kind"])
            value = float(row["value"])
            raters = tuple(float(item) for item in row.get("rater_values", ()))
            result = AbsoluteRow(str(row["utterance_id"]), str(row["speaker_id"]), str(row["descriptor_id"]), kind, value, raters)
        except (KeyError, TypeError, ValueError) as error:
            raise ValueError(f"absolute row {index} is malformed") from error
        if kind not in {"manual", "pseudo"} or not result.utterance_id or not result.speaker_id or not result.descriptor_id:
            raise ValueError(f"absolute row {index} has invalid identity or label kind")
        parsed.append(result)
    return parsed


def manual_rows(rows: Iterable[AbsoluteRow]) -> list[AbsoluteRow]:
    return [row for row in rows if row.label_kind == "manual"]


def pseudo_rows(rows: Iterable[AbsoluteRow]) -> list[AbsoluteRow]:
    return [row for row in rows if row.label_kind == "pseudo"]


def validate_speaker_disjoint(train: Iterable[AbsoluteRow], held_out: Iterable[AbsoluteRow]) -> None:
    leaked = {row.speaker_id for row in train}.intersection(row.speaker_id for row in held_out)
    if leaked:
        raise ValueError(f"speaker leakage: {', '.join(sorted(leaked))}")


def repeated_grouped_folds(rows: Sequence[AbsoluteRow], *, folds: int = 5, repeats: int = 3, seed: int = 20260728) -> list[tuple[list[int], list[int]]]:
    speakers = sorted({row.speaker_id for row in rows})
    if len(speakers) < folds:
        raise ValueError("not enough speakers for grouped folds")
    output: list[tuple[list[int], list[int]]] = []
    for repeat in range(repeats):
        shuffled = speakers[:]
        Random(seed + repeat).shuffle(shuffled)
        buckets = [set(shuffled[index::folds]) for index in range(folds)]
        for held_out_speakers in buckets:
            test = [index for index, row in enumerate(rows) if row.speaker_id in held_out_speakers]
            train = [index for index, row in enumerate(rows) if row.speaker_id not in held_out_speakers]
            output.append((train, test))
    return output


def leave_one_out_oof(rows: Sequence[AbsoluteRow]) -> list[tuple[list[int], list[int]]]:
    return [([other for other in range(len(rows)) if other != index], [index]) for index in range(len(rows))]


def parse_pair_rows(rows: Iterable[Mapping[str, object]]) -> list[PairRow]:
    parsed: list[PairRow] = []
    for index, row in enumerate(rows, start=1):
        try:
            pair = PairRow(str(row["descriptor_id"]), str(row["speaker_a"]), str(row["speaker_b"]), str(row["outcome"]))
        except KeyError as error:
            raise ValueError(f"pair row {index} is malformed") from error
        if not pair.descriptor_id or not pair.speaker_a or not pair.speaker_b or pair.speaker_a == pair.speaker_b or pair.outcome not in {"A", "tie", "B"}:
            raise ValueError(f"pair row {index} is invalid")
        parsed.append(pair)
    return parsed


def validate_right_stronger(rows: Iterable[PairRow]) -> None:
    invalid = [row for row in rows if row.outcome != "B"]
    if invalid:
        raise ValueError("ordered VCTK-RVA rows must encode the right speaker as stronger; ties require an explicit non-ordered schema")


def absolute_metrics(y_true: Sequence[float], y_pred: Sequence[float], *, ordinal_levels: int = 7) -> dict[str, float]:
    actual, predicted = np.asarray(y_true, dtype=float), np.asarray(y_pred, dtype=float)
    if actual.size < 2 or actual.shape != predicted.shape:
        raise ValueError("matching at least two predictions are required")
    error = predicted - actual
    return {
        "mae": float(np.mean(np.abs(error))),
        "rmse": float(sqrt(np.mean(error**2))),
        "spearman": float(spearmanr(actual, predicted).statistic),
        "pearson": float(pearsonr(actual, predicted).statistic),
        "ordinal_agreement": float(np.mean(np.rint(np.clip(actual, 1, ordinal_levels)) == np.rint(np.clip(predicted, 1, ordinal_levels)))),
        "calibration_bias": float(np.mean(error)),
    }


def pairwise_metrics(outcomes: Sequence[str], scores: Sequence[float]) -> dict[str, float]:
    if len(outcomes) != len(scores) or not outcomes or any(item not in {"A", "B"} for item in outcomes):
        raise ValueError("binary A/B outcomes and matching scores are required for ACC/EER")
    target = np.asarray([item == "B" for item in outcomes], dtype=int)
    score = np.asarray(scores, dtype=float)
    accuracy = float(np.mean((score >= 0) == target))
    fpr, tpr, _ = roc_curve(target, score)
    eer = float(fpr[np.argmin(np.abs(fpr - (1 - tpr)))])
    return {"accuracy": accuracy, "eer": eer}


def bootstrap_ci(values: Sequence[float], *, samples: int = 1000, seed: int = 20260728) -> tuple[float, float]:
    if not values:
        raise ValueError("bootstrap needs values")
    array = np.asarray(values, dtype=float)
    generator = np.random.default_rng(seed)
    means = [float(generator.choice(array, size=array.size, replace=True).mean()) for _ in range(samples)]
    return (float(np.quantile(means, 0.025)), float(np.quantile(means, 0.975)))


def descriptor_gate(evidence: Mapping[str, object]) -> list[str]:
    required_truths = ("human_rated_labels", "license_verified", "speaker_disjoint", "beats_majority", "beats_acoustic", "bootstrap_ci", "no_severe_subgroup_failure", "onnx_parity", "browser_latency", "model_card", "wording_matches_label")
    return [name for name in required_truths if evidence.get(name) is not True]


def descriptor_counts(rows: Iterable[PairRow]) -> dict[str, int]:
    return dict(Counter(row.descriptor_id for row in rows))
