"""Create the browser model manifest from the exact ONNX artifact bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def report_evidence_digest(path: Path | None, model_id: str, version: str) -> str:
    if path is None:
        raise ValueError("a report-evidence file is required before activating a report model")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        dataset = payload["dataset"]
        evaluation = payload["evaluation"]
        onnx = payload["onnx"]
        valid = (
            payload["schemaVersion"] == 1
            and payload["purpose"] == "voice-impression-report"
            and payload["modelId"] == model_id
            and payload["modelVersion"] == version
            and isinstance(dataset["consentedMultiRater"], bool)
            and dataset["consentedMultiRater"]
            and isinstance(dataset["speakerCount"], int)
            and dataset["speakerCount"] >= 100
            and isinstance(evaluation["heldOutSpeakerCount"], int)
            and evaluation["heldOutSpeakerCount"] >= 10
            and isinstance(evaluation["calibrationEce"], (int, float))
            and isinstance(onnx["maxAbsoluteError"], (int, float))
            and isinstance(payload["modelCard"], str)
            and payload["modelCard"]
        )
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("report-evidence is incomplete or invalid") from error
    if not valid:
        raise ValueError("report-evidence does not meet the report-model release gate")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def create_manifest(
    model: Path,
    *,
    model_id: str,
    version: str,
    input_sample_rate: int,
    input_seconds: int,
    opset: int,
    quantization: str,
    minimum_app_version: str,
    report_eligible: bool = False,
    report_evidence: Path | None = None,
) -> dict[str, object]:
    if not model.is_file() or model.suffix != ".onnx":
        raise ValueError("an existing .onnx artifact is required")
    if not model_id or not version or input_sample_rate <= 0 or not 0 < input_seconds <= 60 or opset <= 0 or not quantization or not minimum_app_version:
        raise ValueError("model manifest arguments are incomplete")
    payload = model.read_bytes()
    evidence_sha256 = report_evidence_digest(report_evidence, model_id, version) if report_eligible else None
    return {
        "schemaVersion": 1,
        "activeModel": model_id if report_eligible else None,
        "models": [{
            "id": model_id,
            "version": version,
            "url": f"/models/{model.name}",
            "size": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "inputSampleRate": input_sample_rate,
            "inputSeconds": input_seconds,
            "opset": opset,
            "quantization": quantization,
            "minimumAppVersion": minimum_app_version,
            "reportEligible": report_eligible,
            **({"reportEvidenceSha256": evidence_sha256} if evidence_sha256 else {}),
        }],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("--output", type=Path, default=Path("apps/web/public/model-manifest.json"))
    parser.add_argument("--model-id", default="voice-impression-v1")
    parser.add_argument("--version", required=True)
    parser.add_argument("--input-sample-rate", type=int, default=16_000)
    parser.add_argument("--input-seconds", type=int, default=20)
    parser.add_argument("--opset", type=int, default=18)
    parser.add_argument("--quantization", default="none")
    parser.add_argument("--minimum-app-version", default="0.1.0")
    parser.add_argument(
        "--report-eligible",
        action="store_true",
        help="activate only a purpose-audited model for user reports",
    )
    parser.add_argument("--report-evidence", type=Path, help="JSON evidence required with --report-eligible")
    arguments = parser.parse_args()
    manifest = create_manifest(
        arguments.model,
        model_id=arguments.model_id,
        version=arguments.version,
        input_sample_rate=arguments.input_sample_rate,
        input_seconds=arguments.input_seconds,
        opset=arguments.opset,
        quantization=arguments.quantization,
        minimum_app_version=arguments.minimum_app_version,
        report_eligible=arguments.report_eligible,
        report_evidence=arguments.report_evidence,
    )
    arguments.output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest))


if __name__ == "__main__":
    main()
