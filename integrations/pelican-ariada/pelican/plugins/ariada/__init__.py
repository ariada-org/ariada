from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

try:
    from pelican import signals
except Exception:  # pragma: no cover - import guard for syntax checks without Pelican
    signals = None  # type: ignore[assignment]

from pelican.plugins.ariada.scanner import AriadaScanError, AriadaScanner, ScanResult

LOGGER = logging.getLogger(__name__)

DEFAULTS = {
    "enabled": True,
    "gate": True,
    "cli_command": "ariada",
    "output_dir": "ariada-output",
    "browser": "chromium",
    "format": "json",
    "severity_threshold": "moderate",
    "timeout_ms": 30_000,
    "domains": [],
}


class AriadaGateError(RuntimeError):
    """Raised when Ariada reports a gated scan failure."""


def read_config(pelican_object: Any) -> dict[str, Any]:
    settings = getattr(pelican_object, "settings", {}) or {}
    raw = settings.get("ARIADA", {}) if isinstance(settings, Mapping) else {}
    config = {**DEFAULTS, **(raw or {})}

    import os

    if os.environ.get("ARIADA_CLI"):
        config["cli_command"] = os.environ["ARIADA_CLI"]
    if os.environ.get("ARIADA_OUTPUT_DIR"):
        config["output_dir"] = os.environ["ARIADA_OUTPUT_DIR"]

    if "target" not in config:
        config["target"] = (
            settings.get("OUTPUT_PATH", "output") if isinstance(settings, Mapping) else "output"
        )
    return config


def enabled(value: Any) -> bool:
    return value not in (False, "false", "False", "0", 0, None)


def finalized(pelican_object: Any, *, scanner: AriadaScanner | None = None) -> ScanResult | None:
    config = read_config(pelican_object)
    if not enabled(config.get("enabled")):
        LOGGER.info("Ariada scan disabled")
        return None

    target = str(config.get("target") or "output")
    scanner = scanner or AriadaScanner(config)
    result = scanner.scan(target)

    if result.exit_code == 0:
        LOGGER.info("Ariada scan passed for %s", result.target)
    else:
        LOGGER.warning(
            "Ariada scan reported %s finding(s) for %s; exit=%s",
            result.total_findings,
            result.target,
            result.exit_code,
        )

    if enabled(config.get("gate")) and result.exit_code != 0:
        message = f"Ariada scan failed for {result.target} with exit {result.exit_code}"
        raise AriadaGateError(message)
    return result


def register() -> None:
    if signals is None:
        raise RuntimeError("Pelican is required to register pelican-ariada")
    signals.finalized.connect(finalized)


__all__ = [
    "AriadaGateError",
    "AriadaScanError",
    "AriadaScanner",
    "ScanResult",
    "finalized",
    "read_config",
    "register",
]
