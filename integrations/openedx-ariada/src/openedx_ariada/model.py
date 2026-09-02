"""Strict report model for Ariada CLI scan envelopes."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

CLI_SCHEMA = "https://ariada.org/schemas/cli-scan.v1.json"
IMPACTS = ("critical", "serious", "moderate", "minor", "unknown")
MAX_FINDINGS = 2_000


class ReportParseError(ValueError):
    """Raised when scanner output does not satisfy the expected contract."""


def _mapping(value: object, label: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ReportParseError(f"{label} must be an object")
    return value


def _strings(value: object) -> tuple[str, ...]:
    if isinstance(value, str):
        return (value,) if value.strip() else ()
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return tuple(str(item).strip() for item in value if str(item).strip())
    return ()


def _standards(raw: Mapping[str, object], key: str) -> tuple[str, ...]:
    direct = _strings(raw.get(key))
    standards = raw.get("standards")
    nested: tuple[str, ...] = ()
    if isinstance(standards, Mapping):
        nested = _strings(standards.get(key))
    tags = _strings(raw.get("tags"))
    if key == "wcag":
        tagged = tuple(tag for tag in tags if tag.lower().startswith("wcag"))
    else:
        tagged = tuple(tag for tag in tags if "301549" in tag.replace(" ", ""))
    return tuple(dict.fromkeys((*direct, *nested, *tagged)))


def _selector(raw: Mapping[str, object]) -> str | None:
    value = raw.get("selector")
    if isinstance(value, str) and value.strip():
        return value.strip()
    target = raw.get("target")
    values = _strings(target)
    if values:
        return ", ".join(values)
    evidence = raw.get("evidence")
    if isinstance(evidence, Mapping):
        value = evidence.get("selector")
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


@dataclass(frozen=True, slots=True)
class Finding:
    """A normalized accessibility finding."""

    rule_id: str
    severity: str
    message: str
    wcag: tuple[str, ...]
    en301549: tuple[str, ...]
    selector: str | None = None
    help_url: str | None = None

    @classmethod
    def from_cli(cls, value: object) -> Finding:
        raw = _mapping(value, "finding")
        rule_id = raw.get("ruleId")
        if not isinstance(rule_id, str) or not rule_id.strip():
            raise ReportParseError("finding.ruleId must be a non-empty string")
        severity_value = raw.get("severity", "unknown")
        severity = str(severity_value).lower()
        if severity not in IMPACTS:
            severity = "unknown"
        message_value = raw.get("message", raw.get("description", rule_id))
        message = str(message_value).strip() or rule_id
        help_value = raw.get("helpUrl")
        help_url = (
            help_value.strip()
            if isinstance(help_value, str) and help_value.strip()
            else None
        )
        wcag = tuple(
            dict.fromkeys(
                (
                    *_strings(raw.get("wcagCriteria")),
                    *_standards(raw, "wcag"),
                )
            )
        )
        en301549 = tuple(
            dict.fromkeys(
                (
                    *_strings(raw.get("en301549")),
                    *_standards(raw, "en301549"),
                )
            )
        )
        return cls(
            rule_id=rule_id.strip(),
            severity=severity,
            message=message,
            wcag=wcag,
            en301549=en301549,
            selector=_selector(raw),
            help_url=help_url,
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "ruleId": self.rule_id,
            "severity": self.severity,
            "message": self.message,
            "wcag": list(self.wcag),
            "en301549": list(self.en301549),
            "selector": self.selector,
            "helpUrl": self.help_url,
        }

    @classmethod
    def from_stored(cls, value: object) -> Finding:
        raw = _mapping(value, "stored finding")
        return cls(
            rule_id=str(raw.get("ruleId", "")).strip(),
            severity=str(raw.get("severity", "unknown")),
            message=str(raw.get("message", "")).strip(),
            wcag=_strings(raw.get("wcag")),
            en301549=_strings(raw.get("en301549")),
            selector=str(raw["selector"]) if raw.get("selector") is not None else None,
            help_url=str(raw["helpUrl"]) if raw.get("helpUrl") is not None else None,
        )


def _flatten_findings(value: object) -> list[object]:
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return list(value)
    if isinstance(value, Mapping):
        flattened: list[object] = []
        for group in value.values():
            if isinstance(group, Sequence) and not isinstance(group, (str, bytes, bytearray)):
                flattened.extend(group)
            else:
                raise ReportParseError("report.findings groups must be arrays")
        return flattened
    raise ReportParseError("report.findings must be an array or object of arrays")


@dataclass(frozen=True, slots=True)
class ScanReport:
    """Normalized, serializable Ariada scan result."""

    url: str
    scan_id: str
    started_at: str
    completed_at: str
    duration_ms: int
    exit_code: int
    findings: tuple[Finding, ...]

    @classmethod
    def from_cli_json(cls, payload: str | bytes | Mapping[str, object]) -> ScanReport:
        if isinstance(payload, (str, bytes)):
            try:
                parsed: object = json.loads(payload)
            except json.JSONDecodeError as exc:
                raise ReportParseError("scanner output is not valid JSON") from exc
            envelope = _mapping(parsed, "scanner envelope")
        else:
            envelope = _mapping(payload, "scanner envelope")

        if envelope.get("$schema") != CLI_SCHEMA:
            raise ReportParseError("scanner envelope has an unsupported schema")
        url = envelope.get("url")
        if not isinstance(url, str) or not url:
            raise ReportParseError("scanner envelope URL is missing")
        report = _mapping(envelope.get("report"), "report")
        raw_findings = _flatten_findings(report.get("findings", []))
        if len(raw_findings) > MAX_FINDINGS:
            raise ReportParseError(f"scanner report exceeds {MAX_FINDINGS} findings")
        findings = tuple(Finding.from_cli(item) for item in raw_findings)

        summary = _mapping(envelope.get("summary"), "summary")
        declared_total = summary.get("total")
        if not isinstance(declared_total, int) or declared_total != len(findings):
            raise ReportParseError("scanner summary total does not match report findings")
        exit_code = envelope.get("exitCode")
        if exit_code not in (0, 1):
            raise ReportParseError("scanner exitCode must be 0 or 1")
        scan_id_value = envelope.get("scanId", report.get("scanId", ""))
        if not isinstance(scan_id_value, str) or not scan_id_value:
            raise ReportParseError("scanner scanId is missing")
        duration_value = envelope.get("durationMs", 0)
        if not isinstance(duration_value, int) or duration_value < 0:
            raise ReportParseError("scanner durationMs must be a non-negative integer")
        return cls(
            url=url,
            scan_id=scan_id_value,
            started_at=str(envelope.get("startedAt", "")),
            completed_at=str(envelope.get("completedAt", "")),
            duration_ms=duration_value,
            exit_code=exit_code,
            findings=findings,
        )

    @property
    def counts(self) -> dict[str, int]:
        counts = {impact: 0 for impact in IMPACTS}
        for finding in self.findings:
            counts[finding.severity if finding.severity in counts else "unknown"] += 1
        return counts

    def to_dict(self) -> dict[str, object]:
        return {
            "schema": "openedx-ariada.report.v1",
            "url": self.url,
            "scanId": self.scan_id,
            "startedAt": self.started_at,
            "completedAt": self.completed_at,
            "durationMs": self.duration_ms,
            "exitCode": self.exit_code,
            "findings": [finding.to_dict() for finding in self.findings],
        }

    def to_storage_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=True, separators=(",", ":"))

    @classmethod
    def from_storage_json(cls, payload: str) -> ScanReport:
        try:
            raw = _mapping(json.loads(payload), "stored report")
        except (json.JSONDecodeError, TypeError) as exc:
            raise ReportParseError("stored report is not valid JSON") from exc
        if raw.get("schema") != "openedx-ariada.report.v1":
            raise ReportParseError("stored report has an unsupported schema")
        findings_value = raw.get("findings")
        if not isinstance(findings_value, Sequence) or isinstance(
            findings_value, (str, bytes, bytearray)
        ):
            raise ReportParseError("stored report findings must be an array")
        findings = tuple(Finding.from_stored(item) for item in findings_value)
        duration_value = raw.get("durationMs", 0)
        exit_code_value = raw.get("exitCode", 0)
        if not isinstance(duration_value, int) or not isinstance(exit_code_value, int):
            raise ReportParseError("stored report numeric fields are invalid")
        return cls(
            url=str(raw.get("url", "")),
            scan_id=str(raw.get("scanId", "")),
            started_at=str(raw.get("startedAt", "")),
            completed_at=str(raw.get("completedAt", "")),
            duration_ms=duration_value,
            exit_code=exit_code_value,
            findings=findings,
        )

    def client_payload(self, full_report_url: str) -> dict[str, Any]:
        return {
            "schema": "openedx-ariada.client.v1",
            "url": self.url,
            "scanId": self.scan_id,
            "durationMs": self.duration_ms,
            "total": len(self.findings),
            "counts": self.counts,
            "findings": [finding.to_dict() for finding in self.findings[:50]],
            "findingsTruncated": len(self.findings) > 50,
            "fullReportUrl": full_report_url,
        }
