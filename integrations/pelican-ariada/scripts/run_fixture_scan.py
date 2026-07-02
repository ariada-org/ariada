#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
SCAN_EVIDENCE = ROOT / "scan-evidence"
OUTPUT_DIR = SCAN_EVIDENCE / "ariada-output"
COMMAND_LOG = SCAN_EVIDENCE / "command.log"
COMMAND_EXIT = SCAN_EVIDENCE / "command.exit"


def cli_command() -> list[str]:
    env = os.environ.get("ARIADA_CLI")
    if env:
        return env.split()
    return ["node", str(REPO / "packages/ariada-cli/dist/bin.js")]


def pelican_available() -> bool:
    completed = subprocess.run(
        [sys.executable, "-m", "pelican", "--version"],
        text=True,
        capture_output=True,
        check=False,
    )
    return completed.returncode == 0


def build_pelican_fixture() -> tuple[Path, str]:
    source = ROOT / "fixtures/pelican-site"
    dest = source / "output"
    shutil.rmtree(dest, ignore_errors=True)
    if not pelican_available():
        return ROOT / "fixtures/static-site", "blocked: pelican executable is unavailable"

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "pelican",
            "content",
            "--settings",
            "pelicanconf.py",
            "--output",
            "output",
            "--fatal",
            "errors",
        ],
        cwd=source,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode == 0 and (dest / "index.html").exists():
        return dest, f"built: {completed.stdout}{completed.stderr}".strip()
    build_log = f"blocked: pelican build exit {completed.returncode}: "
    build_log += f"{completed.stdout}{completed.stderr}"
    return (ROOT / "fixtures/static-site", build_log.strip())


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        return


def serve_directory(root: Path) -> tuple[ThreadingHTTPServer, threading.Thread, str]:
    class RootedHandler(QuietHandler):
        def __init__(self, *args: object, **kwargs: object) -> None:
            super().__init__(*args, directory=str(root), **kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", 0), RootedHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, thread, f"http://{host}:{port}/"


def main() -> int:
    shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    site_root, build_note = build_pelican_fixture()
    server, thread, url = serve_directory(site_root)
    command = cli_command() + [
        "scan",
        url,
        "--format",
        "json",
        "--output-dir",
        str(OUTPUT_DIR),
        "--browser",
        os.environ.get("ARIADA_BROWSER", "chromium"),
        "--severity-threshold",
        "minor",
        "--timeout-ms",
        "30000",
    ]
    try:
        completed = subprocess.run(command, cwd=REPO, text=True, capture_output=True, check=False)
    finally:
        server.shutdown()
        thread.join(timeout=5)
    COMMAND_LOG.write_text(
        "\n".join(
            [
                f"Fixture root: {site_root}",
                f"Pelican host status: {build_note}",
                f"Command: {' '.join(command)}",
                "",
                "STDOUT:",
                completed.stdout,
                "",
                "STDERR:",
                completed.stderr,
            ]
        ),
        encoding="utf-8",
    )
    COMMAND_EXIT.write_text(f"{completed.returncode}\n", encoding="utf-8")
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
