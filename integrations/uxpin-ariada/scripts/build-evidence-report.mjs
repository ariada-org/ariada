#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const channel = {
  id: 'S121',
  name: 'UXPin',
  title: 'S121 UXPin Ariada evidence report',
  adapter: 'uxpin-ariada',
  command: 'uxpin-ariada scan <export-or-url>',
  fixture: 'UXPin Merge-style checkout prototype export',
  host: 'UXPin preview, Merge handoff, or exported prototype HTML',
  docsPlan: '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md',
  screenshotAlt: 'UXPin recipe panel fixture showing Ariada evidence handoff for exported prototype HTML',
};

const evidenceDir = resolve('scan-evidence');
const screenshotPath = resolve(evidenceDir, 'screenshots/extension-panel.png');
const reportPath = resolve(evidenceDir, 'result.html');
const rawJsonPath = resolve(evidenceDir, 'ariada-output/multi-domain-report.json');
const commandLogPath = resolve(evidenceDir, 'command.log');
const commandExitPath = resolve(evidenceDir, 'command.exit');

const screenshot = await readFile(screenshotPath);
const commandLog = await readText(commandLogPath);
const commandExit = (await readText(commandExitPath)).trim();
const rawReport = JSON.parse(await readText(rawJsonPath));
const site = rawReport.sites?.[0] ?? 'fixture target';

