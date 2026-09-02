"""Course-staff XBlock surface for Ariada reports."""

from __future__ import annotations

from collections.abc import Mapping
from importlib import resources
from typing import Any

from web_fragments.fragment import Fragment
from webob import Response
from xblock.core import XBlock
from xblock.exceptions import JsonHandlerError
from xblock.fields import Scope, String

from .model import ReportParseError, ScanReport
from .rendering import render_full_report
from .scanner import (
    AriadaConfigurationError,
    AriadaProcessError,
    AriadaScanner,
    TargetValidationError,
)


def _resource_text(name: str) -> str:
    return resources.files("openedx_ariada").joinpath("static", name).read_text(encoding="utf-8")


class AriadaXBlock(XBlock):  # type: ignore[misc]
    """Scan a rendered unit URL and present findings only to course staff."""

    icon_class = "other"
    has_score = False
    last_report_json = String(default="", scope=Scope.user_state)

    def _is_course_staff(self) -> bool:
        staff_value = getattr(self.runtime, "user_is_staff", False)
        if callable(staff_value):
            staff_value = staff_value()
        if bool(staff_value):
            return True
        try:
            from common.djangoapps.student.auth import has_access
        except ImportError:
            return False
        user = getattr(self.runtime, "user", None)
        context_key = getattr(self, "context_key", None)
        if user is None or context_key is None:
            return False
        try:
            return bool(has_access(user, "staff", context_key))
        except (AttributeError, TypeError):
            return False

    def _scanner_fragment(self) -> Fragment:
        fragment = Fragment(
            """<section class="ariada-openedx" aria-labelledby="ariada-openedx-title">
  <div class="ariada-openedx__heading">
    <p class="ariada-openedx__eyebrow">Course staff / accessibility</p>
    <h2 id="ariada-openedx-title">Inspect this rendered page</h2>
    <p>Run the packaged Ariada WCAG and EN 301 549 scanner. The learner view is empty.</p>
  </div>
  <form class="ariada-openedx__form">
    <label for="ariada-openedx-target">Rendered course or unit URL</label>
    <div class="ariada-openedx__controls">
      <input id="ariada-openedx-target" name="target" type="url" required
        inputmode="url" autocomplete="url">
      <button type="submit">Run accessibility scan</button>
    </div>
  </form>
  <p class="ariada-openedx__status" role="status" aria-live="polite"></p>
  <div class="ariada-openedx__result" hidden>
    <ul class="ariada-openedx__counts" aria-label="Findings by impact"></ul>
    <div class="ariada-openedx__table-wrap">
      <table>
        <caption>Top findings</caption>
        <thead><tr><th scope="col">Rule</th><th scope="col">Impact</th>
          <th scope="col">Standards</th><th scope="col">Message</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <a class="ariada-openedx__full" target="_blank" rel="noreferrer">Open full report</a>
  </div>
</section>"""
        )
        fragment.add_css(_resource_text("ariada.css"))
        fragment.add_javascript(_resource_text("ariada.js"))
        fragment.initialize_js("AriadaOpenEdX")
        return fragment

    def student_view(self, context: Mapping[str, object] | None = None) -> Fragment:
        del context
        if not self._is_course_staff():
            return Fragment("")
        return self._scanner_fragment()

    def author_view(self, context: Mapping[str, object] | None = None) -> Fragment:
        del context
        return self._scanner_fragment()

    def studio_view(self, context: Mapping[str, object] | None = None) -> Fragment:
        del context
        return self._scanner_fragment()

    @XBlock.json_handler
    def scan_page(self, data: Any, suffix: str = "") -> dict[str, Any]:
        del suffix
        if not self._is_course_staff():
            raise JsonHandlerError(403, "Course staff access is required")
        if not isinstance(data, Mapping) or not isinstance(data.get("url"), str):
            raise JsonHandlerError(400, "A rendered page URL is required")
        try:
            report = AriadaScanner().scan(data["url"])
        except TargetValidationError as exc:
            raise JsonHandlerError(400, str(exc)) from exc
        except AriadaConfigurationError as exc:
            raise JsonHandlerError(503, str(exc)) from exc
        except AriadaProcessError as exc:
            raise JsonHandlerError(502, str(exc)) from exc
        self.last_report_json = report.to_storage_json()
        report_url = self.runtime.handler_url(self, "full_report")
        return report.client_payload(report_url)

    @XBlock.handler
    def full_report(self, request: Any, suffix: str = "") -> Response:
        del suffix
        if getattr(request, "method", "GET") != "GET":
            return Response(status=405, allow="GET")
        if not self._is_course_staff():
            return Response(
                status=403,
                content_type="text/plain",
                text="Course staff access required",
            )
        if not self.last_report_json:
            return Response(
                status=404,
                content_type="text/plain",
                text="No Ariada report is available",
            )
        try:
            report = ScanReport.from_storage_json(self.last_report_json)
        except ReportParseError:
            return Response(
                status=500,
                content_type="text/plain",
                text="Stored Ariada report is invalid",
            )
        response = Response(
            body=render_full_report(report).encode("utf-8"),
            content_type="text/html",
            charset="utf-8",
        )
        response.headers["Content-Disposition"] = 'inline; filename="ariada-openedx-report.html"'
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'"
        )
        response.headers["Cache-Control"] = "private, no-store"
        return response

    @staticmethod
    def workbench_scenarios() -> list[tuple[str, str]]:
        return [("Ariada course accessibility report", "<ariada/>")]
