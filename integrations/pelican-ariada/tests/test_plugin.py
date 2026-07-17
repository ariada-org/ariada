from __future__ import annotations

import json
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest

from pelican.plugins import ariada


def test_reads_pelican_settings_and_defaults_to_output_path() -> None:
    pelican_object = SimpleNamespace(
        settings={
            "OUTPUT_PATH": "output",
            "ARIADA": {
                "gate": False,
                "cli_command": "python -m ariada",
                "output_dir": "scan-evidence/ariada-output",
                "domains": ["accessibility"],
            },
        }
    )

    config = ariada.read_config(pelican_object)

    assert config["enabled"] is True
    assert config["gate"] is False
    assert config["cli_command"] == "python -m ariada"
    assert config["target"] == "output"
    assert config["domains"] == ["accessibility"]


def test_finalized_raises_when_gate_is_enabled_and_cli_finds_violations(tmp_path: Path) -> None:
    output_dir = tmp_path / "out"
    output_dir.mkdir()
    (output_dir / "scan.json").write_text(json.dumps({"summary": {"total": 1}}), encoding="utf-8")
    pelican_object = SimpleNamespace(
        settings={
            "OUTPUT_PATH": "output",
            "ARIADA": {
                "target": "https://example.test",
                "output_dir": str(output_dir),
                "gate": True,
            },
        }
    )

    def runner(command: list[str], **_kwargs: object) -> subprocess.CompletedProcess[str]:
        return subprocess.CompletedProcess(command, 1, "Wrote scan.json\n", "")

    scanner = ariada.AriadaScanner({"output_dir": str(output_dir)}, runner=runner)

    with pytest.raises(ariada.AriadaGateError):
        ariada.finalized(pelican_object, scanner=scanner)


def test_finalized_returns_none_when_disabled() -> None:
    pelican_object = SimpleNamespace(settings={"ARIADA": {"enabled": False}})

    assert ariada.finalized(pelican_object) is None
