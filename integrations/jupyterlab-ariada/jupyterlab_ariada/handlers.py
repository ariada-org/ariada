from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web

from .bridge import AriadaScanOptions, scan_notebook


class AriadaNotebookScanHandler(APIHandler):
    @web.authenticated
    def post(self) -> None:
        payload = self.get_json_body() or {}
        notebook = payload.get("notebook")
        if not isinstance(notebook, dict):
            raise web.HTTPError(400, "payload.notebook must be a notebook JSON object")

        output_dir = Path(str(payload.get("outputDir") or "ariada-output"))
        cli_command = str(payload.get("cliCommand") or "ariada")
        result = scan_notebook(
            notebook,
            AriadaScanOptions(
                output_dir=output_dir,
                cli_command=cli_command,
                no_fail=bool(payload.get("noFail", True)),
            ),
        )
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps(result.to_json()))


def load_jupyter_server_extension(server_app: Any) -> None:
    web_app = server_app.web_app
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    route = url_path_join(base_url, "ariada", "scan-notebook")
    web_app.add_handlers(host_pattern, [(route, AriadaNotebookScanHandler)])
    server_app.log.info("Registered Ariada JupyterLab scan endpoint at %s", route)
