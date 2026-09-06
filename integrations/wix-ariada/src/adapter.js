const DEFAULT_ENDPOINT = "/api/ariada/scan";

export function buildHostedScanRequest({ siteUrl, instanceId, endpoint = DEFAULT_ENDPOINT }) {
  const trimmedSiteUrl = String(siteUrl || "").trim();
  if (!trimmedSiteUrl) {
    throw new Error("A Wix site URL is required before requesting an Ariada scan.");
  }
  return {
    endpoint,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      channel: "wix-app",
      source: "wix-dashboard-panel",
      siteUrl: trimmedSiteUrl,
      instanceId: String(instanceId || "local-fixture"),
      requestedDomains: ["accessibility", "privacy", "security"]
    }
  };
}

export function normaliseScanResult(scan) {
  const findings = Array.isArray(scan?.findings) ? scan.findings : [];
  const bySeverity = findings.reduce(
    (accumulator, finding) => {
      const severity = String(finding.severity || "notice").toLowerCase();
      accumulator[severity] = (accumulator[severity] || 0) + 1;
      return accumulator;
    },
    { critical: 0, serious: 0, moderate: 0, minor: 0, notice: 0 }
  );
  return {
    scanId: String(scan?.scanId || "local-wix-fixture"),
    siteUrl: String(scan?.siteUrl || ""),
    status: String(scan?.status || "completed"),
    generatedAt: String(scan?.generatedAt || new Date().toISOString()),
    summary: {
      total: findings.length,
      bySeverity
    },
    findings
  };
}

export async function requestAriadaScan({ siteUrl, instanceId, endpoint = DEFAULT_ENDPOINT, fetchImpl = fetch }) {
  const request = buildHostedScanRequest({ siteUrl, instanceId, endpoint });
  const response = await fetchImpl(request.endpoint, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body)
  });
  if (!response.ok) {
    throw new Error(`Ariada scan endpoint returned HTTP ${response.status}.`);
  }
  return normaliseScanResult(await response.json());
}

export function renderFindings(result) {
  const normalised = normaliseScanResult(result);
  if (normalised.findings.length === 0) {
    return "<p>No findings returned by Ariada.</p>";
  }
  const rows = normalised.findings
    .map(
      (finding) => `<tr><td>${escapeHtml(finding.severity || "notice")}</td><td>${escapeHtml(
        finding.rule || "unknown"
      )}</td><td>${escapeHtml(finding.message || "")}</td><td>${escapeHtml(finding.selector || "")}</td></tr>`
    )
    .join("");
  return `<table><thead><tr><th>Severity</th><th>Rule</th><th>Message</th><th>Selector</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
