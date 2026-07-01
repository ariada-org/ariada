#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const testReport = resolve(root, 'test-report');
const scanEvidence = resolve(root, 'scan-evidence');
const logsDir = resolve(testReport, 'logs');
const reportPath = resolve(scanEvidence, 'ariada-output/webflow-panel-report.json');
const screenshotPath = resolve(scanEvidence, 'screenshots/webflow-panel.png');

await mkdir(testReport, { recursive: true });
await mkdir(scanEvidence, { recursive: true });

const report = await readJson(reportPath, { findings: [], summary: { total: 0, counts: {} } });
const commandLog = await read(resolve(scanEvidence, 'command.log'));

await writeFile(resolve(testReport, 'result.html'), page('Ariada Webflow local test report', testBody()), 'utf8');
await writeFile(resolve(scanEvidence, 'result.html'), page('S11 Webflow app evidence report', evidenceBody(report, commandLog)), 'utf8');

function testBody() {
  const gates = [
    ['lint', 'pnpm --dir integrations/webflow-ariada run lint'],
    ['test', 'pnpm --dir integrations/webflow-ariada test'],
    ['fixture-flow', 'pnpm --dir integrations/webflow-ariada run test:e2e'],
    ['build', 'pnpm --dir integrations/webflow-ariada build'],
    ['screenshot', 'Google Chrome headless screenshot of local fixture'],
    ['screenshot-validate', 'node scripts/validate-screenshot.mjs scan-evidence/screenshots/webflow-panel.png'],
  ];
  return `
<p>Focused local gates for the Webflow Designer-panel adapter and fixture.</p>
<table><thead><tr><th>Gate</th><th>Status</th><th>Command</th><th>Raw log</th></tr></thead><tbody>
${gates.map(([name, command]) => `<tr><th scope="row">${esc(name)}</th><td>${statusPill(statusFor(name))}</td><td><code>${esc(command)}</code></td><td><a href="logs/${name}.log">log</a> · <a href="logs/${name}.exit">exit</a></td></tr>`).join('')}
</tbody></table>
<h2>Logs</h2>
${gates.map(([name]) => `<details><summary>${esc(name)}</summary><pre>${esc(readSync(resolve(logsDir, `${name}.log`)) || '(no output)')}</pre></details>`).join('')}
`;
}

