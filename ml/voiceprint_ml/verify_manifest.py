"""Verify that a static model manifest describes exact local artifact bytes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def verify_manifest(manifest_path: Path, public_root: Path) -> dict[str, int]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("models"), list):
        raise ValueError("model manifest schema is invalid")
    models = manifest["models"]
    active = manifest.get("activeModel")
    if active is not None and active not in {model.get("id") for model in models}:
        raise ValueError("active model is not listed in the manifest")
    for model in models:
        if not isinstance(model, dict) or not isinstance(model.get("url"), str) or not model["url"].startswith("/models/"):
            raise ValueError("model URL must remain under /models/")
        if not isinstance(model.get("reportEligible"), bool):
            raise ValueError("model report eligibility must be explicit")
        artifact = public_root / model["url"].lstrip("/")
        if not artifact.is_file():
            raise ValueError(f"model artifact is missing: {artifact}")
        payload = artifact.read_bytes()
        if model.get("size") != len(payload):
            raise ValueError(f"model size does not match: {artifact}")
        if model.get("sha256") != hashlib.sha256(payload).hexdigest():
            raise ValueError(f"model SHA-256 does not match: {artifact}")
    if active is not None and not next(model["reportEligible"] for model in models if model["id"] == active):
        raise ValueError("a non-report model cannot be active")
    return {"models": len(models), "active": int(active is not None)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path, nargs="?", default=Path("apps/web/public/model-manifest.json"))
    parser.add_argument("--public-root", type=Path, default=Path("apps/web/public"))
    arguments = parser.parse_args()
    print(json.dumps(verify_manifest(arguments.manifest, arguments.public_root)))


if __name__ == "__main__":
    main()
