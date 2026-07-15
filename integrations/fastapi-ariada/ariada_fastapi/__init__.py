from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

__all__ = ["AriadaScanMiddleware", "__version__", "install_ariada"]

__version__ = "0.1.0"


class AriadaScanMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable[[Request], object]) -> Response:
        request.state.ariada_scan_enabled = True
        response = await call_next(request)
        return response  # type: ignore[return-value]


def install_ariada(
    app: FastAPI,
    *,
    targets: list[str] | tuple[str, ...] | None = None,
    cli_command: str = "ariada",
    output_dir: str = "ariada-output",
) -> None:
    app.add_middleware(AriadaScanMiddleware)
    app.state.ariada_scan_targets = list(targets or [])
    app.state.ariada_cli_command = cli_command
    app.state.ariada_scan_output_dir = output_dir
