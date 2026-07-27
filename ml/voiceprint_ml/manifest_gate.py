"""Dependency-free safeguards shared by dataset inspection and training."""

from __future__ import annotations

from collections.abc import Iterable, Mapping

from .labels import OUTPUT_NAMES

FORBIDDEN_LABEL_COLUMNS = frozenset({"gender", "sex", "biological_sex", "identity", "speaker_name", "age"})
REQUIRED_COLUMNS = frozenset({"path", "speaker_id", "split", *OUTPUT_NAMES})


def validate_manifest_rows(rows: Iterable[Mapping[str, object]]) -> None:
    records = list(rows)
    if not records:
        raise ValueError("학습 manifest에 샘플이 없습니다.")
    columns = set(records[0])
    missing = REQUIRED_COLUMNS.difference(columns)
    if missing:
        raise ValueError(f"학습 manifest 필드 누락: {', '.join(sorted(missing))}")
    prohibited = FORBIDDEN_LABEL_COLUMNS.intersection(columns)
    if prohibited:
        raise ValueError(f"금지된 민감 라벨을 학습에 사용할 수 없습니다: {', '.join(sorted(prohibited))}")
    for record in records:
        for name in OUTPUT_NAMES:
            try:
                value = float(record[name])
            except (TypeError, ValueError) as error:
                raise ValueError(f"{name} 라벨은 수치여야 합니다.") from error
            if not 0 <= value <= 1:
                raise ValueError("인상 경향 라벨은 0~1 범위여야 합니다.")
