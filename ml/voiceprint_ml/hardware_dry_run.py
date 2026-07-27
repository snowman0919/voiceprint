"""Report whether a real CUDA 3080 dry-run can be executed; never invent a benchmark."""

from __future__ import annotations

import argparse
import json


def run(required_device: str = "RTX 3080", batch_size: int = 8, seconds: int = 20) -> dict[str, object]:
    import torch

    available = torch.cuda.is_available()
    name = torch.cuda.get_device_name(0) if available else None
    payload: dict[str, object] = {
        "required_device": required_device,
        "detected_device": name,
        "cuda_available": available,
        "batch_size": batch_size,
        "input_seconds": seconds,
        "status": "ready" if name and required_device.casefold() in name.casefold() else "not_run_wrong_or_missing_hardware",
    }
    if payload["status"] == "ready":
        bytes_per_batch = batch_size * 16_000 * seconds * 4
        payload["input_bytes"] = bytes_per_batch
        payload["note"] = "Dry-run interface ready; measure peak allocated memory and latency only on the named hardware."
    else:
        payload["note"] = "No RTX 3080 result recorded; do not use this as latency or memory evidence."
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--required-device", default="RTX 3080")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--seconds", type=int, default=20)
    arguments = parser.parse_args()
    print(json.dumps(run(arguments.required_device, arguments.batch_size, arguments.seconds)))


if __name__ == "__main__":
    main()
