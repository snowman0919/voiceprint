"""Compare one-frame Rust Burg-LPC estimates with Praat/Parselmouth output.

This is an offline validation tool only. It intentionally fails when the
selected frames are not comparable instead of manufacturing a pass rate.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np


def center_seconds(path: Path, frame_seconds: float) -> float:
    with wave.open(str(path)) as source:
        duration = source.getnframes() / source.getframerate()
    if duration < frame_seconds:
        raise ValueError(f"{path} is shorter than the requested frame")
    return (duration - frame_seconds) / 2


def rust_formants(path: Path, start_seconds: float, frame_seconds: float) -> tuple[float, float, float] | None:
    command = ["cargo", "run", "--quiet", "-p", "voice-dsp", "--bin", "formant_frame", "--", str(path), str(start_seconds), str(frame_seconds)]
    completed = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(completed.stdout)
    if payload is None:
        return None
    return (float(payload["f1Hz"]), float(payload["f2Hz"]), float(payload["f3Hz"]))


def praat_formants(path: Path, time_seconds: float) -> tuple[float, float, float] | None:
    try:
        import parselmouth
    except ImportError as error:
        raise RuntimeError("Install the locked ML environment with `make setup` before validating formants.") from error
    formant = parselmouth.Sound(str(path)).to_formant_burg(
        time_step=None,
        max_number_of_formants=5.0,
        maximum_formant=5_500.0,
        window_length=0.025,
        pre_emphasis_from=50.0,
    )
    values = tuple(formant.get_value_at_time(index, time_seconds) for index in (1, 2, 3))
    return values if all(value is not None and np.isfinite(value) for value in values) else None


def validate(paths: list[Path], frame_seconds: float, tolerance_hz: float, start_seconds: float | None = None) -> dict[str, float | int]:
    errors: list[np.ndarray] = []
    skipped = 0
    for path in paths:
        start = center_seconds(path, frame_seconds) if start_seconds is None else start_seconds
        rust = rust_formants(path, start, frame_seconds)
        praat = praat_formants(path, start + frame_seconds / 2)
        if rust is None or praat is None:
            skipped += 1
            continue
        errors.append(np.abs(np.asarray(rust) - np.asarray(praat)))
    if not errors:
        raise RuntimeError("No selected frame produced comparable Rust and Praat formants.")
    median_errors = np.median(np.stack(errors), axis=0)
    if float(np.max(median_errors)) > tolerance_hz:
        raise RuntimeError(f"Median formant deviation exceeds {tolerance_hz}Hz: {median_errors.tolist()}")
    return {"comparable_frames": len(errors), "skipped_frames": skipped, "median_f1_error_hz": float(median_errors[0]), "median_f2_error_hz": float(median_errors[1]), "median_f3_error_hz": float(median_errors[2]), "tolerance_hz": tolerance_hz}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("wav", nargs="+", type=Path)
    parser.add_argument("--frame-seconds", type=float, default=0.025)
    parser.add_argument("--tolerance-hz", type=float, default=600.0)
    parser.add_argument("--start-seconds", type=float)
    arguments = parser.parse_args()
    print(json.dumps(validate(arguments.wav, arguments.frame_seconds, arguments.tolerance_hz, arguments.start_seconds), indent=2))


if __name__ == "__main__":
    main()
