import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanEvidence = join(root, "scan-evidence");
const testReport = join(root, "test-report");
const screenshot = "screenshots/wix-dashboard-panel.png";

await mkdir(scanEvidence, { recursive: true });
const scan = JSON.parse(await readFile(join(scanEvidence, "mock-scan-response.json"), "utf8"));
const screenshotExists = await exists(join(scanEvidence, screenshot));
const e2eLog = await optional(join(testReport, "logs/e2e-output.txt"));
const browserLog = await optional(join(scanEvidence, "browser-flow.txt"));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariada Wix app evidence report</title>
<link rel="stylesheet" href="../fixture/styles.css">
</head>
<body>
<main class="shell">
<section class="panel">
<p class="eyebrow">S10 distribution channel evidence</p>
<h1>Ariada Wix app</h1>
<p>The S10 channel is a Wix dashboard app surface for non-developer site owners and agencies. The adapter is intentionally thin: the Wix panel collects the published site URL, calls Ariada hosted scan semantics, and renders the returned compliance findings. Scanner logic stays in Ariada hosted API or CLI-owned services.</p>

<h2>Roles and Payers</h2>
<table><tbody>
<tr><th scope="row">Wix site owner</th><td>Needs a simple dashboard panel before EAA/WCAG review; usually influences purchase but may not configure APIs.</td></tr>
<tr><th scope="row">Agency operator</th><td>Manages many Wix client sites and can pay for repeatable compliance evidence.</td></tr>
<tr><th scope="row">Accessibility reviewer</th><td>Needs raw JSON, stable HTML, and a screenshot rather than a verbal dashboard claim.</td></tr>
<tr><th scope="row">Founder / marketplace owner</th><td>Owns Wix developer account setup, hosted API credentials, and Wix App Market submission.</td></tr>
</tbody></table>

<h2>Why This Channel</h2>
<p>Wix reaches non-developer SME site owners and agencies, which matches the Pack 2 rationale for S10. This channel is useful only if Ariada behaves like a hosted service: Wix dashboard code should not bundle or fork scanner rules.</p>

<h2>Channel User Preferences</h2>
<table><tbody>
<tr><th scope="row">Low setup</th><td>Open dashboard, scan the published site, read findings.</td></tr>
<tr><th scope="row">Agency repeatability</th><td>One app surface should work across multiple client sites with per-site evidence.</td></tr>
<tr><th scope="row">Plain remediation</th><td>Findings need selector, rule, severity, and message fields for handoff.</td></tr>
</tbody></table>

<h2>Competitors and Narrow Evidence Competitors</h2>
<p>Broad competitors are Wix SEO/accessibility tooling, agency manual audits, and accessibility overlays. The narrow evidence competitor is any Wix-compatible service that produces reviewer-ready scan artifacts from a dashboard workflow. This fixture does not claim marketplace parity; it proves Ariada can own the evidence layer.</p>

<h2>Implemented vs Missing</h2>
<table><tbody>
<tr><th scope="row">Implemented</th><td>Browser-compatible request adapter, Wix-style dashboard fixture, mocked hosted Ariada scan endpoint, E2E route flow, raw JSON, test report, evidence report, and real browser screenshot slot.</td></tr>
<tr><th scope="row">Missing</th><td>Real Wix CLI scaffold, Wix dashboard extension registration, signed app instance validation, production Ariada hosted API, OAuth/permissions, App Market listing, and review approval.</td></tr>
<tr><th scope="row">Explicit blocker</th><td>Wix developer account and hosted Ariada scan API are required before this can be installed into a Wix dev site or submitted to Wix App Market.</td></tr>
</tbody></table>

<h2>Domains Roadmap</h2>
<table><tbody>
<tr><th scope="row">Accessibility</th><td>Implemented in fixture response; first commercial wedge for EAA/WCAG review.</td></tr>
<tr><th scope="row">Privacy</th><td>Requested by adapter contract; blocked until hosted API exposes privacy findings for Wix sites.</td></tr>
<tr><th scope="row">Security</th><td>Requested by adapter contract; blocked until hosted API exposes security findings for Wix sites.</td></tr>
<tr><th scope="row">SEO / structured data / performance</th><td>Roadmap domains after hosted scan artifact retention exists.</td></tr>
</tbody></table>

