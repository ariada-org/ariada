from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

from ariada_fastapi import install_ariada
from ariada_fastapi.scanner import AriadaCliRunner, ScanOptions, count_findings, scan_target


def create_app() -> FastAPI:
    app = FastAPI()
    install_ariada(app, targets=["/broken/"])

    @app.get("/broken/", response_class=HTMLResponse)
    def broken(request: Request) -> str:
        enabled = getattr(request.state, "ariada_scan_enabled", False)
        return (
            "<html><body><main>"
            f"<p data-ariada-enabled='{str(enabled).lower()}'>ready</p>"
            "<img src='hero.png'><button></button>"
            "</main></body></html>"
        )

    return app


def test_middleware_marks_request_state() -> None:
    app = create_app()
    html = scan_target(app, "/broken/", ScanOptions(output_dir=Path("/tmp")), runner=NoopRunner())
    assert html.target == "/broken/"


def test_runner_invokes_ariada_cli_and_parses_multi_domain_report(tmp_path: Path) -> None:
    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        out_dir = Path(command[command.index("--output-dir") + 1])
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "multi-domain-report.json").write_text(
            json.dumps(
                {
                    "sites": ["http://example.test/"],
                    "domains": ["accessibility"],
                    "grid": {
                        "http://example.test/": {
                            "accessibility": [
                                {"ruleId": "image-alt", "severity": "critical"},
                                {"ruleId": "button-name", "severity": "serious"},
                            ]
                        }
                    },
                }
            ),
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 1, "Wrote report\n", "")

    result = AriadaCliRunner(fake_run).run(
        "http://example.test/",
        ScanOptions(output_dir=tmp_path, cli_command="ariada", domains=("accessibility",)),
    )

    assert result.gate_failed
    assert result.total_findings == 2
    assert result.report_path == tmp_path / "multi-domain-report.json"


def test_count_findings_accepts_legacy_scan_json_shape() -> None:
    assert (
        count_findings(
            {
                "summary": {"total": 3},
                "report": {"findings": {"accessibility": [{"ruleId": "a"}]}},
            }
        )
        == 3
    )


def test_scan_target_renders_fastapi_path_and_serves_html_to_runner(tmp_path: Path) -> None:
    app = create_app()

    def fake_run(command, **_kwargs):  # type: ignore[no-untyped-def]
        return subprocess.CompletedProcess(command, 0, "Wrote report\n", "")

    class Runner:
        def run(self, url: str, options: ScanOptions):  # type: ignore[no-untyped-def]
            html = urllib.request.urlopen(url, timeout=5).read().decode("utf-8")
            assert "data-ariada-enabled='true'" in html
            assert "hero.png" in html
            (options.output_dir / "multi-domain-report.json").write_text(
                json.dumps({"sites": [url], "domains": ["accessibility"], "grid": {url: {}}}),
                encoding="utf-8",
            )
            return AriadaCliRunner(fake_run).run(url, options)

    result = scan_target(app, "/broken/", ScanOptions(output_dir=tmp_path), runner=Runner())

    assert result.target == "/broken/"
    assert result.exit_code == 0
    assert result.total_findings == 0


class NoopRunner:
    def run(self, url: str, options: ScanOptions):  # type: ignore[no-untyped-def]
        options.output_dir.mkdir(parents=True, exist_ok=True)
        return AriadaCliRunner(
            lambda command, **_: subprocess.CompletedProcess(command, 0, "", "")
        ).run(
            url,
            options,
        )