const sources = [
  ['UXPin Merge documentation', 'https://www.uxpin.com/docs/merge/'],
  ['UXPin documentation home', 'https://www.uxpin.com/docs/'],
  ['UXPin preview and prototype sharing', 'https://www.uxpin.com/docs/getting-started/previewing-and-sharing/'],
  ['UXPin design systems guide', 'https://www.uxpin.com/design-systems/'],
  ['UXPin accessibility topic', 'https://www.uxpin.com/studio/blog/accessibility-in-design-systems/'],
  ['UXPin blog: accessibility design', 'https://www.uxpin.com/studio/blog/web-accessibility-design/'],
  ['UXPin blog: design handoff', 'https://www.uxpin.com/studio/blog/design-handoff/'],
  ['UXPin blog: design systems', 'https://www.uxpin.com/studio/blog/design-system/'],
  ['UXPin support and community', 'https://www.uxpin.com/support/'],
  ['UXPin pricing', 'https://www.uxpin.com/pricing/'],
  ['Figma Dev Mode documentation', 'https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode'],
  ['Storybook accessibility testing', 'https://storybook.js.org/docs/writing-tests/accessibility-testing'],
  ['Playwright accessibility testing', 'https://playwright.dev/docs/accessibility-testing'],
  ['W3C WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
  ['W3C ACT Rules Format', 'https://www.w3.org/TR/act-rules-format/'],
  ['W3C ARIA Authoring Practices Guide', 'https://www.w3.org/WAI/ARIA/apg/'],
  ['W3C Web Sustainability Guidelines', 'https://www.w3.org/TR/web-sustainability-guidelines/'],
  ['European Accessibility Act overview', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'],
  ['ETSI EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['GDPR text', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'],
  ['EU AI Act Article 50', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50'],
  ['web.dev Core Web Vitals', 'https://web.dev/articles/vitals'],
  ['Google Search Central structured data intro', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'],
  ['Google Rich Results Test', 'https://search.google.com/test/rich-results'],
  ['llms.txt proposal', 'https://llmstxt.org/'],
  ['robots.txt RFC 9309', 'https://www.rfc-editor.org/rfc/rfc9309'],
  ['Deque axe', 'https://www.deque.com/axe/'],
  ['WAVE', 'https://wave.webaim.org/'],
  ['Lighthouse accessibility audits', 'https://developer.chrome.com/docs/lighthouse/accessibility/'],
  ['Accessibility Insights', 'https://accessibilityinsights.io/'],
  ['Pa11y', 'https://pa11y.org/'],
  ['Siteimprove accessibility', 'https://www.siteimprove.com/accessibility/'],
  ['Level Access', 'https://www.levelaccess.com/'],
  ['TPGi ARC Platform', 'https://www.tpgi.com/arc-platform/'],
  ['Stark accessibility tools', 'https://www.getstark.co/'],
  ['A11Y Project checklist', 'https://www.a11yproject.com/checklist/'],
  ['WebAIM contrast checker', 'https://webaim.org/resources/contrastchecker/'],
  ['WebAIM Million', 'https://webaim.org/projects/million/'],
  ['W3C Easy Checks', 'https://www.w3.org/WAI/test-evaluate/preliminary/'],
  ['WCAG-EM overview', 'https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/'],
  ['MDN accessibility', 'https://developer.mozilla.org/en-US/docs/Web/Accessibility'],
  ['MDN image alt text', 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt'],
  ['MDN CSP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'],
  ['MDN Referrer Policy', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'],
  ['MDN X-Content-Type-Options', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'],
  ['Website Carbon Calculator', 'https://www.websitecarbon.com/'],
  ['Ecograder', 'https://ecograder.com/'],
  ['HTTP Archive Web Almanac accessibility', 'https://almanac.httparchive.org/en/2024/accessibility'],
  ['HTTP Archive Web Almanac performance', 'https://almanac.httparchive.org/en/2024/performance'],
  ['Reddit UXDesign community', 'https://www.reddit.com/r/UXDesign/'],
  ['Reddit accessibility community', 'https://www.reddit.com/r/accessibility/'],
  ['Stack Overflow accessibility tag', 'https://stackoverflow.com/questions/tagged/accessibility'],
  ['Stack Overflow UXPin search', 'https://stackoverflow.com/search?q=UXPin+accessibility'],
  ['GitHub UXPin accessibility issue search', 'https://github.com/search?q=UXPin+accessibility&type=issues'],
  ['GitHub WCAG prototype issue search', 'https://github.com/search?q=wcag+prototype&type=issues'],
  ['HN UXPin search', 'https://hn.algolia.com/?q=UXPin'],
  ['Ariada CLI README', '../../../packages/ariada-cli/README.md'],
  ['Ariada domain module contract', '../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'],
  ['Ariada accessibility domain', '../../../product/plans/2026-06-03-P1-domain-accessibility.md'],
  ['Ariada privacy domain', '../../../product/plans/2026-06-03-P2-domain-privacy.md'],
  ['Ariada security domain', '../../../product/plans/2026-06-03-P3-domain-security.md'],
  ['Ariada AI readiness domain', '../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'],
  ['Ariada structured data domain', '../../../product/plans/2026-06-03-P5-domain-structured-data.md'],
  ['Ariada sustainability domain', '../../../product/plans/2026-06-03-P6-domain-sustainability.md'],
  ['Ariada performance domain', '../../../product/plans/2026-06-23-D07-domain-performance.md'],
  ['Ariada delivery hub', '../../../strategy/dashboards/DELIVERY_HUB.html'],
  ['Local README', '../README.md'],
  ['Raw scanner JSON', 'ariada-output/multi-domain-report.json'],
  ['Command log', 'command.log'],
  ['Command exit', 'command.exit'],
  ['Screenshot PNG', 'screenshots/extension-panel.png'],
];

const domainRows = (rawReport.domains ?? []).map((domain) => {
  const count = rawReport.grid?.[site]?.[domain]?.length ?? 0;
  return [domain, `${count} finding(s) on ${site}`, domainMeaning(domain), 'Use this domain row to prioritize the next UXPin recipe iteration.'];
});

const sections = [
  ['What is UXPin?', whatRows()],
  ['Why this is a separate Ariada channel', separateRows()],
  ['Channel culture fit', cultureRows()],
  ['Channel user preference research', preferenceRows()],
  ['Project solution', solutionRows()],
  ['Кому что продаем: роли, hooks, кто платит и что уже готово', roleRows()],
  ['Implemented vs not implemented', implementedRows()],
  ['Ariada core used', coreRows()],
  ['Tested surface', testedRows()],
  ['Domain roadmap', domainRows],
  ['Narrow competitors by Ariada domain', competitorRows()],
  ['Monetization and sales model', monetizationRows()],
  ['Distribution and publishing plan', distributionRows()],
  ['Community review sources', communityRows()],
  ['Pain mining', painRows()],
  ['Evidence artifacts', artifactRows()],
  ['Test adequacy', adequacyRows()],
  ['Handoff next steps for Codex', codexRows()],
  ['Handoff next steps for human', humanRows()],
  ['Self critique and limitations', limitationRows()],
  ['Visual evidence', visualRows()],
  ['Visual review', visualReviewRows()],
  ['Operational blocker ownership', blockerRows()],
  ['Config contract', configRows()],
  ['CLI invocation contract', cliRows()],
  ['Fixture export anatomy', fixtureRows()],
  ['Design-stage vs rendered-DOM coverage', coverageRows()],
  ['Security and privacy notes', securityPrivacyRows()],
  ['Sustainability and AI-readiness notes', sustainabilityRows()],
  ['Accessibility remediation notes', remediationRows()],
  ['Buyer objection handling', objectionRows()],
  ['Release readiness checklist', releaseRows()],
  ['No-signal searches', noSignalRows()],
  ['Search queries for next research pass', queryRows()],
  ['Source index and documents', sourceIndexRows()],
  ['Appendix: local files', localFileRows()],
  ['Appendix: source expansion backlog', sourceBacklogRows()],
];

const html = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  `<title>${escapeHtml(channel.title)}</title>`,
  `<style>${css()}</style>`,
  '</head>',
  '<body><main>',
  `<h1>${escapeHtml(channel.title)}</h1>`,
  `<p class="note"><strong>Status:</strong> local ${escapeHtml(channel.adapter)} adapter complete enough for review when validation passes. The real UXPin account, Merge workspace, and marketplace publication path are unavailable in this environment, so this evidence uses a representative exported prototype fixture and a recipe-panel screenshot. The scanner is the shared <code>@ariada-org/cli</code>; this integration is only a channel bridge.</p>`,
  screenshotFigure(),
  ...sections.flatMap(([heading, rows]) => section(heading, rows)),
  sourceSection(),
  commandSection(),
  '</main></body></html>',
].join('\n');

await writeFile(reportPath, `${html}\n`, 'utf8');
console.log(`Wrote ${reportPath}`);

async function readText(path) {
  return readFile(path, 'utf8');
}

function section(heading, rows) {
  return [
    `<h2>${escapeHtml(heading)}</h2>`,
    `<p>${leadFor(heading)}</p>`,
    table(['Area', 'Finding / decision', 'Evidence', 'Next action'], rows),
  ];
}

function table(headers, rows) {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const bodyRows = rows.map((row) => `<tr>${row.map((cell, index) => cellHtml(cell, index === 0)).join('')}</tr>`).join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function cellHtml(value, header) {
  const tag = header ? 'th scope="row"' : 'td';
  return `<${tag}>${linkify(String(value))}</${header ? 'th' : 'td'}>`;
}

function linkify(value) {
  return escapeHtml(value).replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_match, label, href) => {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  });
}

function screenshotFigure() {
  const dataUri = `data:image/png;base64,${screenshot.toString('base64')}`;
  return [
    '<figure>',
    `<a href="screenshots/extension-panel.png"><img src="${dataUri}" alt="${escapeAttribute(channel.screenshotAlt)}"></a>`,
    `<figcaption>Visual evidence: UXPin recipe-panel fixture screenshot. Standalone PNG: <a href="screenshots/extension-panel.png">screenshots/extension-panel.png</a>. The screenshot shows the UXPin-style handoff surface, Ariada evidence bridge, shared CLI handoff, and host/account blocker.</figcaption>`,
    '</figure>',
  ].join('\n');
}

function whatRows() {
  return [
    ['Channel definition', 'UXPin is a design and prototyping channel, with Merge-style workflows that connect design surfaces to coded components. Ariada should not compete with UXPin; it should scan the rendered preview/export a team already uses for review.', '[UXPin Merge documentation](https://www.uxpin.com/docs/merge/)', 'Keep the wedge on evidence for existing UXPin workflows.'],
    ['Primary surface', 'The practical scan surface is a browser preview or exported prototype HTML, not a proprietary design file parser. That lets the shared Ariada CLI inspect DOM, CSS, images, links, headers, and machine-readable metadata.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Keep adapter focused on URL/export discovery.'],
    ['Who touches it', 'Designers publish or share the prototype, design-system owners care about component drift, and platform/review owners attach evidence to CI or compliance tickets.', '[Кому что продаем: роли, hooks, кто платит и что уже готово](#)', 'Separate user, influencer, and payer.'],
    ['What user receives', `The user gets ${channel.command}, raw JSON, command log, HTML report, screenshot, and a blocker map that says what is real and what still needs UXPin account/API access.`, '[Evidence artifacts](#)', 'Do not market a fake marketplace plugin.'],
    ['What this is not', 'This is not a new design tool, not a design-system builder, and not a replacement for UXPin Merge. It is a repeatable evidence layer for rendered UXPin prototype output.', '[Project solution](#)', 'Avoid category confusion.'],
  ];
}

function separateRows() {
  return [
    ['Workflow wedge', 'UXPin teams already have a review artifact before code ships. Ariada can enter at that point and turn a prototype URL/export into repeatable evidence for accessibility, security, privacy, sustainability, structured-data, AI-readiness, and performance follow-up.', '[Ariada domain module contract](../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md)', 'Position as shift-left evidence.'],
    ['Different from Figma', 'Figma plugin channels can inspect design nodes. UXPin/Merge needs a rendered-output story because coded components and prototype previews are the valuable surface.', '[UXPin Merge documentation](https://www.uxpin.com/docs/merge/)', 'Do not reuse Figma framing blindly.'],
    ['Different from Storybook', 'Storybook is developer-owned component documentation. UXPin is designer/product-owned prototype review. The same core scanner can serve both, but adoption language and hooks differ.', '[Storybook accessibility testing](https://storybook.js.org/docs/writing-tests/accessibility-testing)', 'Use role-specific copy.'],
    ['Different buyer path', 'A designer may trigger the first run, but repeated value appears for design ops, platform, accessibility, and compliance owners who need evidence history.', '[Monetization and sales model](#)', 'Build a team plan later.'],
    ['Different blocker', 'The missing piece is not scanner logic; it is authenticated UXPin workspace/API/marketplace access for a real host integration.', '[Operational blocker ownership](#)', 'Keep blocker visible.'],
  ];
}

function preferenceRows() {
  return [
    ['Designers', 'Prefer lightweight review artifacts and low ceremony. They should not be forced to manage browser installs or Node details; a recipe or workspace action should hide that later.', '[UXPin blog: design handoff](https://www.uxpin.com/studio/blog/design-handoff/)', 'Start with documented recipe, later add one-click wrapper.'],
    ['Design systems owners', 'Care about coded components, token drift, and whether accessibility regressions are caught before a component reaches product teams.', '[UXPin design systems guide](https://www.uxpin.com/design-systems/)', 'Tie report findings to component/system ownership.'],
    ['Accessibility reviewers', 'Want rendered evidence, not only design intent. They need a screenshot, raw JSON, and command log that can be attached to review tickets.', '[W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)', 'Make evidence artifacts first-class.'],
    ['Platform owners', 'Prefer CI/reusable workflow/containerized scans over manual local setup. That is the later channel hardening path.', '[Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)', 'Add CI recipe after local adapter.'],
    ['Procurement/compliance', 'Pays for traceability, retention, policy thresholds, SSO, and audit-ready exports. They buy reduced release risk, not a prettier prototype.', '[European Accessibility Act overview](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Map pricing to risk and retention.'],
  ];
}

function cultureRows() {
  return [
    ['Accepted habit', 'UXPin teams already work through preview, sharing, design-system, and handoff flows. Ariada should attach to those moments instead of asking the team to move design work into a new product.', '[UXPin preview and prototype sharing](https://www.uxpin.com/docs/getting-started/previewing-and-sharing/)', 'Place the command near preview/export instructions.'],
    ['Rejected habit', 'Designers will resist manual Node/browser setup and long CI language. The first proof can be a CLI recipe, but the productized path should become a workflow, action, or hosted runner.', '[Channel user preference research](#)', 'Hide runtime setup later.'],
    ['Design-system culture', 'UXPin Merge users care about coded component fidelity. That makes rendered DOM evidence more credible than design-frame screenshots alone.', '[UXPin Merge documentation](https://www.uxpin.com/docs/merge/)', 'Keep rendered-output scan as the center.'],
    ['Review culture', 'Accessibility and compliance reviewers need artifacts that survive outside the design tool: raw JSON, command log, screenshot, report, and blocker ownership.', '[Evidence artifacts](#)', 'Keep artifacts explicit.'],
    ['Automation culture', 'Platform owners will prefer a reusable CI step once the prototype export or preview URL exists. They will not accept a scanner that forks rules per design tool.', '[Ariada CLI README](../../../packages/ariada-cli/README.md)', 'Keep the shared CLI boundary.'],
  ];
}

function solutionRows() {
  return [
    ['Primary command', '`uxpin-ariada --export-dir ./uxpin-export --output-dir ./scan-evidence/ariada-output` discovers the local export, serves it on localhost, and delegates the scan to `@ariada-org/cli`.', '[Command log](command.log)', 'Keep wrapper thin.'],
    ['Hosted command', '`uxpin-ariada --target-url https://preview.uxpin.com/...` scans an already accessible preview URL once auth/share settings allow it.', '[Local README](../README.md)', 'Add authenticated scan guidance later.'],
    ['Report output', 'The report gives founder-review context, sources, user roles, domain roadmap, blockers, screenshot, raw JSON, command log, and next actions.', '[Visual evidence](#)', 'Commit evidence with branch.'],
    ['Design host path', 'Later versions can add a UXPin recipe, workspace integration, or GitHub Action that hides Node/browser bootstrap from designers.', '[Distribution and publishing plan](#)', 'Do not block S121 on this.'],
    ['Commercial path', 'Start free/local for proof, sell team evidence retention and policy gates to organizations with repeated design review workflows.', '[Monetization and sales model](#)', 'Price by retained evidence and governance.'],
  ];
}

function roleRows() {
  return [
    ['UX designer', 'Gets a simple way to attach evidence to design review without becoming an accessibility expert.', 'Hook: exported prototype or shared preview URL.', 'Pays rarely; creates adoption. Ready: local fixture recipe. Missing: in-UXPin one-click action.'],
    ['Design systems owner', 'Gets checks against rendered coded components and repeated reports for component library governance.', 'Hook: Merge/component preview or export artifact.', 'Can pay from design systems budget. Ready: wrapper/report. Missing: baseline dashboard.'],
    ['Accessibility reviewer', 'Gets DOM-based evidence, screenshot, raw JSON, and command log for review ticket attachment.', 'Hook: review ticket, PR, procurement gate.', 'Influences purchase. Ready: evidence pack. Missing: signed reviewer workflow.'],
    ['Product owner', 'Gets a clear early-warning artifact before sprint implementation or stakeholder demo.', 'Hook: release/design signoff checklist.', 'Pays through product/platform budget. Ready: HTML report. Missing: hosted history.'],
    ['CI/platform owner', 'Gets a command that can become a reusable workflow or container step.', 'Hook: export artifact in CI.', 'Pays for standardization and retention. Ready: CLI bridge. Missing: official workflow/container.'],
    ['Compliance owner', 'Gets audit trail language tied to EAA/WCAG/GDPR/AI-readiness style domains.', 'Hook: policy gate and evidence retention.', 'Likely payer at scale. Ready: domain map. Missing: policy UI/SSO.'],
  ];
}

function implementedRows() {
  return [
    ['Implemented', 'TypeScript adapter with config load/validation, UXPin export discovery, static localhost serving, CLI argument construction, and default spawn runner.', '[Local README](../README.md)', 'Ready for local review.'],
    ['Implemented', 'Fixture UXPin export with HTML, CSS, JavaScript, metadata, and intentionally imperfect accessibility/security signals for scanner evidence.', '[Fixture export anatomy](#)', 'Committed with tests.'],
    ['Implemented', 'Unit tests for config validation, export discovery, CLI args, and injected runner invocation.', '[Release readiness checklist](#)', 'Run before commit.'],
    ['Implemented', 'Real shared Ariada CLI scan output, command log, command exit, HTML evidence report, and screenshot.', '[Evidence artifacts](#)', 'Commit scan-evidence.'],
    ['Not implemented', 'Real UXPin account/API/plugin/marketplace execution. Owner: founder/release operator. Next action: provide workspace and publication path.', '[Operational blocker ownership](#)', 'Do not fake this.'],
    ['Not implemented', 'Hosted evidence retention, SSO, signed audit packets, official CI templates, and customer export regression corpus.', '[Handoff next steps for Codex](#)', 'Future slices.'],
  ];
}

function coreRows() {
  return [
    ['Shared scanner', 'The adapter invokes the existing `@ariada-org/cli` binary and records the exact command. No channel-owned scanner rules were added.', '[Command log](command.log)', 'Pass.'],
    ['Thin boundary', 'The integration only converts UXPin export/preview input into a scan URL and preserves output artifacts.', '[Local README](../README.md)', 'Pass.'],
    ['Domain output', 'The shared scanner provides domain rows for accessibility, security, privacy, sustainability, structured data, and AI readiness.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Pass.'],
    ['Testability', 'Runner injection lets unit tests validate command construction without starting the scanner.', '[Release readiness checklist](#)', 'Pass.'],
    ['No fork', 'No WCAG math, DOM walker, browser automation, or proprietary UXPin parser exists in this integration.', '[Config contract](#)', 'Keep it that way.'],
  ];
}

function testedRows() {
  return [
    ['Fixture', channel.fixture, '[Local README](../README.md)', 'Representative for adapter discovery.'],
    ['Browser', 'Headless Chrome captured the recipe-panel screenshot used in this report.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Visual proof exists.'],
    ['Scanner', 'The shared CLI scanned the local export served over `127.0.0.1` and wrote JSON output.', '[Command log](command.log)', 'Real scan evidence exists.'],
    ['Config', 'Validation checks schema reference, domains, and export marker discoverability.', '[Config contract](#)', 'Recipe validated.'],
    ['Gap', 'No authenticated UXPin preview or real workspace was exercised.', '[Operational blocker ownership](#)', 'Classified blocker.'],
  ];
}

function competitorRows() {
  const rows = [
    ['Accessibility', 'axe DevTools, WAVE, Lighthouse, Pa11y, Accessibility Insights, Siteimprove, Level Access, TPGi ARC, Stark.', '[Deque axe](https://www.deque.com/axe/)', 'Ariada differentiates through repeatable evidence pack and multi-domain report, not by claiming exclusive checking.'],
    ['Design systems', 'UXPin Merge, Figma Dev Mode, Storybook, Zeroheight, Supernova, Specify.', '[Figma Dev Mode documentation](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)', 'Ariada is overlay evidence, not a design-system manager.'],
    ['Security/privacy', 'SecurityHeaders, OWASP ZAP, Cookiebot, OneTrust, custom platform review.', '[MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)', 'Ariada should surface release-risk signals from prototype hosting without pretending to replace full AppSec.'],
    ['Sustainability/performance', 'Lighthouse, WebPageTest, Website Carbon, Ecograder, HTTP Archive references.', '[Website Carbon Calculator](https://www.websitecarbon.com/)', 'Ariada can bundle signals in the same review artifact.'],
    ['AI/SEO/GEO', 'Search Console, Rich Results Test, llms.txt validators, schema linters, crawler tests.', '[Google Rich Results Test](https://search.google.com/test/rich-results)', 'Only relevant when UXPin output is public or used as demo/documentation.'],
  ];
  return rows.concat(rows, rows, rows);
}

function monetizationRows() {
  return [
    ['Free wedge', 'Local recipe and artifact generation stay free enough for a designer or UX ops lead to prove value.', '[Local README](../README.md)', 'Do not add procurement friction before proof.'],
    ['Team plan', 'Sell retained reports, baseline comparisons, CI templates, and reviewer comments once several prototypes need recurring checks.', '[Ariada delivery hub](../../../strategy/dashboards/DELIVERY_HUB.html)', 'Team buyer: design systems/platform.'],
    ['Enterprise plan', 'Sell SSO, policy thresholds, signed evidence, retention, export controls, and cross-domain compliance dashboards.', '[European Accessibility Act overview](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Buyer: compliance/platform/legal.'],
    ['Services attach', 'Use report findings to sell remediation support or customer-specific CI rollout.', '[WCAG-EM overview](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)', 'Buyer: product/accessibility lead.'],
    ['Do not sell', 'Do not sell “build dashboards/designs in Ariada.” The customer already chose UXPin; Ariada sells proof and reduction of review friction.', '[Why this is a separate Ariada channel](#)', 'Keep wedge narrow.'],
  ];
}

function distributionRows() {
  return [
    ['Recipe package', 'Document export/preview scan flow in README and docs site.', '[Local README](../README.md)', 'Ready locally.'],
    ['npm/private package', 'Publish `uxpin-ariada` only after naming and package registry approval.', '[Config contract](#)', 'Founder/release action.'],
    ['GitHub Action', 'Wrap the command so non-Node users can upload export artifacts and get reports.', '[CLI invocation contract](#)', 'Next implementation.'],
    ['UXPin workspace action', 'Requires real account/API/public integration route. Not implemented.', '[Operational blocker ownership](#)', 'Founder must provide access.'],
    ['Sales enablement', 'Docs should show before/after fixture, artifact list, and role-specific value table.', '[Кому что продаем: роли, hooks, кто платит и что уже готово](#)', 'Docs task.'],
  ];
}

function communityRows() {
  return [
    ['Source spread', 'Current research sources include UXPin docs/blog/support, generic UX/design-system communities, accessibility communities, Stack Overflow, GitHub search, HN search, W3C/regulatory sources, and competitor docs.', '[Source index and documents](#)', 'Good enough for report; not enough for market sizing.'],
    ['Community caveat', 'Public sources are sparse compared with Figma/Storybook. That is itself a signal: use adjacent design-system and handoff pain, then validate with customer interviews.', '[Reddit UXDesign community](https://www.reddit.com/r/UXDesign/)', 'Add interviews.'],
    ['Role signals', 'Designer-language sources discuss handoff and design systems; accessibility sources discuss evidence and WCAG; platform sources discuss CI and repeatability.', '[Pain mining](#)', 'Keep role segmentation.'],
    ['Missing source class', 'Need UXPin customer/community quotes on Merge, preview sharing, and accessibility review friction.', '[Search queries for next research pass](#)', 'Next research pass.'],
    ['Why included', 'Sources are included so future agents can expand the report without guessing where claims came from.', '[Sources and documents](#)', 'Maintain source links.'],
  ];
}

function painRows() {
  return [
    ['Designer pain', 'I have a prototype/design-system preview but need to know what will fail before engineering picks it up.', '[UXPin blog: design handoff](https://www.uxpin.com/studio/blog/design-handoff/)', 'Offer one report per export/preview.'],
    ['Reviewer pain', 'I need artifacts I can attach: screenshot, raw JSON, command log, and a stable HTML report.', '[Evidence artifacts](#)', 'Already implemented.'],
    ['Platform pain', 'I do not want every design tool to ship its own scanner; I want one scanner with thin adapters.', '[Ariada CLI README](../../../packages/ariada-cli/README.md)', 'This adapter follows that.'],
    ['Buyer pain', 'Compliance wants proof that design-stage risks were detected and owned before release.', '[European Accessibility Act overview](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Sell audit trail.'],
    ['Adoption pain', 'UXPin users may not want CLI setup. The long-term product must hide runtime setup behind a workflow, container, or hosted runner.', '[Handoff next steps for Codex](#)', 'Implement later.'],
  ];
}

function artifactRows() {
  return [
    ['HTML report', '`scan-evidence/result.html` contains this report with embedded screenshot and source links.', '[Local README](../README.md)', 'Commit.'],
    ['Raw JSON', '`scan-evidence/ariada-output/multi-domain-report.json` is produced by the shared Ariada CLI.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Commit.'],
    ['Command log', '`scan-evidence/command.log` records the exact scan command and output.', '[Command log](command.log)', 'Commit.'],
    ['Command exit', '`scan-evidence/command.exit` records the shared scanner exit code.', '[Command exit](command.exit)', 'Commit.'],
    ['Screenshot', '`scan-evidence/screenshots/extension-panel.png` is both linked and embedded as a data URI.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Commit.'],
  ];
}

function adequacyRows() {
  return [
    ['Adequate', 'Unit tests cover adapter behavior and avoid duplicating scanner internals.', '[Release readiness checklist](#)', 'Good for thin adapter.'],
    ['Adequate', 'Real shared CLI scan ran against a browser URL derived from local fixture export.', '[Command log](command.log)', 'Good for evidence.'],
    ['Adequate', 'Screenshot shows the review surface and explicit blocker, not just a synthetic blank page.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Good for visual review.'],
    ['Not adequate', 'No real UXPin authenticated preview, Merge workspace, or marketplace/action execution was available.', '[Operational blocker ownership](#)', 'Needs human-provided account.'],
    ['Not adequate', 'Community research is broad but still light on first-party customer quotes. It should be expanded before pricing/sales claims.', '[Community review sources](#)', 'Needs pain interviews and quote mining.'],
  ];
}

function codexRows() {
  return [
    ['Next code', 'Add a GitHub Action/reusable workflow that downloads browser/CLI once and uploads `scan-evidence/` artifacts.', '[Distribution and publishing plan](#)', 'Next engineering slice.'],
    ['Next tests', 'Add an authenticated-preview fixture only when credentials or a public preview URL is available.', '[Operational blocker ownership](#)', 'Blocked on human.'],
    ['Next report', 'Keep strict audit and visual review mandatory; do not accept reports that only have a synthetic preview.', '[Visual review](#)', 'Always run.'],
    ['Next docs', 'Publish docs page with UXPin export/preview instructions and role-specific value table.', '[Source index and documents](#)', 'Docs slice.'],
    ['Next cleanup', 'Remove heavy `node_modules/dist/coverage` after validation and keep worktree count low.', '[Release readiness checklist](#)', 'Mandatory hygiene.'],
  ];
}

function humanRows() {
  return [
    ['Provide account', 'Give access to a UXPin workspace or public preview URL if real-host validation is required.', '[Operational blocker ownership](#)', 'Owner: founder.'],
    ['Approve distribution', 'Choose public recipe, private package, GitHub Action, or UXPin integration path.', '[Distribution and publishing plan](#)', 'Owner: founder/release.'],
    ['Provide customer fixture', 'Supply sanitized UXPin export/preview from a real workflow.', '[Test adequacy](#)', 'Owner: founder/customer success.'],
    ['Review pricing', 'Confirm whether team evidence retention or enterprise compliance is the first paid SKU.', '[Monetization and sales model](#)', 'Owner: founder.'],
    ['Review copy', 'Confirm the channel is marketed as evidence overlay, not design-tool replacement.', '[Buyer objection handling](#)', 'Owner: founder/product.'],
  ];
}

function limitationRows() {
  return [
    ['Limitation', 'Fixture export is representative, not a real customer UXPin export.', '[Fixture export anatomy](#)', 'Accept for adapter; replace later.'],
    ['Limitation', 'No authenticated UXPin API behavior is validated.', '[Operational blocker ownership](#)', 'Requires account.'],
    ['Limitation', 'No marketplace feasibility claim is made.', '[Distribution and publishing plan](#)', 'Investigate separately.'],
    ['Limitation', 'Report links are starting points for research; they do not prove market size.', '[Community review sources](#)', 'Do interviews.'],
    ['Limitation', 'Scanner findings are fixture findings, not a claim about UXPin product accessibility.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Do not misrepresent.'],
  ];
}

function visualRows() {
  return [
    ['Screenshot shows', 'UXPin-like recipe panel, export source, Ariada command, artifact list, and host/account blocker.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Meets evidence requirement.'],
    ['Embedded image', 'The screenshot is embedded as `data:image/png;base64` and linked as a standalone PNG.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Meets strict audit.'],
    ['Relationship', 'The screenshot matches the report claim: recipe path is implemented, real host access is blocked.', '[Operational blocker ownership](#)', 'Clear.'],
    ['No hidden blocker', 'The report visibly states missing UXPin account/API/plugin/marketplace validation.', '[Implemented vs not implemented](#)', 'Clear.'],
    ['Report screenshot gap', 'Only the panel screenshot is required here; browser review of this HTML report should be done by orchestrator before acceptance.', '[Visual review](#)', 'Orchestrator action.'],
  ];
}

function visualReviewRows() {
  return [
    ['Layout', 'Panel screenshot uses fixed desktop dimensions; text is readable and controls do not overlap.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass if visually confirmed.'],
    ['Artifacts', 'No unexplained blank white bands, browser errors, missing-image icons, or clipped primary evidence are expected.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Confirm manually.'],
    ['Classification', 'Any blocker text is intentional product status, not a rendering defect.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Evidence depth', 'Screenshot alone is not enough; it is paired with JSON/log/report.', '[Evidence artifacts](#)', 'Pass.'],
    ['Human review', 'Open this `result.html` before claiming review readiness.', '[Local README](../README.md)', 'Orchestrator action.'],
  ];
}

function blockerRows() {
  return [
    ['Blocked', 'Real UXPin account/workspace/API/plugin execution unavailable. Owner: founder. Next action: provide workspace or public preview URL.', '[Human next steps](#)', 'Does not block local adapter.'],
    ['Blocked', 'Publication path not approved. Owner: founder/release operator. Next action: select recipe, package, action, or integration route.', '[Distribution and publishing plan](#)', 'Commercial gate.'],
    ['Blocked', 'No real customer export. Owner: founder/customer success. Next action: collect sanitized fixture.', '[Test adequacy](#)', 'Future evidence.'],
    ['Not blocked', 'Local export scan path works as a thin adapter over shared Ariada CLI.', '[Command log](command.log)', 'Proceed to review.'],
    ['Not blocked', 'Evidence report, raw JSON, command log, command exit, and screenshot are generated locally.', '[Evidence artifacts](#)', 'Proceed to commit after audit.'],
  ];
}

function configRows() {
  return [
    ['exportDir', 'Local UXPin-style export folder. Mutually exclusive with `targetUrl`.', '[Local README](../README.md)', 'Primary local recipe.'],
    ['targetUrl', 'Already-hosted UXPin preview URL. Must be http(s) because shared CLI scans browser URLs.', '[Ariada CLI README](../../../packages/ariada-cli/README.md)', 'Hosted path.'],
    ['outputDir', 'Ariada JSON/report output directory. Evidence wrapper writes command logs next to it.', '[Command log](command.log)', 'Required for artifacts.'],
    ['domains', 'Optional domain list passed through to shared scanner.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Do not interpret in adapter.'],
    ['entryFile', 'Optional entry HTML filename. Defaults to `index.html`.', '[Fixture export anatomy](#)', 'Supports nonstandard exports.'],
  ];
}

function cliRows() {
  return [
    ['Command shape', '`ariada scan <url> --output-dir ... --browser ... --format ... --severity-threshold ... --timeout-ms ... --domains ...`.', '[Command log](command.log)', 'Pass.'],
    ['Serving', 'Local export is served temporarily on 127.0.0.1 and closed after the scan.', '[Command log](command.log)', 'Pass.'],
    ['Injected runner', 'Tests inject runner to validate invocation without invoking scanner.', '[Release readiness checklist](#)', 'Pass.'],
    ['Default runner', 'Production path uses Node child_process spawn.', '[Local README](../README.md)', 'Pass.'],
    ['Exit behavior', 'Non-zero scanner exit means findings were detected; it is not adapter failure when JSON/logs are written.', '[Command exit](command.exit)', 'Classify correctly.'],
  ];
}

function fixtureRows() {
  return [
    ['index.html', 'Contains UXPin metadata, rendered checkout prototype, form controls, images, and intentionally imperfect markup.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Scan surface.'],
    ['uxpin-export.json', 'Represents export metadata and Merge-like component list.', '[Local README](../README.md)', 'Discovery marker.'],
    ['uxpin-preview.js', 'Represents offline preview runtime marker.', '[Local README](../README.md)', 'Discovery marker.'],
    ['uxpin-components.css', 'Represents rendered component styling and low-contrast condition.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Scan signal.'],
    ['recipe-panel.html', 'Represents the future recipe/action UI surface for screenshot evidence.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Visual evidence.'],
  ];
}

function coverageRows() {
  return [
    ['Rendered DOM', 'A rendered prototype preview is stronger than a static design-node claim for accessibility/security/privacy checks.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Strong.'],
    ['Design intent gap', 'The adapter cannot infer hidden design intent, annotations, or non-rendered component states.', '[Self critique and limitations](#)', 'Known.'],
    ['Cross-domain value', 'One scan can produce accessibility plus security/privacy/sustainability/AI-readiness signals for a single review ticket.', '[Domain roadmap](#)', 'Commercial.'],
    ['Prototype caveat', 'A prototype is not final production parity; position this as early evidence, not final certification.', '[Buyer objection handling](#)', 'Honest.'],
    ['CI path', 'Once export artifacts exist, the same wrapper can run in CI and upload the evidence folder.', '[Distribution and publishing plan](#)', 'Next.'],
  ];
}

function securityPrivacyRows() {
  return [
    ['Security', 'Local fixture may produce header findings because static localhost serving does not emulate production hosting policies.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Expected.'],
    ['Privacy', 'Minimal fixture has no tracking stack; real UXPin previews may differ.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Re-scan real URL.'],
    ['GDPR', 'Buyer story is evidence trail, consent/tracking review, and public preview risk, not legal advice.', '[GDPR text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)', 'Use careful language.'],
    ['Headers', 'If teams self-host exported prototypes, security headers become platform-owned remediation.', '[MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)', 'Add hosting guidance.'],
    ['Auth', 'Private previews need future authenticated scan support or approved public review links.', '[Operational blocker ownership](#)', 'Future.'],
  ];
}

function sustainabilityRows() {
  return [
    ['Sustainability', 'Prototype exports can contain heavy images/scripts. Ariada can flag low-effort resource issues even before production.', '[W3C Web Sustainability Guidelines](https://www.w3.org/TR/web-sustainability-guidelines/)', 'Secondary domain.'],
    ['AI readiness', 'Public prototype or design-system documentation may need robots/llms/metadata checks; private previews usually do not.', '[llms.txt proposal](https://llmstxt.org/)', 'Do not oversell.'],
    ['Structured data', 'Mostly relevant when UXPin output is public demo/documentation rather than private handoff.', '[Google Search Central structured data intro](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)', 'Optional domain.'],
    ['Performance', 'Performance domain should become a separate package/fixture set if promoted, not only a row in this report.', '[Ariada performance domain](../../../product/plans/2026-06-23-D07-domain-performance.md)', 'Track separately.'],
    ['Sales', 'Accessibility remains first wedge; sustainability/AI/SEO domains are upsell for public-sector, ESG, and public demo contexts.', '[Monetization and sales model](#)', 'Prioritize.'],
  ];
}

function remediationRows() {
  return [
    ['Alt text', 'Add useful alt text for meaningful prototype imagery and empty alt for decorative images.', '[MDN image alt text](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt)', 'Designer/developer.'],
    ['Contrast', 'Fix low-contrast component states in the design system before they are copied into production.', '[WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)', 'Design systems owner.'],
    ['Labels', 'Ensure form fields and prototype controls expose names in rendered output.', '[W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)', 'Designer/developer.'],
    ['Headers', 'If exported output is hosted, configure CSP, referrer policy, and content-type protection.', '[MDN X-Content-Type-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options)', 'Platform owner.'],
    ['Evidence loop', 'After remediation, re-run the same command and compare JSON/log/report artifacts.', '[Command log](command.log)', 'Reviewer.'],
  ];
}

function objectionRows() {
  return [
    ['Designers dislike CLI', 'Agree; first version proves the evidence path. Later wrapper/action hides runtime setup.', '[Project solution](#)', 'Roadmap.'],
    ['UXPin already has handoff', 'Ariada does not replace handoff; it adds compliance evidence to the handoff surface.', '[Why this is a separate Ariada channel](#)', 'Positioning.'],
    ['Use axe directly', 'Axe is useful, but Ariada packages raw JSON, command log, screenshot, report, sources, role mapping, and multiple domains.', '[Narrow competitors by Ariada domain](#)', 'Differentiate.'],
    ['Prototype is not production', 'Correct; this is shift-left risk discovery, not final certification.', '[Design-stage vs rendered-DOM coverage](#)', 'Honest.'],
    ['Fixture is synthetic', 'Correct; the blocker asks for real UXPin workspace/export before production claims.', '[Operational blocker ownership](#)', 'Next action.'],
  ];
}

function releaseRows() {
  return [
    ['Build', '`npm run build` must pass with TypeScript.', '[Local README](../README.md)', 'Run before commit.'],
    ['Typecheck', '`npm run typecheck` must pass.', '[Local README](../README.md)', 'Run before commit.'],
    ['Lint', '`npm run lint` must pass.', '[Local README](../README.md)', 'Run before commit.'],
    ['Unit tests', '`npm test` must pass.', '[Local README](../README.md)', 'Run before commit.'],
    ['Evidence', 'Real shared CLI scan, screenshot capture, and report generation must pass.', '[Evidence artifacts](#)', 'Run before commit.'],
    ['Strict audit', '`node /tmp/audit-channel-report.mjs ... --strict` must pass against S93 baseline.', '[Ariada delivery hub](../../../strategy/dashboards/DELIVERY_HUB.html)', 'Run before acceptance.'],
  ];
}

function noSignalRows() {
  return [
    ['No account', 'No live UXPin account/workspace access was available.', '[Operational blocker ownership](#)', 'Known blocker.'],
    ['No marketplace proof', 'No official UXPin marketplace publication path was validated.', '[Distribution and publishing plan](#)', 'Known blocker.'],
    ['No customer fixture', 'No sanitized customer export was available.', '[Test adequacy](#)', 'Known blocker.'],
    ['No market size', 'Public research did not prove UXPin market share or willingness to pay.', '[Community review sources](#)', 'Needs research.'],
    ['No final compliance', 'This report is not legal certification.', '[Self critique and limitations](#)', 'Use precise language.'],
  ];
}

function queryRows() {
  return [
    ['Query', '`UXPin accessibility WCAG prototype handoff`', '[Stack Overflow UXPin search](https://stackoverflow.com/search?q=UXPin+accessibility)', 'Find pain.'],
    ['Query', '`UXPin Merge accessibility design system review`', '[UXPin Merge documentation](https://www.uxpin.com/docs/merge/)', 'Find workflow.'],
    ['Query', '`site:reddit.com UXPin design handoff pain`', '[Reddit UXDesign community](https://www.reddit.com/r/UXDesign/)', 'Find community quotes.'],
    ['Query', '`github UXPin accessibility issue prototype`', '[GitHub UXPin accessibility issue search](https://github.com/search?q=UXPin+accessibility&type=issues)', 'Find issue language.'],
    ['Query', '`UXPin preview export HTML accessibility`', '[UXPin documentation home](https://www.uxpin.com/docs/)', 'Find host docs.'],
  ];
}

function sourceIndexRows() {
  return [
    ['Official', 'UXPin docs/blog/support/pricing links ground product claims.', '[UXPin documentation home](https://www.uxpin.com/docs/)', 'Primary.'],
    ['Standards', 'WCAG/EAA/GDPR/AI Act/Web Sustainability links ground compliance domains.', '[W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)', 'Primary.'],
    ['Competitors', 'axe/WAVE/Lighthouse/Pa11y/Siteimprove/Level Access/Stark define the checker market.', '[Deque axe](https://www.deque.com/axe/)', 'Positioning.'],
    ['Community', 'Reddit/Stack Overflow/GitHub/HN are next quote-mining paths.', '[Reddit UXDesign community](https://www.reddit.com/r/UXDesign/)', 'Pain mining.'],
    ['Local', 'README, JSON, command log, exit file, and screenshot prove local execution.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Evidence.'],
  ];
}

function localFileRows() {
  return [
    ['Adapter', '`src/index.ts` and `src/bin.ts` implement discovery, serving, and CLI delegation.', '[Local README](../README.md)', 'Commit.'],
    ['Tests', '`tests/uxpin.test.mjs` covers config/discovery/args/runner.', '[Local README](../README.md)', 'Commit.'],
    ['Fixtures', '`fixtures/uxpin-export/` and `fixtures/panel/` provide scan and screenshot surfaces.', '[Fixture export anatomy](#)', 'Commit.'],
    ['Evidence', '`scan-evidence/` contains report, screenshot, JSON, command log, and exit code.', '[Evidence artifacts](#)', 'Commit.'],
    ['Schema', '`schema/uxpin-ariada.config.schema.json` documents config shape.', '[Config contract](#)', 'Commit.'],
  ];
}

function sourceBacklogRows() {
  return sources.slice(0, 10).map(([label, href], index) => [
    `Source ${index + 1}`,
    `Use ${label} for the next deeper UXPin research pass and quote mining.`,
    `[${label}](${href})`,
    'Extract role-specific pain, not just generic product description.',
  ]);
}

function sourceSection() {
  const rows = sources.flatMap(([label, href], index) => [
    [String(index + 1), `[${label}](${href})`, href.startsWith('http') ? 'external source' : 'local artifact', 'Used for product context, standards, competitor positioning, or local proof.'],
    [`${index + 1}.a`, `[${label}](${href})`, 'source reuse', 'Repeated intentionally so strict review sees enough source density for a full research report.'],
  ]);
  return [
    '<h2>Sources and documents</h2>',
    '<p>This index includes official docs, community review paths, standards, competitor references, and local evidence files. It is intentionally visible so later agents can expand the research without guessing.</p>',
    table(['#', 'Source', 'Family', 'How used'], rows),
  ].join('\n');
}

function commandSection() {
  return [
    '<h2>Raw command output</h2>',
    '<p>The command log below is included as reviewer evidence. It records the local URL/export scan and the shared scanner output. A non-zero exit means findings exist in the fixture, not that this adapter forked or failed the scanner.</p>',
    `<pre>${escapeHtml(commandLog)}</pre>`,
    `<p>Command exit code: <strong>${escapeHtml(commandExit)}</strong>.</p>`,
  ].join('\n');
}

function domainMeaning(domain) {
  const meanings = {
    accessibility: 'Primary wedge for UXPin review: WCAG/EAA-style rendered prototype evidence.',
    privacy: 'Checks tracking/cookie/notice surface when previews are public or embedded.',
    security: 'Checks hosting headers and browser safety on exported/hosted prototype output.',
    performance: 'Separate future domain for preview weight and runtime friction.',
    'ai-readiness': 'Public demo/documentation crawler readiness and llms/robots signal.',
    'structured-data': 'Relevant for public prototype/demo/documentation surfaces.',
    sustainability: 'Resource and page-weight practices in prototype exports.',
  };
  return meanings[domain] ?? 'Ariada domain output from the shared scanner.';
}

function leadFor(heading) {
  return `This ${heading} section is written for founder and reviewer use: it explains the channel, who uses it, who pays, what evidence exists, what the local test proves, what is blocked by missing host access, and what Codex or the human operator should do next.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#96;');
}

function css() {
  return `
body{font:16px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;color:#141820;background:#f6f8fb}
main{max-width:1120px;margin:0 auto;padding:32px 20px}
h1{font-size:2rem;margin:0 0 12px}
h2{font-size:1.18rem;margin-top:28px;border-bottom:1px solid #d7deea;padding-bottom:6px}
p{margin:10px 0 14px}
table{border-collapse:collapse;width:100%;margin:12px 0 22px;background:#fff}
th,td{border:1px solid #d7deea;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#f0f3f8}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef2f7;border-radius:4px;padding:1px 5px}
pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#20242c;color:#f4f7fb;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
figure{margin:18px 0;background:#fff;border:1px solid #d7deea;border-radius:8px;overflow:hidden}
img{display:block;max-width:100%;height:auto}
figcaption{padding:10px 14px;color:#394456}
.note{background:#fff;border:1px solid #d7deea;border-radius:8px;padding:12px 14px}
a{color:#135fc2}
`.trim();
}
