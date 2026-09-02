from __future__ import annotations

import json
import subprocess
import tarfile
from pathlib import Path

import pytest

from openedx_ariada.scanner import (
    RUNTIME_FILENAME,
    AriadaScanner,
    ScannerConfig,
    TargetValidationError,
)

FIXTURE = Path(__file__).parent / "fixtures" / "sample-scan.json"
ROOT = Path(__file__).parents[1]


def test_scanner_runs_without_shell_and_parses_cli_artifact(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    entry = tmp_path / "scan.mjs"
    entry.write_text("", encoding="utf-8")
    config = ScannerConfig(
        node_binary="/usr/bin/node",
        browser_channel="chrome",
        allowed_hosts=("courses.example.edu",),
        runtime_cache=tmp_path / "runtime",
    )
    scanner = AriadaScanner(config)
    monkeypatch.setattr(scanner, "_runtime_entrypoint", lambda: entry)
    captured: dict[str, object] = {}

    def fake_run(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
        captured["command"] = command
        captured["kwargs"] = kwargs
        output = Path(command[command.index("--output-dir") + 1])
        output.mkdir(parents=True, exist_ok=True)
        payload = json.loads(FIXTURE.read_text(encoding="utf-8"))
        (output / "scan.json").write_text(json.dumps(payload), encoding="utf-8")
        return subprocess.CompletedProcess(command, 1, "", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    report = scanner.scan(
        "https://courses.example.edu/courses/course-v1:Example+A11Y+2026/courseware/unit#block"
    )

    assert report.exit_code == 1
    assert captured["kwargs"]["shell"] is False  # type: ignore[index]
    assert "#block" not in captured["command"]  # type: ignore[operator]
    assert "--browser-channel" in captured["command"]  # type: ignore[operator]


def test_scanner_rejects_target_outside_administrator_allowlist(tmp_path: Path) -> None:
    scanner = AriadaScanner(
        ScannerConfig(allowed_hosts=("courses.example.edu",), runtime_cache=tmp_path)
    )

    with pytest.raises(TargetValidationError, match="outside"):
        scanner.scan("https://metadata.example.net/latest")


def test_embedded_runtime_manifest_is_portable_and_exact() -> None:
    artifact = ROOT / "src" / "openedx_ariada" / "runtime" / RUNTIME_FILENAME

    # The archive is built, not committed: it is eight megabytes of bundled
    # dependencies. Absent, this test cannot look at anything — and saying so is
    # the whole point, because a check that cannot run must not read as a check
    # that found nothing wrong. Build it from `runtime/` with `npm pack`.
    if not artifact.is_file():
        pytest.skip(
            f"cannot check: {artifact.name} is not built. "
            "Run `npm pack` in runtime/ and put the archive in "
            "src/openedx_ariada/runtime/."
        )

    with tarfile.open(artifact, "r:gz") as archive:
        manifest_file = archive.extractfile("package/package.json")
        assert manifest_file is not None
        manifest = json.load(manifest_file)

    assert manifest["name"] == "@ariada-integrations/openedx-runtime"
    assert manifest.get("scripts", {}).get("postinstall") is None
    assert manifest["dependencies"]["@ariada-org/cli"] == "0.1.0"
    assert manifest["dependencies"]["@ariada-org/core"] == "0.1.0"
    assert manifest["dependencies"]["@ariada-org/rules-axe"] == "0.1.0"
    assert manifest["dependencies"]["playwright"] == "1.61.1"
    assert "file:" not in json.dumps(manifest)
    assert "workspace:" not in json.dumps(manifest)

