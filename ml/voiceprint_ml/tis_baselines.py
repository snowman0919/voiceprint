"""Speaker-disjoint handcrafted baselines for the licensed TIS corpus."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, balanced_accuracy_score, f1_score, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from .tis_model import INTENT_LABELS


def waveform_features(path: Path, target_rate: int = 16_000, seconds: int = 4) -> np.ndarray:
    """Compact waveform features; no listener traits or identity labels are used."""
    sample_rate, waveform = wavfile.read(path)
    if waveform.ndim == 2:
        waveform = waveform.mean(axis=1)
    if np.issubdtype(waveform.dtype, np.integer):
        waveform = waveform.astype(np.float32) / np.iinfo(waveform.dtype).max
    else:
        waveform = waveform.astype(np.float32)
    if sample_rate != target_rate:
        divisor = np.gcd(sample_rate, target_rate)
        waveform = resample_poly(waveform, target_rate // divisor, sample_rate // divisor).astype(np.float32)
    waveform = waveform[: target_rate * seconds]
    if waveform.size < target_rate * seconds:
        waveform = np.pad(waveform, (0, target_rate * seconds - waveform.size))
    rms = np.sqrt(np.mean(waveform**2))
    zero_crossing_rate = np.mean(waveform[1:] * waveform[:-1] < 0)
    spectrum = np.abs(np.fft.rfft(waveform * np.hanning(waveform.size))) ** 2
    frequencies = np.fft.rfftfreq(waveform.size, 1 / target_rate)
    energy = spectrum.sum()
    if energy <= 1e-12:
        return np.zeros(8, dtype=np.float32)
    centroid = np.sum(frequencies * spectrum) / energy
    bandwidth = np.sqrt(np.sum(((frequencies - centroid) ** 2) * spectrum) / energy)
    rolloff = frequencies[np.searchsorted(np.cumsum(spectrum), energy * 0.85)]
    flatness = np.exp(np.mean(np.log(np.maximum(spectrum, 1e-12)))) / np.mean(spectrum)
    band_ratios = [spectrum[(frequencies >= start) & (frequencies < end)].sum() / energy for start, end in ((0, 1_000), (1_000, 4_000), (4_000, 8_001))]
    return np.asarray([rms, zero_crossing_rate, centroid, bandwidth, rolloff, flatness, *band_ratios], dtype=np.float32)


def load_split(manifest: Path, root: Path) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    with manifest.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    required = {"path", "speaker_id", "intent", "split"}
    if not rows or not required.issubset(rows[0]):
        raise ValueError("TIS manifest must contain path, speaker_id, intent, and split columns.")
    by_speaker: dict[str, set[str]] = {}
    for row in rows:
        by_speaker.setdefault(row["speaker_id"], set()).add(row["split"])
    if any(len(splits) != 1 for splits in by_speaker.values()):
        raise ValueError("TIS baseline evaluation refuses speaker leakage across splits.")
    result: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for split in ("train", "validation", "test"):
        selected = [row for row in rows if row["split"] == split]
        features = np.stack([waveform_features(root / row["path"]) for row in selected])
        labels = np.asarray([INTENT_LABELS[row["intent"]] for row in selected], dtype=np.int64)
        result[split] = features, labels
    return result


def evaluate_baselines(manifest: Path, root: Path, output: Path, seed: int = 20260728) -> dict[str, dict[str, float]]:
    splits = load_split(manifest, root)
    train_features, train_labels = splits["train"]
    test_features, test_labels = splits["test"]
    models = {
        "logistic_regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2_000, random_state=seed)),
        "svm_rbf": make_pipeline(StandardScaler(), SVC(kernel="rbf", random_state=seed)),
        "random_forest": RandomForestClassifier(n_estimators=300, min_samples_leaf=3, n_jobs=-1, random_state=seed),
    }
    metrics: dict[str, dict[str, float]] = {}
    for name, model in models.items():
        model.fit(train_features, train_labels)
        scores = model.decision_function(test_features) if name == "svm_rbf" else model.predict_proba(test_features)[:, 1]
        predicted = model.predict(test_features)
        metrics[name] = {
            "auroc": float(roc_auc_score(test_labels, scores)),
            "average_precision": float(average_precision_score(test_labels, scores)),
            "balanced_accuracy": float(balanced_accuracy_score(test_labels, predicted)),
            "macro_f1": float(f1_score(test_labels, predicted, average="macro")),
        }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path("ml/data/tis/tis-split.csv"))
    parser.add_argument("--data-root", type=Path, default=Path("ml/data/tis"))
    parser.add_argument("--output", type=Path, default=Path("ml/checkpoints/tis-baselines.json"))
    parser.add_argument("--seed", type=int, default=20260728)
    arguments = parser.parse_args()
    print(json.dumps(evaluate_baselines(arguments.manifest, arguments.data_root, arguments.output, arguments.seed), indent=2))


if __name__ == "__main__":
    main()