<h2>Technical Connectors</h2>
<table><tbody>
<tr><th scope="row">Wix dashboard panel</th><td><code>fixture/index.html</code> represents the dashboard page surface.</td></tr>
<tr><th scope="row">Ariada hosted API</th><td><code>POST /api/ariada/scan</code> is mocked locally and mirrors a future hosted endpoint.</td></tr>
<tr><th scope="row">Shared adapter contract</th><td><code>src/adapter.js</code> builds the request and normalises scan JSON without scanner rules.</td></tr>
<tr><th scope="row">Wix platform</th><td>Official Wix docs describe self-managed apps, Wix APIs, app instance query parameters, and dashboard SDK requirements; those remain account-gated for this branch.</td></tr>
</tbody></table>

<h2>E2E Test Adequacy</h2>
<p>The automated E2E starts the local fixture server, loads the dashboard route, calls the mocked hosted scan endpoint, verifies three findings, and writes raw JSON. Browser verification then opens the dashboard with the same scan flow autorun and captures the rendered panel. This is adequate for local adapter behavior; it is not a Wix App Market or real dev-site install test.</p>

<h2>Artifacts</h2>
<p><a href="../test-report/result.html">Test report</a> · <a href="../test-report/logs/lint-output.txt">Lint log</a> · <a href="../test-report/logs/test-output.txt">Unit test log</a> · <a href="../test-report/logs/e2e-output.txt">E2E output</a> · <a href="../test-report/logs/evidence-output.txt">Evidence build log</a> · <a href="../test-report/logs/validate-links-output.txt">Link validation log</a> · <a href="../test-report/logs/screenshot-validation-output.txt">Screenshot validation log</a> · <a href="mock-scan-response.json">Raw scan JSON</a> · <a href="browser-flow.txt">Browser flow notes</a>${screenshotExists ? ` · <a href="${screenshot}">Direct screenshot PNG</a>` : ""}</p>
${screenshotExists ? `<figure><a href="${screenshot}"><img src="${screenshot}" alt="Rendered Ariada Wix dashboard panel after mocked scan"></a><figcaption>Real browser screenshot of the local Wix dashboard fixture after the mocked Ariada scan response rendered.</figcaption></figure>` : "<p><strong>Screenshot blocker:</strong> browser screenshot has not been captured yet.</p>"}

<h2>Blockers</h2>
<table><tbody>
<tr><th scope="row">Hosted API</th><td>No production Ariada hosted scan endpoint is available in this branch.</td></tr>
<tr><th scope="row">Wix account</th><td>Wix CLI/dev-account access is required to scaffold, register, and test a real dashboard app inside Wix.</td></tr>
<tr><th scope="row">Marketplace review</th><td>Wix App Market submission and review are founder-owned human gates.</td></tr>
</tbody></table>

<h2>Distribution and Monetization Next Steps</h2>
<ol>
<li>Create the Wix app in a developer account and register a dashboard page that points to the Ariada hosted panel.</li>
<li>Connect the production hosted scan API with signed instance validation and per-site evidence retention.</li>
<li>Publish a docs page for agency operators and price the channel as part of hosted evidence retention, not as a standalone scanner fork.</li>
</ol>

<h2>Sources</h2>
<table><tbody>
<tr><th scope="row">Wix self-managed apps</th><td><a href="https://dev.wix.com/docs/build-apps/develop-your-app/develop-a-self-managed-app/about-self-managed-apps">Official Wix Developers docs</a>, accessed 2026-07-01, primary source, high reliability.</td></tr>
<tr><th scope="row">Wix APIs</th><td><a href="https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/about-wix-apis">Official Wix Developers docs</a>, accessed 2026-07-01, primary source, high reliability.</td></tr>
<tr><th scope="row">App instances</th><td><a href="https://dev.wix.com/docs/build-apps/develop-your-app/access/app-instances/about-app-instances">Official Wix Developers docs</a>, accessed 2026-07-01, primary source, high reliability.</td></tr>
<tr><th scope="row">Dashboard SDK changelog</th><td><a href="https://dev.wix.com/docs/changelog">Official Wix Developers changelog</a>, accessed 2026-07-01, primary source, high reliability.</td></tr>
</tbody></table>

<h2>Raw Logs</h2>
<h3>E2E</h3>
<pre>${escapeHtml(e2eLog)}</pre>
<h3>Browser Flow</h3>
<pre>${escapeHtml(browserLog)}</pre>

<hr>
<p>Update:<br>Author: GAUSS (orchestrator)<br>Date: 2026-07-01</p>
</section>
</main>
</body>
</html>`;

await writeFile(join(scanEvidence, "result.html"), html);

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function optional(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}