function evidenceBody(data, logText) {
  return `
<section>
  <h2>What is Webflow?</h2>
  <p>Webflow is a visual website builder and CMS used by site owners, designers and agencies to design, publish and maintain marketing sites, landing pages and CMS-backed pages without treating every change as a traditional application deployment. The core work surface is the Webflow Designer: a browser-based canvas where teams edit page structure, styling, content bindings and publishing state. Webflow Apps can extend that workflow through Designer Extensions, which appear inside the Designer, and Data Client capabilities, which connect the site or workspace to external services through OAuth and Webflow APIs.</p>
</section>
<section>
  <h2>Channel Description</h2>
  <p>S11 is the Ariada Webflow app channel: a Designer Extension and Data Client style adapter for agencies and site builders who need Ariada scan findings while a Webflow page is still in the Designer handoff workflow. This local build does not register a real Webflow app; it proves the request shape, panel rendering, hosted-scan contract and evidence output with a local Designer-panel fixture.</p>
</section>
<section>
  <h2>Why this is a separate Ariada channel</h2>
  <p>Webflow needs its own Ariada channel because the buyer and workflow are not the same as a developer CLI, browser extension or CMS plugin. Webflow users often work inside a hosted Designer canvas, publish through Webflow hosting and expect marketplace installation instead of package-manager setup. The adapter therefore has to package Ariada as a Designer-panel and OAuth-hosted scan workflow: the scan still belongs to Ariada hosted scan/CLI semantics, but the distribution, evidence framing and blocker model belong to Webflow.</p>
</section>
<section>
  <h2>Who pays / what value they buy</h2>
  ${table(['Role', 'What they need', 'What value they buy', 'Payer fit'], [
    ['Webflow site owner', 'A clear answer before publishing: is this site likely to fail an accessibility review?', 'Lower launch risk, client-ready evidence and a first remediation list without commissioning a full manual audit first.', 'Direct marketplace buyer for single-site subscriptions or per-scan evidence packs.'],
    ['Webflow agency/designer', 'A Designer-native panel that finds issues before client handoff and avoids forcing every designer into CLI tooling.', 'Faster QA loops, reusable handoff artifacts and a differentiator for accessibility-aware client delivery.', 'Strong agency-plan buyer; can resell evidence as part of launch QA.'],
    ['compliance owner', 'Repeatable evidence tied to a rendered page, with raw JSON, screenshot, command log and blocker status.', 'Audit trail for WCAG/EAA review, procurement support and a way to compare release risk across sites.', 'Economic buyer in regulated or public-sector contexts.'],
    ['release/platform owner', 'A hosted scan contract that can later be standardized across many Webflow sites and release workflows.', 'Consistent policy gates, retained artifacts and integration with broader Ariada domains after accessibility.', 'Platform/team budget buyer once multiple sites or agencies need the same gate.'],
  ])}
</section>
<section>
  <h2>Why this channel matters commercially</h2>
  <p>Webflow concentrates designers and agencies who ship client marketing sites, landing pages and CMS-backed pages. That makes it a useful distribution channel for Ariada because accessibility evidence can be sold as a handoff and publishing risk reducer rather than as another scanner destination.</p>
</section>
<section>
  <h2>Channel User Preferences</h2>
  ${table(['Preference', 'S11 implication'], [
    ['Designer-native workflow', 'Panel must summarize findings without forcing a terminal workflow.'],
    ['Low setup friction', 'OAuth install and hosted API must do the heavy lifting after marketplace approval.'],
    ['Client-ready artifacts', 'Reports need screenshot, raw JSON and concise remediation text.'],
    ['No scanner maintenance', 'Adapter delegates to Ariada hosted scan/CLI semantics and does not implement WCAG rules.'],
  ])}
</section>
<section>
  <h2>Competitors And Narrow Evidence Competitors</h2>
  ${table(['Category', 'Examples', 'Ariada wedge'], [
    ['Webflow app ecosystem', 'Native Webflow Apps, Designer Extensions and CMS Data Clients.', 'Ariada adds compliance evidence in the same publishing workflow.'],
    ['Accessibility overlays/widgets', 'Generic site widgets and quick-check tools.', 'Ariada emphasizes evidence artifacts and scanner output, not visual-only overlays.'],
    ['Enterprise accessibility platforms', 'Deque, Siteimprove, Level Access, AudioEye, Evinced-style scanners.', 'Ariada starts with a thin marketplace adapter for agency workflows and can escalate to hosted evidence retention.'],
    ['Browser/CI scanners', 'axe, Lighthouse, Pa11y, Accessibility Insights.', 'Ariada packages the hosted result for Webflow users who do not live in CI.'],
  ])}
</section>
<section>
  <h2>Implemented vs not implemented</h2>
  ${table(['Item', 'Status', 'Evidence'], [
    ['Adapter helpers', 'implemented', '<code>src/index.mjs</code> builds OAuth URLs, hosted scan requests, normalized finding rows and panel view models.'],
    ['Designer-panel fixture', 'implemented', '<code>fixture/index.html</code> renders a Webflow-like panel and calls a local hosted-API fixture.'],
    ['Hosted API scanner', 'blocked', 'Real SaaS endpoint is required; local fixture returns Ariada-shaped findings only.'],
    ['Webflow app registration', 'blocked', 'Requires Webflow developer workspace, app registration, OAuth callback and app credentials.'],
    ['Marketplace submission', 'blocked', 'Requires bundle upload, app review materials, demo account and founder submission.'],
  ])}
</section>
<section>
  <h2>Domains Roadmap</h2>
  ${table(['Domain', 'Now', 'Roadmap'], [
    ['Accessibility', 'Primary request domain in this adapter.', 'Keep as first marketplace value proposition for WCAG/EAA review.'],
    ['Privacy', 'Not implemented.', 'Add cookie and tracker evidence once hosted scan exposes privacy findings.'],
    ['Security', 'Not implemented.', 'Add CSP/header/mixed-content checks for published Webflow domains.'],
    ['SEO and AI readiness', 'Not implemented.', 'Useful for Webflow marketing sites after the core scan flow is live.'],
    ['Brand/design-token checks', 'Not implemented.', 'Agency upsell after visual capture and token-source mapping exist.'],
  ])}
</section>
<section>
  <h2>Technical Connectors</h2>
  ${table(['Connector', 'State'], [
    ['Webflow OAuth', 'Helper builds authorization URLs; token exchange is host-side and blocked without app credentials.'],
    ['Designer Extension', 'Local iframe-style fixture proves panel UI; real Webflow bundle upload is blocked by workspace access.'],
    ['Data Client', 'Request context includes site/page identifiers for host API correlation.'],
    ['Ariada hosted scan API', 'Adapter produces a hosted scan request and normalizes returned findings; fixture does not scan DOM itself.'],
  ])}
</section>
<section>
  <h2>E2E Test Adequacy</h2>
  <p>The local fixture flow starts a real HTTP server, fetches Webflow page context, posts a hosted-scan-shaped request, receives Ariada-shaped findings and renders those findings in the browser panel. It is adequate for adapter contract and panel evidence. It is not adequate for marketplace, OAuth token exchange, Webflow iframe permissions or real production scanning.</p>
</section>
<section>
  <h2>Raw JSON And Logs</h2>
  <p class="links"><a href="ariada-output/webflow-panel-report.json">Raw fixture JSON</a><a href="command.log">Fixture command log</a><a href="command.exit">Fixture exit code</a><a href="../test-report/result.html">Test report</a></p>
  <pre>${esc(logText || '(no command log yet)')}</pre>
</section>
<section>
  <h2>Embedded Screenshot</h2>
  ${screenshotFigure()}
</section>
<section>
  <h2>Blockers</h2>
  ${table(['Blocker', 'Owner', 'Next action'], [
    ['Webflow developer workspace and app registration', 'Founder or channel owner', 'Register app with Designer Extension and Data Client capabilities.'],
    ['OAuth credentials and HTTPS callback', 'Hosted Ariada owner', 'Provision callback URL, secrets storage and token exchange endpoint.'],
    ['Designer Extension bundle upload', 'Founder or channel owner', 'Build and upload bundle through Webflow app version manager.'],
    ['Marketplace review', 'Founder', 'Prepare submission form, demo account, reviewer access and demo video.'],
  ])}
</section>
<section>
  <h2>Distribution And Monetization Next Steps</h2>
  <p>Package the Webflow app as a marketplace-first agency offer: free panel scan preview, paid hosted evidence retention, client-ready exports, multi-site agency dashboard and additional domains for privacy, security, SEO and AI readiness. The first monetizable surface should be agency client handoff evidence, not a standalone scanner clone.</p>
</section>
<section>
  <h2>Sources</h2>
  <ul>
    <li>Webflow Developers, Register an App, accessed 2026-07-01, primary/high: <a href="https://developers.webflow.com/data/docs/register-an-app">developers.webflow.com/data/docs/register-an-app</a>.</li>
    <li>Webflow Developers, Designer API introduction, accessed 2026-07-01, primary/high: <a href="https://developers.webflow.com/designer/reference/introduction">developers.webflow.com/designer/reference/introduction</a>.</li>
    <li>Webflow Developers, Submitting Your App to the Webflow Marketplace, accessed 2026-07-01, primary/high: <a href="https://developers.webflow.com/data/v2.0.0-beta/docs/marketplace/submitting-your-app">developers.webflow.com/data/v2.0.0-beta/docs/marketplace/submitting-your-app</a>.</li>
    <li>Webflow Developers, OAuth, accessed 2026-07-01, primary/high: <a href="https://developers.webflow.com/data/reference/oauth-app">developers.webflow.com/data/reference/oauth-app</a>.</li>
  </ul>
</section>`;
}

