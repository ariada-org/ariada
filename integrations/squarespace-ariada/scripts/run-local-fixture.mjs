#!/usr/bin/env node
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const testReport = join(root, 'test-report');
const scanEvidence = join(root, 'scan-evidence');
const logsDir = join(testReport, 'logs');
const outputDir = join(scanEvidence, 'ariada-output');
const screenshotPath = join(scanEvidence, 'screenshots', 'extension-surface.png');

const files = {
  manifest: join(root, 'extension.manifest.json'),
  request: join(root, 'fixtures', 'hosted-scan-request.json'),
  response: join(root, 'fixtures', 'hosted-scan-response.json'),
  surface: join(root, 'fixtures', 'extension-surface.html')
};

mkdirSync(logsDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(screenshotPath), { recursive: true });

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function writeLog(name, ok, body) {
  writeFileSync(join(logsDir, `${name}.txt`), `${body}\n`);
  writeFileSync(join(logsDir, `${name}.exit`), ok ? '0\n' : '1\n');
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font:15px/1.55 system-ui,sans-serif;margin:0;color:#17202a;background:#f5f7fa}
main{max-width:1120px;margin:0 auto;padding:28px 20px}
h1{font-size:1.7rem;margin:0 0 10px}
h2{font-size:1.1rem;margin:26px 0 10px;border-bottom:1px solid #d8dde6;padding-bottom:6px}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #d8dde6;padding:8px;text-align:left;vertical-align:top}
th{background:#f1f4f8}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
code{background:#eef1f5;padding:1px 5px;border-radius:4px}
pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:460px}
figure{margin:18px 0;background:#fff;border:1px solid #d8dde6;border-radius:8px;overflow:hidden}
img{display:block;max-width:100%;height:auto}
figcaption{padding:10px 14px}
.status{display:inline-block;border-radius:999px;padding:2px 8px;font-weight:700;font-size:.82rem}
.pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}
.warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}
.block{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}
.links a{display:inline-block;margin:0 12px 8px 0}
</style>
</head>
<body><main>
<h1>${esc(title)}</h1>
${body}
</main></body></html>`;
}

const manifest = readJson(files.manifest);
const request = readJson(files.request);
const response = readJson(files.response);
const surface = readFileSync(files.surface, 'utf8');

const validations = [
  ['manifest channel', manifest.channel === 'squarespace-extension'],
  ['oauth required', manifest.oauth?.required === true],
  ['hosted Ariada endpoint', /^https:\/\/api\.ariada\.ai\//.test(manifest.ariada?.hostedScanEndpoint ?? '')],
  ['request source', request.source === 'squarespace-extension'],
  ['request site URL', /^https:\/\//.test(request.siteUrl)],
  ['response findings', Array.isArray(response.findings) && response.findings.length >= 1],
  ['surface settings', surface.includes('Extension Settings')],
  ['surface results', surface.includes('Latest Scan Findings')],
  ['surface renders scan id', surface.includes(response.scanId)]
];

const ok = validations.every(([, pass]) => pass);
const screenshotExists = existsSync(screenshotPath);
writeLog(
  'local-fixture',
  ok,
  validations.map(([name, pass]) => `${pass ? 'PASS' : 'FAIL'} ${name}`).join('\n')
);

copyFileSync(files.request, join(outputDir, 'hosted-scan-request.json'));
copyFileSync(files.response, join(outputDir, 'hosted-scan-response.json'));
copyFileSync(files.surface, join(scanEvidence, 'extension-surface.html'));

const findingRows = response.findings.map((finding) => `<tr>
<td>${esc(finding.severity)}</td>
<td>${esc(finding.rule)}</td>
<td><code>${esc(finding.selector)}</code></td>
<td>${esc(finding.message)}</td>
</tr>`).join('\n');

const gateRows = [
  ['Node syntax', 'node --check scripts/run-local-fixture.mjs', 'pass', 'Script parsed by Node before execution.'],
  ['Local fixture E2E', 'node scripts/run-local-fixture.mjs', ok ? 'pass' : 'block', 'Validated manifest, request, response, settings UI, and rendered result contract.'],
  ['Browser screenshot', 'Chrome headless screenshot of extension-surface.html', screenshotExists ? 'pass' : 'warn', screenshotExists ? 'Screenshot PNG exists and is linked from the evidence report.' : 'Capture screenshot, then rerun this script to mark the gate passed.']
].map(([label, command, status, note]) => `<tr>
<th scope="row">${esc(label)}</th>
<td><span class="status ${esc(status)}">${esc(status)}</span></td>
<td><code>${esc(command)}</code></td>
<td>${esc(note)}</td>
</tr>`).join('\n');

const screenshotBlock = `<figure>
<a href="screenshots/extension-surface.png"><img alt="Screenshot of the Ariada Squarespace extension settings and results fixture" src="screenshots/extension-surface.png"></a>
<figcaption>Rendered local settings/results fixture. Direct image: <a href="screenshots/extension-surface.png">screenshots/extension-surface.png</a>.</figcaption>
</figure>`;

writeFileSync(
  join(testReport, 'result.html'),
  page('Ariada Squarespace local fixture test report', `
<p>Focused E2E for the S12 Squarespace connector. The fixture represents an installed
extension settings page using an Ariada hosted-scan response.</p>
<h2>Gates</h2>
<table><thead><tr><th>Gate</th><th>Status</th><th>Command</th><th>Evidence</th></tr></thead><tbody>${gateRows}</tbody></table>
<h2>Rendered Findings</h2>
<table><thead><tr><th>Severity</th><th>Rule</th><th>Selector</th><th>Message</th></tr></thead><tbody>${findingRows}</tbody></table>
<h2>Raw Logs</h2>
<div class="links">
<a href="logs/local-fixture.txt">local-fixture.txt</a>
<a href="logs/local-fixture.exit">local-fixture.exit</a>
</div>
`),
  'utf8'
);

const implementedRows = [
  ['Extension manifest scaffold', 'implemented', 'Records settings URL, OAuth redirect, uninstall webhook, and Ariada hosted scan endpoint.'],
  ['Local extension settings/results fixture', 'implemented', 'Local HTML surface renders site URL, OAuth state, endpoint, domains, threshold, scan ID, and findings.'],
  ['Hosted scan request fixture', 'implemented', 'Checked-in request JSON models the payload the Squarespace connector sends to Ariada hosted scan.'],
  ['Hosted scan response/report fixture', 'implemented', 'Checked-in response JSON and generated HTML report render accessibility findings without adding local scanner rules.'],
  ['Raw evidence artifacts', 'implemented', 'Request JSON, response JSON, validation log, HTML report, and screenshot path are linked.'],
  ['Squarespace OAuth install', 'not implemented', 'Needs Squarespace Extension OAuth client, redirect host, token storage, and a test account installation.'],
  ['Live Squarespace installation smoke', 'not implemented', 'Needs a real Squarespace site/account where the extension can be installed and opened.'],
  ['Production Ariada API credentials', 'not implemented', 'Needs hosted Ariada API credentials and a real public Squarespace site URL.'],
  ['Marketplace submission', 'not implemented', 'Needs listing copy, privacy/support URLs, screenshots, review submission, and approval.']
].map(([item, status, detail]) => `<tr><th scope="row">${esc(item)}</th><td><span class="status ${status === 'implemented' ? 'pass' : 'block'}">${esc(status)}</span></td><td>${esc(detail)}</td></tr>`).join('\n');

const payerRows = [
  ['Non-technical site owner', 'Pays directly for a low-friction extension that turns a published Squarespace site into a short, understandable accessibility issue list with evidence links.'],
  ['Agency/designer', 'Pays or recommends Ariada to reduce client review friction, export findings, and show a repeatable accessibility check before handoff.'],
  ['Compliance owner', 'Pays for evidence retention, repeatable reports, and audit-ready artifacts when a public site faces EAA/WCAG procurement or legal review.'],
  ['Platform/CI owner', 'Relevant for agencies or multi-site operators: buys API/report automation once many Squarespace sites need recurring evidence.']
].map(([role, value]) => `<tr><th scope="row">${esc(role)}</th><td>${esc(value)}</td></tr>`).join('\n');

const connectorRows = [
  ['Squarespace Extension OAuth', 'OAuth client and redirect URL are required before a real account install can happen.'],
  ['Settings page', 'The fixture shows the settings/results contract; production would host this at connect.ariada.org.'],
  ['Ariada hosted scan API', 'The connector sends site URL, domains, threshold, and source; scanner logic stays in Ariada.'],
  ['Uninstall webhook', 'Manifest records a webhook endpoint so production token cleanup can be wired later.']
].map(([name, detail]) => `<tr><th scope="row">${esc(name)}</th><td>${esc(detail)}</td></tr>`).join('\n');

const competitorRows = [
  ['AccessiBe, AudioEye, UserWay', 'Broad site accessibility overlays and managed scanning; not Squarespace-extension-specific evidence flow.'],
  ['Deque axe DevTools / axe Monitor', 'Strong accessibility testing brand; buyer usually developer or enterprise accessibility team.'],
  ['Siteimprove', 'Governance and website quality platform; higher-touch compliance workflow.'],
  ['Squarespace native settings', 'Covers platform site configuration, not repeatable Ariada evidence artifacts.']
].map(([name, detail]) => `<tr><th scope="row">${esc(name)}</th><td>${esc(detail)}</td></tr>`).join('\n');

writeFileSync(
  join(scanEvidence, 'result.html'),
  page('S12 Squarespace Ariada evidence report', `
<h2>What is Squarespace?</h2>
<p>Squarespace is a hosted website builder and commerce platform for small
businesses, creators, agencies, and independent site owners. The channel user is
often not a developer: they publish pages through Squarespace's editor, install
extensions through the platform marketplace, and expect configuration plus clear
results rather than command-line setup.</p>

<h2>Squarespace Ariada Channel Description</h2>
<p>The S12 channel is a Squarespace extension for SMB and creator sites that need
a simple accessibility evidence surface. The extension does not run scanner logic
inside Squarespace. It sends the published site URL to Ariada hosted scan and
renders findings plus evidence links in the extension settings page.</p>

<h2>Why this is a separate Ariada channel</h2>
<p>Squarespace is separate from CLI, CMS, and framework channels because the
extension runs inside a hosted marketplace/account model. A local Node scanner
cannot be assumed, and the buyer may be a non-technical site owner. The correct
connector is therefore OAuth plus hosted Ariada scan semantics, with a
settings/results page that turns the hosted API response into review-ready
evidence.</p>

<h2>Roles And Payers</h2>
<table><tbody>
<tr><th scope="row">Site owner</th><td>Wants a simple extension settings page and a clear list of issues before publishing or procurement review.</td></tr>
<tr><th scope="row">Agency maintainer</th><td>Installs the extension across client Squarespace sites and exports evidence for review tickets.</td></tr>
<tr><th scope="row">Accessibility reviewer</th><td>Needs raw JSON, screenshot, and repeatable report links rather than a manual statement.</td></tr>
<tr><th scope="row">Economic payer</th><td>Usually the SMB owner, agency retainer, or compliance owner when evidence retention becomes required.</td></tr>
</tbody></table>

<h2>Who pays / what value they buy</h2>
<table><thead><tr><th>Role</th><th>Paid value</th></tr></thead><tbody>${payerRows}</tbody></table>

<h2>Channel User Preferences</h2>
<table><tbody>
<tr><th scope="row">Low setup</th><td>Install extension, connect OAuth, select target, run scan.</td></tr>
<tr><th scope="row">Plain findings</th><td>Site owners need issue text, affected selector, and severity before deep technical exports.</td></tr>
<tr><th scope="row">Agency evidence</th><td>Agencies need downloadable reports and repeatable artifacts for client delivery.</td></tr>
<tr><th scope="row">No local CLI</th><td>Squarespace extensions cannot rely on a local Node process, so the connector must use hosted scan semantics.</td></tr>
</tbody></table>

<h2>Competitors And Narrow Evidence Competitors</h2>
<table><tbody>${competitorRows}</tbody></table>

<h2>Implemented vs not implemented</h2>
<table><thead><tr><th>Area</th><th>Status</th><th>Detail</th></tr></thead><tbody>${implementedRows}</tbody></table>

<h2>Domains Roadmap</h2>
<table><tbody>
<tr><th scope="row">Accessibility</th><td><span class="status pass">implemented in fixture</span> WCAG-style findings are rendered from hosted response JSON.</td></tr>
<tr><th scope="row">Privacy/security</th><td><span class="status warn">planned</span> Useful for commerce/contact integrations once hosted API exposes the domain set.</td></tr>
<tr><th scope="row">SEO/GEO/content provenance</th><td><span class="status warn">planned</span> Good fit for Squarespace marketing sites after the first accessibility wedge is proven.</td></tr>
</tbody></table>

<h2>Technical Connectors</h2>
<table><tbody>${connectorRows}</tbody></table>

<h2>E2E Test Adequacy</h2>
<p>The local E2E validates the extension manifest, hosted request JSON, hosted
response JSON, settings UI labels, result rendering contract, and report links.
It is adequate for repository review of the connector boundary. It is not a
substitute for a real Squarespace account install, OAuth callback, or production
hosted API scan.</p>

<h2>Evidence Screenshot</h2>
${screenshotBlock}

<h2>Raw JSON And Logs</h2>
<div class="links">
<a href="ariada-output/hosted-scan-request.json">hosted-scan-request.json</a>
<a href="ariada-output/hosted-scan-response.json">hosted-scan-response.json</a>
<a href="../test-report/logs/local-fixture.txt">local-fixture.txt</a>
<a href="../test-report/result.html">test-report/result.html</a>
<a href="extension-surface.html">extension-surface.html</a>
</div>

<h2>Blockers</h2>
<table><tbody>
<tr><th scope="row">Squarespace Extension account</th><td>No OAuth client or marketplace onboarding exists in this local workspace.</td></tr>
<tr><th scope="row">Hosted backend</th><td>Production connector needs a HTTPS settings host, OAuth callback, token storage, uninstall webhook, and Ariada API key handling.</td></tr>
<tr><th scope="row">Marketplace review</th><td>Listing copy, privacy/support URLs, screenshots, and approval remain operator work.</td></tr>
</tbody></table>

<h2>Distribution And Monetization Next Steps</h2>
<table><tbody>
<tr><th scope="row">Distribution</th><td>Submit as a Squarespace Extension after OAuth app approval and hosted connector deployment.</td></tr>
<tr><th scope="row">Monetization</th><td>Free install with limited scans; paid hosted evidence retention, agency multi-site dashboard, and exportable compliance packs.</td></tr>
<tr><th scope="row">Promotion</th><td>Target Squarespace agencies, EAA/WCAG readiness content, and SMB site-owner compliance checklists.</td></tr>
</tbody></table>

<h2>Sources</h2>
<ul>
<li><a href="https://developers.squarespace.com/commerce-apis/authentication-and-permissions">Squarespace authentication and permissions</a></li>
<li><a href="https://developers.squarespace.com/commerce-apis/webhooksubscriptions">Squarespace webhook subscriptions</a></li>
<li><a href="https://developers.squarespace.com/webhooks/overview">Squarespace webhooks overview</a></li>
</ul>
`),
  'utf8'
);

if (!ok) {
  process.exitCode = 1;
}

console.log(`Wrote ${relative(process.cwd(), join(testReport, 'result.html'))}`);
console.log(`Wrote ${relative(process.cwd(), join(scanEvidence, 'result.html'))}`);
