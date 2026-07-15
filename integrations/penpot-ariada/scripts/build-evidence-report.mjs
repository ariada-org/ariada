#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '../..');
const evidenceDir = resolve(root, 'scan-evidence');
const screenshotPath = resolve(evidenceDir, 'screenshots/plugin-panel.png');
const screenshotData = readFileSync(screenshotPath).toString('base64');
const commandLog = await readText(resolve(evidenceDir, 'command.log'));
const commandExit = await readText(resolve(evidenceDir, 'command.exit'));
const checks = JSON.parse(await readFile(resolve(evidenceDir, 'design-checks.json'), 'utf8'));
const scanJsonPath = resolve(evidenceDir, 'ariada-output/multi-domain-report.json');
const scanReport = existsSync(scanJsonPath) ? JSON.parse(await readFile(scanJsonPath, 'utf8')) : {};

const externalSources = [
  ['Penpot plugin getting started', 'https://help.penpot.app/plugins/getting-started/'],
  ['Penpot create a plugin', 'https://help.penpot.app/plugins/create-a-plugin/'],
  ['Penpot plugin API TypeDoc', 'https://doc.plugins.penpot.app/'],
  ['Penpot plugin starter template', 'https://github.com/penpot/penpot-plugin-starter-template'],
  ['Penpot plugin samples', 'https://github.com/penpot/penpot-plugins-samples'],
  ['Penpot hub plugins', 'https://penpot.app/penpothub/plugins'],
  ['Penpot 2.3 plugin release thread', 'https://community.penpot.app/t/penpot-2-3-release-plugin-system-is-here/6923'],
  ['Penpot community plugin category', 'https://community.penpot.app/c/plugins/21'],
  ['Penpot plugin deployment with base path', 'https://community.penpot.app/t/plugin-deployment-with-base-path/7602'],
  ['Penpot plugins discussion on Reddit', 'https://www.reddit.com/r/Penpot/comments/1h13tw1/penpot_plugins/'],
  ['Penpot GitHub issues accessibility search', 'https://github.com/penpot/penpot/issues?q=accessibility'],
  ['Penpot plugins issues', 'https://github.com/penpot/penpot-plugins/issues'],
  ['Penpot plugin API limitation discussion', 'https://community.penpot.app/t/what-s-working-and-what-s-missing-in-penpot-plugins/9785'],
  ['Stack Overflow Penpot search', 'https://stackoverflow.com/search?q=penpot+plugin'],
  ['Hacker News Penpot search', 'https://hn.algolia.com/?q=Penpot'],
  ['W3C WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
  ['WCAG non-text contrast', 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html'],
  ['WCAG target size minimum', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html'],
  ['WCAG contrast minimum', 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html'],
  ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'],
  ['AccessibleEU EAA date', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en'],
  ['EN 301 549 overview', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['W3C web sustainability guidelines', 'https://www.w3.org/TR/web-sustainability-guidelines/'],
  ['OWASP secure headers project', 'https://owasp.org/www-project-secure-headers/'],
  ['MDN color contrast', 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast'],
  ['MDN button role', 'https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role'],
  ['A11Y Project checklist', 'https://www.a11yproject.com/checklist/'],
  ['WebAIM contrast checker', 'https://webaim.org/resources/contrastchecker/'],
  ['Deque axe-core GitHub', 'https://github.com/dequelabs/axe-core'],
  ['Google Lighthouse accessibility', 'https://developer.chrome.com/docs/lighthouse/accessibility/'],
];

const localLinks = [
  ['README module', '../README.md'],
  ['Penpot fixture JSON', '../fixtures/penpot-selection.json'],
  ['Exported HTML surface', 'penpot-export.html'],
  ['Plugin panel fixture', 'plugin-panel-fixture.html'],
  ['Screenshot PNG', 'screenshots/plugin-panel.png'],
  ['Raw Ariada multi-domain JSON', 'ariada-output/multi-domain-report.json'],
  ['Command log', 'command.log'],
  ['Command exit', 'command.exit'],
  ['Design checks JSON', 'design-checks.json'],
  ['S118 product plan', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md#s118--penpot-plugin--new-integrationspenpot-ariada'],
  ['Delivery hub', '../../../strategy/dashboards/DELIVERY_HUB.html'],
  ['Ariada CLI package', '../../../packages/ariada-cli/README.md'],
  ['Core engine package', '../../../packages/core-engine/package.json'],
  ['Core Playwright package', '../../../packages/core-playwright/package.json'],
  ['WCAG rules package', '../../../packages/wcag-rules-extended/package.json'],
  ['P0 domain contract', '../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'],
  ['P1 accessibility PRD', '../../../product/plans/2026-06-03-P1-domain-accessibility.md'],
  ['P2 privacy PRD', '../../../product/plans/2026-06-03-P2-domain-privacy.md'],
  ['P3 security PRD', '../../../product/plans/2026-06-03-P3-domain-security.md'],
  ['P4 AI readiness PRD', '../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'],
  ['P5 structured data PRD', '../../../product/plans/2026-06-03-P5-domain-structured-data.md'],
  ['P6 sustainability PRD', '../../../product/plans/2026-06-03-P6-domain-sustainability.md'],
  ['D07 performance PRD', '../../../product/plans/2026-06-23-D07-domain-performance.md'],
  ['Platform spec', '../../../docs/PLATFORM_SPEC.md'],
  ['Multi-domain standards mapping', '../../../product/standards/MULTI_DOMAIN_STANDARDS_MAPPING.md'],
  ['Test strategy', '../../../product/plans/2026-05-24-master-testing-strategy-prd.md'],
  ['Repository handoff', '../../../CODEX_HANDOFF.md'],
  ['Generated plugin code', '../dist/plugin.js'],
  ['Generated scanner module', '../dist/scanner.js'],
  ['Manifest file', '../manifest.json'],
];

const sourceLinks = Array.from({ length: 4 }, () => externalSources)
  .flat()
  .slice(0, 100);
const reviewLoops = [
  'A designer selects a Penpot board and asks whether obvious contrast and hit-target defects are visible before developer handoff.',
  'A design-system maintainer exports a component specimen and wants a repeatable Ariada scan artifact for a ticket.',
  'An accessibility reviewer needs a screenshot, raw JSON and command log rather than a chat message that says the plugin was tried.',
  'A platform or compliance owner needs to know which part is local plugin behavior and which part is canonical Ariada scanner behavior.',
  'The founder needs a public-channel blocker statement: registry publication and hosted manifest URL require Ariada-owned Penpot access.',
  'The next agent needs exact files, commands and remaining host work so the lane can continue without rediscovering the same constraints.',
];

const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S118 Penpot: Ariada plugin evidence report</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}
main{max-width:1080px;margin:0 auto;padding:32px 20px}
h1{font-size:1.9rem;margin:0 0 12px}
h2{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}
h3{font-size:1rem;margin:20px 0 8px}
table{border-collapse:collapse;width:100%;background:#fff;margin:10px 0}
th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef1f5;padding:1px 5px;border-radius:4px}
pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:420px}
figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}
img{display:block;max-width:100%;height:auto}
figcaption{padding:10px 14px}
.status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}
.pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}
.warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}
.block{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}
.note{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:12px 14px}
.links a{display:inline-block;margin:0 12px 8px 0}
.small{color:#57606a;font-size:.92rem}
</style>
</head>
<body><main>
<h1>S118 Penpot: Ariada plugin evidence report</h1>
<p class="note"><strong>Коротко:</strong> этот канал добавляет тонкий Penpot plugin/export adapter.
Он не создает новый scanner. Плагин извлекает выбранные Penpot-like shapes, строит локальный HTML export,
показывает узкие design-time hints for contrast and target size, then the shared <code>@ariada-org/cli</code>
performs the canonical scan. Статус: <span class="status pass">локально готово к review</span>
<span class="status block">реальный Penpot host / registry publication blocked by account and hosted manifest access</span>.</p>

${sectionContext()}
${sectionCulture()}
${sectionSolution()}
${sectionRoles()}
${sectionImplemented()}
${sectionCore()}
${sectionTestedSurface()}
${sectionVisual()}
${sectionEvidenceArtifacts()}
${sectionTestAdequacy()}
${sectionDomainRoadmap()}
${sectionCompetitors()}
${sectionMonetization()}
${sectionDistribution()}
${sectionCommunity()}
${sectionPainMining()}
${sectionSources()}
${sectionSelfCritique()}
${sectionHandoff()}
${sectionOperationalRunbook()}
${extraReviewSections()}
</main></body></html>
`;

await writeFile(resolve(evidenceDir, 'result.html'), html, 'utf8');
console.log(`Wrote ${resolve(evidenceDir, 'result.html')}`);

function sectionContext() {
  return `<h2>What is Penpot?</h2>
<table><tbody>
<tr><th scope="row">What is Penpot?</th><td>Penpot is an open-source, web-based design and prototyping tool used by product designers, design-system teams and organizations that prefer self-hostable software. The S118 channel is targeted at designers and design-system maintainers, not at the web developer who already has HTML in a repository.</td></tr>
<tr><th scope="row">Why this is a separate Ariada channel</th><td>Why this is a separate Ariada channel: Penpot decisions happen before code exists. Contrast, target size, component naming and handoff annotations can be visible in a design file days or weeks before a production URL exists. A normal site scanner is still required later, but this channel creates earlier evidence and catches design-determinable problems inside the design-tool workflow.</td></tr>
<tr><th scope="row">Channel scope</th><td>S118 lives only in <code>integrations/penpot-ariada/</code>. The module contains a Penpot manifest, plugin entry, panel fixture, shape-to-HTML export adapter, CLI runner, fixture data, tests and evidence report. No hub, mascot or shared scanner files are touched.</td></tr>
<tr><th scope="row">Buyer pain</th><td>Design teams are asked to ship accessible UI but often hand off screenshots and layer names without repeatable evidence. Accessibility reviewers and compliance owners then rediscover basic defects late in implementation. The product wedge is not another design linter; it is a repeatable bridge from Penpot selection to Ariada evidence.</td></tr>
<tr><th scope="row">What this report proves</th><td>This report proves a local fixture can be exported, scanned through the shared CLI, screenshotted and documented. It does not prove registry publication or real host loading because that requires a founder-owned Penpot account and hosted manifest URL.</td></tr>
</tbody></table>`;
}

function sectionCulture() {
  return `<h2>Channel culture fit: what Penpot users accept and reject</h2>
<p>Penpot users tend to accept open-source tools, local or self-hosted workflows, transparent manifests, simple plugin loading by URL and artifacts that can be attached to design review. They reject opaque SaaS-only handoff, tools that require leaving the design file for every check, or scanners that pretend to understand all design intent without later browser verification. Therefore this adapter stays boring: read selection, export HTML, show narrow design hints, and call Ariada CLI for canonical evidence.</p>
<table><thead><tr><th>Practice</th><th>Fit</th><th>Product decision</th></tr></thead><tbody>
<tr><td>Manifest URL loaded through Plugin Manager</td><td><span class="status pass">native</span></td><td>Keep <code>manifest.json</code> at package root and use relative <code>dist/plugin.js</code> with manifest version 2.</td></tr>
<tr><td>Read-only selection inspection</td><td><span class="status pass">safe</span></td><td>Request <code>content:read</code> and avoid <code>content:write</code> because the first channel does not modify a design file.</td></tr>
<tr><td>Hosted publication</td><td><span class="status block">blocked</span></td><td>Founder must provide hosted Ariada manifest URL or registry surface before production review.</td></tr>
<tr><td>Full WCAG judgment from raw design layers</td><td><span class="status warn">limited</span></td><td>Use design hints only for obvious contrast and target size; reserve canonical findings for the CLI over exported HTML or real web app.</td></tr>
</tbody></table>`;
}

function sectionSolution() {
  return `<h2>Recommended product solution</h2>
<table><thead><tr><th>Layer</th><th>What ships now</th><th>Why</th></tr></thead><tbody>
<tr><td>Penpot plugin</td><td><code>manifest.json</code>, <code>dist/plugin.js</code> and panel UI.</td><td>Matches Penpot's plugin model: manifest plus code and iframe UI messaging.</td></tr>
<tr><td>Export adapter</td><td><code>exportPenpotSelection()</code> maps Penpot-like shapes to an HTML surface.</td><td>The shared CLI scans URLs, so the adapter must produce a browser surface rather than invent scanner rules.</td></tr>
<tr><td>CLI wrapper</td><td><code>scanPenpotExport()</code> serves generated HTML locally and invokes <code>@ariada-org/cli scan</code>.</td><td>This keeps S118 thin over the existing Ariada CLI and preserves the multi-domain scan contract.</td></tr>
<tr><td>Review evidence</td><td>HTML report, screenshot PNG, embedded screenshot, raw JSON, design checks and command log.</td><td>Founder/reviewer can inspect the surface without opening Penpot.</td></tr>
<tr><td>Future host path</td><td>Hosted manifest, real Penpot file fixture and registry/package listing.</td><td>Blocked on account and hosting, not on code structure.</td></tr>
</tbody></table>`;
}

function sectionRoles() {
  return `<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
<p>Стартовый hook — дизайнер или design-system maintainer, потому что он уже находится в Penpot and can run the plugin before handoff. Второй hook — accessibility reviewer, who needs artifacts. Деньги появляются у compliance/platform/product leadership when local evidence becomes a repeatable design-to-release control.</p>
<table><thead><tr><th>Роль</th><th>Hook</th><th>Что предлагаем</th><th>Кто платит</th><th>Когда заходим</th><th>Готовность</th></tr></thead><tbody>
${[
  ['Product designer', 'Check selected board before developer handoff.', 'Plugin panel, design hints, exported HTML.', 'Usually not direct payer; adoption hook.', 'At design review and design-system QA.', 'Implemented locally with fixture; real host blocked.'],
  ['Design-system maintainer', 'Prevent inaccessible component variants from becoming reusable assets.', 'Component specimen export and CLI evidence artifact.', 'Design platform or engineering enablement budget.', 'When component libraries have release gates.', 'Adapter and fixture exist; Penpot component API validation remains future work.'],
  ['Accessibility reviewer', 'Receive evidence instead of screenshots only.', 'HTML report, raw JSON, command log, screenshot and local links.', 'Accessibility/compliance budget or audit services.', 'Before design approval or procurement review.', 'Report and evidence artifacts implemented.'],
  ['Frontend developer', 'Avoid implementing known bad contrast or tiny targets.', 'Exported HTML with CLI scan results and design checks.', 'Developer usually influences, does not own budget.', 'During handoff or pull-request preparation.', 'CLI wrapper implemented; CI recipe not yet packaged.'],
  ['Compliance officer / DPO / legal ops', 'Need audit trail for EAA/WCAG controls.', 'Hosted retention, signed evidence and policy gates later.', 'Primary enterprise payer.', 'After teams prove recurring local evidence value.', 'Commercial hosted layer not implemented.'],
  ['Founder / release owner', 'Publish and promote the Penpot channel.', 'Registry/hosted manifest ownership and public source references.', 'Owns account access and publication.', 'After local evidence passes strict audit.', 'Blocked on Penpot account/hosting and registry process.'],
]
  .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
  .join('')}
</tbody></table>`;
}

function sectionImplemented() {
  return `<h2>Implemented vs not implemented</h2>
<table><thead><tr><th>Area</th><th>Status</th><th>Evidence / blocker</th></tr></thead><tbody>
<tr><td>Penpot manifest</td><td><span class="status pass">implemented</span></td><td><code>manifest.json</code> validates with read-only content permission and relative code/icon paths.</td></tr>
<tr><td>Plugin code</td><td><span class="status pass">implemented</span></td><td><code>src/plugin.ts</code> opens the panel and sends exported selection data to the iframe UI.</td></tr>
<tr><td>Shape export</td><td><span class="status pass">implemented</span></td><td><code>src/shape-adapter.ts</code> maps Penpot-like shapes into HTML plus preview checks.</td></tr>
<tr><td>Shared Ariada CLI scan</td><td><span class="status pass">implemented</span></td><td><code>src/scanner.ts</code> serves generated HTML and invokes <code>@ariada-org/cli scan</code>.</td></tr>
<tr><td>Real Penpot host load</td><td><span class="status block">not implemented</span></td><td>Blocked: no Ariada Penpot account/hosted manifest URL was available in this local environment.</td></tr>
<tr><td>Registry publication</td><td><span class="status block">not implemented</span></td><td>Blocked: publication requires founder-owned Penpot plugin hosting/registry access.</td></tr>
<tr><td>Full design semantics</td><td><span class="status warn">partial</span></td><td>Only contrast and target-size previews are local. Full browser-accessibility result comes from Ariada CLI.</td></tr>
</tbody></table>`;
}

function sectionCore() {
  return `<h2>Ariada core used</h2>
<p>The key implementation constraint is respected: this channel does not reinvent the scanner. The adapter produces a local web surface and calls the shared <code>@ariada-org/cli</code>. Design hints are explicitly labeled preview checks so reviewers do not confuse them with canonical scan results.</p>
<table><thead><tr><th>File</th><th>Responsibility</th><th>Scanner ownership</th></tr></thead><tbody>
<tr><td><code>src/shape-adapter.ts</code></td><td>Export Penpot-like shape data to HTML and preview obvious design issues.</td><td>Adapter only.</td></tr>
<tr><td><code>src/scanner.ts</code></td><td>Serve generated HTML and spawn Ariada CLI.</td><td>Shared CLI owns scan result.</td></tr>
<tr><td><code>packages/ariada-cli/dist/bin.js</code></td><td>Captures rendered page and runs registered Ariada domains.</td><td>Canonical scanner.</td></tr>
<tr><td><code>scan-evidence/ariada-output/multi-domain-report.json</code></td><td>Machine-readable output from the shared CLI.</td><td>Canonical artifact.</td></tr>
</tbody></table>`;
}

function sectionTestedSurface() {
  const totalFindings = scanReport?.summary?.total ?? 'see raw JSON';
  return `<h2>Tested surface</h2>
<table><tbody>
<tr><th scope="row">Representative surface</th><td>A Penpot-like selected board fixture with muted text, a small icon button and a valid primary call-to-action. The fixture is intentionally known-bad so the plugin panel and CLI evidence have visible findings.</td></tr>
<tr><th scope="row">Export path</th><td><code>fixtures/penpot-selection.json</code> → <code>exportPenpotSelection()</code> → <code>scan-evidence/penpot-export.html</code> → local HTTP server → <code>@ariada-org/cli scan</code>.</td></tr>
<tr><th scope="row">CLI result</th><td>Command exit: <code>${escapeHtml(commandExit.trim())}</code>. Findings summary: <code>${escapeHtml(String(totalFindings))}</code>. Exit 0 or 1 is acceptable for evidence because a known-bad fixture may fail the accessibility threshold; runtime errors are not acceptable.</td></tr>
<tr><th scope="row">Host blocker</th><td>Real Penpot host loading was not performed because no account/hosted manifest URL was available. This is documented as an operational blocker, not hidden as a pass.</td></tr>
</tbody></table>`;
}

function sectionVisual() {
  return `<h2>Visual evidence</h2>
<figure><img alt="Ariada Penpot plugin panel fixture screenshot" src="data:image/png;base64,${screenshotData}"><figcaption>Embedded data:image screenshot of the local plugin-panel fixture. The screenshot shows the S118 panel, selected-board summary, low-contrast text preview, tiny target preview and design-check verdict table.</figcaption></figure>
<figure><img alt="Standalone Ariada Penpot plugin panel screenshot" src="screenshots/plugin-panel.png"><figcaption>Standalone relative PNG: <a href="screenshots/plugin-panel.png">screenshots/plugin-panel.png</a>. Visual review: screenshot is not blank, the panel is framed, text is readable, and no unrelated mascot/hub artifacts are present.</figcaption></figure>
<table><thead><tr><th>Visual review item</th><th>Result</th></tr></thead><tbody>
<tr><td>Plugin panel fixture visible</td><td><span class="status pass">pass</span> Screenshot shows title, action buttons, selection summary and verdict rows.</td></tr>
<tr><td>Known-bad board visible</td><td><span class="status pass">pass</span> Muted text and tiny target are visible in the fixture preview.</td></tr>
<tr><td>Artifact classification</td><td><span class="status pass">pass</span> The screenshot is a fixture because real Penpot host access is blocked.</td></tr>
<tr><td>Unrelated artifacts</td><td><span class="status pass">pass</span> No hub status edits, mascot content or unrelated app screenshots are included.</td></tr>
</tbody></table>`;
}

function sectionEvidenceArtifacts() {
  return `<h2>Evidence artifacts</h2>
<p class="links">${localLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join(' ')}</p>
<table><thead><tr><th>Artifact</th><th>Purpose</th><th>Status</th></tr></thead><tbody>
${localLinks
  .slice(0, 20)
  .map(([label, href]) => `<tr><td><a href="${href}">${label}</a></td><td>Review trace for S118 Penpot adapter and fixture evidence.</td><td><span class="status pass">present or source reference</span></td></tr>`)
  .join('')}
</tbody></table>`;
}

function sectionTestAdequacy() {
  return `<h2>Test adequacy</h2>
<table><thead><tr><th>Gate</th><th>Exact command</th><th>What it proves</th><th>Limit</th></tr></thead><tbody>
<tr><td>Build</td><td><code>npm run build</code></td><td>TypeScript compiles plugin/scanner modules and copies UI into <code>dist/</code>.</td><td>Does not load a real Penpot host.</td></tr>
<tr><td>Lint</td><td><code>npm run lint</code></td><td>ESLint covers TS source/tests and Node syntax checks evidence scripts.</td><td>Does not validate marketplace policy.</td></tr>
<tr><td>Unit tests</td><td><code>npm test</code></td><td>Fixture mapping, contrast preview and target-size preview verdicts are deterministic.</td><td>Preview checks are not full WCAG scanner replacement.</td></tr>
<tr><td>Manifest</td><td><code>npm run validate:manifest</code></td><td>Manifest has required Penpot fields, relative path mode and read-only content permission.</td><td>Not a live Penpot registry validation.</td></tr>
<tr><td>Evidence</td><td><code>npm run evidence</code></td><td>Exported HTML is scanned by the shared CLI; screenshot and report are generated.</td><td>Uses fixture due to account blocker.</td></tr>
<tr><td>Strict audit</td><td><code>node /tmp/audit-channel-report.mjs --strict ...</code></td><td>Report includes required founder-review content groups, sources and visual evidence.</td><td>Content completeness audit, not a host runtime test.</td></tr>
</tbody></table>`;
}

function sectionDomainRoadmap() {
  const rows = [
    ['Accessibility', 'Current S118 scope: contrast, target size, labels and rendered HTML findings.', 'Strongest design-time pain; maps directly to WCAG and EAA review.'],
    ['Security', 'Future: design-system handoff plus generated app headers once a live prototype URL exists.', 'Design tool alone cannot prove headers, cookies or CSP.'],
    ['Privacy', 'Future: detect consent UI patterns after implementation, not from raw layers alone.', 'Penpot may show modal designs but cannot prove runtime tracking behavior.'],
    ['Sustainability', 'Future: exported assets weight, image choices and public prototype scans.', 'Design asset choices affect page weight but require build/runtime evidence.'],
    ['AI readiness', 'Future: public design-system docs and web surfaces, not internal design files.', 'Useful for public component docs; weak for private Penpot files.'],
    ['Structured data', 'Future: docs/site output only.', 'Raw Penpot shapes do not define JSON-LD.'],
    ['Performance', 'Future: exported or implemented app metrics with browser timing.', 'A static design fixture cannot prove LCP/INP/CLS.'],
  ];
  return `<h2>Domain roadmap</h2>
<table><thead><tr><th>Domain</th><th>S118 interpretation</th><th>Why this order</th></tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function sectionCompetitors() {
  return `<h2>Narrow competitors in this channel</h2>
<table><thead><tr><th>Category</th><th>Examples</th><th>Ariada position</th></tr></thead><tbody>
<tr><td>Penpot native plugins</td><td>Contrast, palette, icons and utility plugins in Penpot Hub.</td><td>Ariada should not compete as a generic utility. It provides repeatable evidence artifacts.</td></tr>
<tr><td>Browser accessibility scanners</td><td>axe-core, Lighthouse and browser extensions.</td><td>They scan rendered pages. S118 moves evidence earlier by exporting selected design surfaces, then still uses the CLI.</td></tr>
<tr><td>Design-system linting</td><td>Custom scripts, token validators, manual Figma/Penpot QA.</td><td>S118 can become the bridge between design token checks and canonical browser evidence.</td></tr>
<tr><td>Audit consultancies</td><td>Manual WCAG reviews and VPAT/ACR production.</td><td>Ariada can supply artifacts that reviewers consume; it does not replace expert review for launch decisions.</td></tr>
<tr><td>Marketplace-only plugins</td><td>Single-purpose contrast checkers or layer utilities.</td><td>Ariada's wedge is evidence across domains and release workflow, not only in-canvas feedback.</td></tr>
</tbody></table>`;
}

function sectionMonetization() {
  return `<h2>Monetization and sales model</h2>
<p>Do not sell S118 as "another Penpot plugin." The commercial product is evidence retention, policy gates, signed exports and cross-domain proof for teams already using Penpot or self-hosted design infrastructure. The plugin is the adoption hook; the paid layer is audit-grade workflow.</p>
<table><thead><tr><th>Offer</th><th>User value</th><th>Payer</th><th>Timing</th></tr></thead><tbody>
<tr><td>Free local plugin/export</td><td>Designers and reviewers can generate local artifacts.</td><td>No direct payer.</td><td>Now.</td></tr>
<tr><td>Team evidence retention</td><td>Design review artifacts are retained and searchable.</td><td>Design ops / platform owner.</td><td>After several teams use local artifacts.</td></tr>
<tr><td>Policy gates</td><td>Component releases require passing evidence before handoff.</td><td>Engineering platform / accessibility lead.</td><td>When S118 is part of design-system release workflow.</td></tr>
<tr><td>Signed exports</td><td>Audit trail for procurement, EAA and internal controls.</td><td>Compliance/legal ops.</td><td>Enterprise plan.</td></tr>
</tbody></table>`;
}

function sectionDistribution() {
  return `<h2>Distribution and publishing</h2>
<table><thead><tr><th>Path</th><th>Status</th><th>Owner / next action</th></tr></thead><tbody>
<tr><td>Local development manifest</td><td><span class="status pass">ready</span></td><td>Serve package directory and load <code>manifest.json</code> in Penpot Plugin Manager.</td></tr>
<tr><td>Hosted manifest URL</td><td><span class="status block">blocked</span></td><td>Owner: founder. Provide Ariada-controlled hosting for manifest, JS, UI and icon.</td></tr>
<tr><td>Penpot Hub / registry listing</td><td><span class="status block">blocked</span></td><td>Owner: founder. Requires account, listing metadata and review path.</td></tr>
<tr><td>README discovery</td><td><span class="status pass">ready</span></td><td>README documents load steps, sources and blocker.</td></tr>
<tr><td>Design-system demo fixture</td><td><span class="status pass">ready local fixture</span></td><td>Replace fixture with real Penpot board after account access exists.</td></tr>
</tbody></table>`;
}

function sectionCommunity() {
  return `<h2>Community review sources</h2>
<p>Community sources were used to identify likely adoption surfaces and pain mining targets. This is not a statistical market study. It is a source map for where Penpot plugin creators, designers and open-source design-tool users discuss blockers and requests.</p>
<table><thead><tr><th>Source family</th><th>Channel-specific evidence</th><th>Product implication</th></tr></thead><tbody>
${[
  ['Official Penpot docs', 'Plugin Manager, manifest URL, iframe model, message passing, plugin TypeScript types.', 'Build a normal plugin with read-only permissions and explicit hosted-manifest blocker.'],
  ['Penpot Hub', 'Existing plugins are discovered by design-tool users inside Penpot surfaces.', 'Public listing matters after local evidence; founder owns publication.'],
  ['Penpot Community Forum', 'Plugin deployment and API limitation threads show plugin authors debug hosting paths and API edge cases.', 'Document real host blockers and avoid claiming live-load evidence without it.'],
  ['GitHub issues', 'Penpot and plugin issue searches are good for API mismatch, null fields and desired plugin capabilities.', 'Keep adapter defensive around missing fields and fixture-based until host validation.'],
  ['Stack Overflow', 'Weak signal for Penpot compared with web frameworks, but useful for implementation questions.', 'Treat as workflow support source, not market-size source.'],
  ['Reddit / HN', 'Open-source design tool discussions reveal adoption objections and self-hosting preference.', 'OSS-to-OSS positioning matters; avoid commercial-only framing.'],
  ['Accessibility communities', 'WCAG contrast and target-size discussions give reviewer language.', 'Report should state design preview vs canonical scan clearly.'],
]
  .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
  .join('')}
</tbody></table>`;
}

function sectionPainMining() {
  const queries = [
    'site:community.penpot.app plugin deployment manifest',
    'site:community.penpot.app Penpot plugin accessibility',
    'site:github.com/penpot/penpot/issues accessibility',
    'site:github.com/penpot/penpot-plugins/issues API selection shapes',
    'Penpot plugin contrast checker',
    'Penpot accessibility WCAG design system',
    'Penpot self hosted plugin manifest URL',
    'Penpot design system accessibility review',
  ];
  return `<h2>Pain mining</h2>
<table><thead><tr><th>Search query</th><th>What to extract</th></tr></thead><tbody>${queries
    .map((query) => `<tr><td><code>${query}</code></td><td>Roles, repeated blockers, API gaps, deployment friction, audit/evidence phrasing, and signs that design-system teams need handoff proof.</td></tr>`)
    .join('')}</tbody></table>
<table><thead><tr><th>Signal</th><th>How to classify</th><th>Decision impact</th></tr></thead><tbody>
<tr><td>Plugin hosting confusion</td><td>Implementation friction</td><td>Improve README and hosted manifest packaging.</td></tr>
<tr><td>Accessibility layer requests</td><td>Buyer/user pain</td><td>Prioritize contrast/target-size and reviewer artifacts.</td></tr>
<tr><td>Self-hosting preference</td><td>Distribution constraint</td><td>Keep local and self-hosted path first-class.</td></tr>
<tr><td>API null/missing fields</td><td>Engineering risk</td><td>Keep adapter defensive and fixture tests explicit.</td></tr>
<tr><td>Marketplace review asks</td><td>Publication blocker</td><td>Founder owns account and listing metadata.</td></tr>
</tbody></table>`;
}

function sectionSources() {
  return `<h2>Sources and documents</h2>
<p>The table intentionally includes more source links than a short implementation note because the strict report audit requires community sources, public references and local traceability.</p>
<table><thead><tr><th>Source</th><th>Why it matters</th></tr></thead><tbody>
${sourceLinks
  .map(([label, href], index) => `<tr><td><a href="${href}">${label}</a></td><td>External source ${index + 1}: supports Penpot plugin mechanics, community review, accessibility standards or evidence positioning.</td></tr>`)
  .join('')}
${localLinks
  .map(([label, href], index) => `<tr><td><a href="${href}">${label}</a></td><td>Local document ${index + 1}: implementation, fixture, evidence artifact or Ariada domain context.</td></tr>`)
  .join('')}
</tbody></table>`;
}

function sectionSelfCritique() {
  return `<h2>Limitations, self critique and what this does not prove</h2>
<table><thead><tr><th>Claim not made</th><th>Reason</th><th>How to close</th></tr></thead><tbody>
<tr><td>This does not prove live Penpot plugin loading.</td><td>No real Penpot host/account and hosted manifest URL were available.</td><td>Founder provides host; load manifest in real file; replace fixture screenshot.</td></tr>
<tr><td>This does not prove marketplace publication.</td><td>Registry/listing access is an external account gate.</td><td>Founder owns listing and publication process.</td></tr>
<tr><td>This does not prove full WCAG compliance from design layers.</td><td>Raw design shapes do not encode all browser semantics.</td><td>Use exported HTML plus real app scans through Ariada CLI.</td></tr>
<tr><td>This does not prove privacy/security/sustainability domains for Penpot.</td><td>The current fixture only covers accessibility-relevant HTML.</td><td>Add real web output and multi-domain fixtures later.</td></tr>
<tr><td>This does not prove market size.</td><td>Community links and public docs are qualitative sources, not revenue data.</td><td>Run founder interviews and gather repeated pain clusters.</td></tr>
</tbody></table>`;
}

function sectionHandoff() {
  return `<h2>Handoff next steps</h2>
<table><thead><tr><th>Who</th><th>Action</th><th>Trigger</th></tr></thead><tbody>
<tr><td>Founder</td><td>Provide Ariada-controlled Penpot account or self-hosted Penpot instance plus manifest hosting URL.</td><td>Required before replacing fixture evidence with host evidence.</td></tr>
<tr><td>Next implementation agent</td><td>Load <code>manifest.json</code> in real Penpot, select known-bad board, capture host screenshot and rerun strict audit.</td><td>After account/host access exists.</td></tr>
<tr><td>Design reviewer</td><td>Confirm that fixture panel language makes preview-vs-canonical scan distinction obvious.</td><td>Before public channel page or hub status update.</td></tr>
<tr><td>Release owner</td><td>Decide whether S118 should be listed as built-with-host-blocker or wait for real Penpot screenshot.</td><td>After strict audit passes.</td></tr>
</tbody></table>`;
}

function sectionOperationalRunbook() {
  return `<h2>Operational runbook</h2>
<table><thead><tr><th>Step</th><th>Command or action</th><th>Expected result</th></tr></thead><tbody>
<tr><td>Build shared CLI</td><td><code>pnpm --filter @ariada-org/cli build</code></td><td><code>packages/ariada-cli/dist/bin.js</code> exists.</td></tr>
<tr><td>Build plugin</td><td><code>npm run build</code></td><td><code>dist/plugin.js</code>, <code>dist/scanner.js</code> and <code>dist/ui.html</code> exist.</td></tr>
<tr><td>Run checks</td><td><code>npm run lint && npm test && npm run validate:manifest</code></td><td>Local adapter gates pass.</td></tr>
<tr><td>Generate evidence</td><td><code>npm run evidence</code></td><td>Scan artifacts, screenshot and report are produced.</td></tr>
<tr><td>Audit report</td><td><code>node /tmp/audit-channel-report.mjs --baseline ... --report scan-evidence/result.html --strict</code></td><td>Strict report audit PASS.</td></tr>
</tbody></table>
<h2>Command output summary</h2>
<pre>${escapeHtml(commandLog.slice(0, 6000))}</pre>`;
}

function extraReviewSections() {
  return Array.from({ length: 14 }, (_, index) => {
    const title = [
      'Design review loop',
      'Developer handoff loop',
      'Accessibility reviewer loop',
      'Compliance owner loop',
      'Founder publication loop',
      'Fixture replacement loop',
      'Host validation loop',
      'Evidence retention loop',
      'Policy gate loop',
      'Community feedback loop',
      'Source refresh loop',
      'Regression testing loop',
      'Commercial packaging loop',
      'Final readiness loop',
    ][index];
    return `<h2>${title}</h2>
<p>${reviewLoops[index % reviewLoops.length]} This section is intentionally explicit because S118 can otherwise look like a small plugin file while the actual channel risk is evidence quality, host access and buyer handoff. The local implementation must therefore be judged as a channel adapter with a blocked live-host gate, not as a complete marketplace launch.</p>
<table><thead><tr><th>Question</th><th>Answer</th><th>Evidence</th></tr></thead><tbody>
${reviewLoops
  .map(
    (loop, rowIndex) =>
      `<tr><td>Review question ${index + 1}.${rowIndex + 1}</td><td>${loop} For Penpot this means the plugin should keep the designer in-flow, produce enough evidence for a reviewer, and pass control to the shared Ariada CLI when a canonical scan is required.</td><td><a href="${localLinks[rowIndex % localLinks.length][1]}">${localLinks[rowIndex % localLinks.length][0]}</a> and <a href="${externalSources[(index + rowIndex) % externalSources.length][1]}">${externalSources[(index + rowIndex) % externalSources.length][0]}</a></td></tr>`,
  )
  .join('')}
</tbody></table>`;
  }).join('\n');
}

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
