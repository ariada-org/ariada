# SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
from __future__ import annotations

import functools
import http.server
import json
import socketserver
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

import sublime
import sublime_plugin


PANEL_NAME = "ariada"
SETTINGS_FILE = "Ariada.sublime-settings"


def _settings() -> sublime.Settings:
    return sublime.load_settings(SETTINGS_FILE)


def _is_url(value: str) -> bool:
    return value.startswith("http://") or value.startswith("https://")


def _append(panel: sublime.View, text: str) -> None:
    panel.run_command("append", {"characters": text, "force": True, "scroll_to_end": True})


def _flatten_findings(scan: dict[str, Any]) -> list[dict[str, Any]]:
    report = scan.get("report", scan)
    findings = report.get("findings", [])
    if isinstance(findings, list):
        return [item for item in findings if isinstance(item, dict)]
    if isinstance(findings, dict):
        flattened: list[dict[str, Any]] = []
        for value in findings.values():
            if isinstance(value, list):
                flattened.extend(item for item in value if isinstance(item, dict))
        return flattened
    return []


def _format_findings(scan_json: Path) -> str:
    try:
        parsed = json.loads(scan_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return f"\nUnable to read scan.json: {exc}\n"

    findings = _flatten_findings(parsed)
    if not findings:
        return "\nFindings: none at the configured threshold.\n"

    lines = ["\nFindings:\n"]
    for finding in findings[:50]:
        severity = finding.get("severity", "unknown")
        rule = finding.get("ruleId", "unknown-rule")
        message = finding.get("message", "")
        element = finding.get("element", {})
        selector = element.get("selector") if isinstance(element, dict) else None
        suffix = f" ({selector})" if selector else ""
        lines.append(f"- [{severity}] {rule}: {message}{suffix}\n")
    if len(findings) > 50:
        lines.append(f"- ... and {len(findings) - 50} more findings\n")
    return "".join(lines)


class _Server:
    def __init__(self, root: Path) -> None:
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
        self.httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        host, port = self.httpd.server_address
        return f"http://{host}:{port}"

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


def _target_for_view(view: sublime.View) -> tuple[str, _Server | None]:
    configured = view.settings().get("ariada_url") or _settings().get("ariada_url")
    if isinstance(configured, str) and _is_url(configured):
        return configured, None

    selected = view.substr(view.sel()[0]).strip() if view.sel() else ""
    if _is_url(selected):
        return selected, None

    file_name = view.file_name()
    if not file_name:
        raise ValueError("Save the file first, or select/configure an http(s) URL.")

    path = Path(file_name)
    server = _Server(path.parent)
    server.start()
    return f"{server.base_url}/{path.name}", server


def _command(target: str, output_dir: Path) -> list[str]:
    settings = _settings()
    cli = str(settings.get("ariada_cli_path", "ariada"))
    threshold = str(settings.get("severity_threshold", "moderate"))
    timeout_ms = int(settings.get("timeout_ms", 30000))
    return [
        cli,
        "scan",
        target,
        "--format",
        "both",
        "--output-dir",
        str(output_dir),
        "--severity-threshold",
        threshold,
        "--timeout-ms",
        str(timeout_ms),
    ]


class AriadaScanCommand(sublime_plugin.WindowCommand):
    def run(self) -> None:
        view = self.window.active_view()
        if view is None:
            sublime.status_message("Ariada: no active view")
            return

        panel = self.window.create_output_panel(PANEL_NAME)
        panel.settings().set("word_wrap", True)
        panel.set_read_only(False)
        panel.run_command("select_all")
        panel.run_command("right_delete")
        self.window.run_command("show_panel", {"panel": f"output.{PANEL_NAME}"})
        _append(panel, "Ariada scan starting...\n")

        thread = threading.Thread(target=self._run_scan, args=(view, panel), daemon=True)
        thread.start()

    def _run_scan(self, view: sublime.View, panel: sublime.View) -> None:
        server: _Server | None = None
        started = time.time()
        with tempfile.TemporaryDirectory(prefix="ariada-sublime-") as tmp:
            output_dir = Path(tmp)
            try:
                target, server = _target_for_view(view)
                cmd = _command(target, output_dir)
                sublime.set_timeout(lambda: _append(panel, f"Target: {target}\n\n"), 0)
                proc = subprocess.run(
                    cmd,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    check=False,
                )
                duration = round((time.time() - started) * 1000)
                text = proc.stdout or ""
                if text:
                    sublime.set_timeout(lambda: _append(panel, text), 0)
                scan_json = output_dir / "scan.json"
                if scan_json.exists():
                    sublime.set_timeout(lambda: _append(panel, _format_findings(scan_json)), 0)
                sublime.set_timeout(
                    lambda: _append(panel, f"\nExit code: {proc.returncode}; duration: {duration} ms\n"),
                    0,
                )
            except Exception as exc:
                sublime.set_timeout(lambda: _append(panel, f"\nAriada scan failed: {exc}\n"), 0)
            finally:
                if server is not None:
                    server.stop()


class AriadaOnSaveListener(sublime_plugin.EventListener):
    def on_post_save_async(self, view: sublime.View) -> None:
        if bool(_settings().get("scan_on_save", False)):
            window = view.window()
            if window is not None:
                window.run_command("ariada_scan")