function screenshotFigure() {
  if (!existsSync(screenshotPath)) {
    return '<p><strong>Evidence gap:</strong> screenshot not captured yet.</p>';
  }
  const relative = `screenshots/${esc(basename(screenshotPath))}`;
  return `<figure><a href="${relative}"><img alt="Screenshot of the Ariada Webflow Designer-panel fixture showing scan findings" src="${relative}"></a><figcaption>Browser screenshot of the local Webflow panel fixture. Direct PNG: <a href="${relative}">${relative}</a>.</figcaption></figure>`;
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).includes('<') ? cell : esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}main{max-width:1120px;margin:0 auto;padding:32px 20px}h1{font-size:2rem;margin:0 0 18px}h2{font-size:1.2rem;margin-top:30px;border-bottom:1px solid #d8dde5;padding-bottom:6px}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{background:#eef1f5;padding:1px 5px;border-radius:4px}pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:440px}.pill{border-radius:999px;display:inline-block;font-size:.82rem;font-weight:800;padding:2px 8px}.pass{background:#dff7e7;color:#116329}.fail{background:#ffe2e0;color:#8c1d18}.missing{background:#fff4ce;color:#744500}figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}img{display:block;max-width:100%;height:auto}.links a{display:inline-block;margin:0 12px 8px 0}
</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function statusFor(name) {
  const value = readSync(resolve(logsDir, `${name}.exit`)).trim();
  if (value === '0') return 'pass';
  return value ? 'fail' : 'missing';
}

function statusPill(status) {
  return `<span class="pill ${status}">${status}</span>`;
}

async function read(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function readSync(path, encoding = 'utf8') {
  try {
    return Buffer.from(readFileSync(path)).toString(encoding);
  } catch {
    return '';
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
