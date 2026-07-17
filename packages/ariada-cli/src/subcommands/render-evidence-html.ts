// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import type { MultiDomainReport } from '@ariada-org/core-engine';

type EvidenceFormat = 'vpat' | 'en301549';

/**
 * Data needed to render the deterministic evidence HTML wrapper.
 */
export interface EvidenceHtmlInput {
  format: EvidenceFormat;
  commitSha: string;
  report: MultiDomainReport;
  json: string;
  autoVerified: number;
  manualReviewRequired: number;
  signature?: string;
}

/**
 * Render deterministic HTML around the machine-readable evidence-emitter output.
 */
export function renderEvidenceHtml(input: EvidenceHtmlInput): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ariada evidence export</title>
</head>
<body>
  <main>
    <h1>Ariada ${escapeHtml(input.format)} evidence export</h1>
    <p>This evidence is true at commit ${escapeHtml(input.commitSha)}.</p>
    <h2>Honest coverage</h2>
    <h3>Auto-verified criteria</h3>
    <p>${input.autoVerified} mapped finding(s) were emitted through the evidence emitter.</p>
    <h3>Manual review required</h3>
    <p>${input.manualReviewRequired} finding(s) or criteria require human review outside this automated artefact.</p>
    <p>Regression attribution: candidate only; not an audit fact.</p>
    ${input.signature ? `<h2>Signature hook output</h2><pre>${escapeHtml(input.signature)}</pre>` : ''}
    <h2>Source sites</h2>
    <ul>${input.report.sites.map((site) => `<li>${escapeHtml(site)}</li>`).join('')}</ul>
    <h2>Emitter output</h2>
    <script type="application/json" id="ariada-evidence-json">${escapeHtml(input.json)}</script>
    <pre>${escapeHtml(input.json)}</pre>
  </main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
