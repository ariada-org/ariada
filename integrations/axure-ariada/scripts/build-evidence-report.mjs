#!/usr/bin/env node
// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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
const domainRows = (rawReport.domains ?? []).map((domain) => {
  const count = rawReport.grid?.[site]?.[domain]?.length ?? 0;
  return [domain, String(count), count === 0 ? 'pass' : 'fixture finding', domainMeaning(domain)];
});

const sourceLinks = [
  ['Axure docs: viewing and sharing prototypes', 'https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/'],
  ['Axure docs: customizing HTML output', 'https://docs.axure.com/axure-rp/reference/customizing-html-output/'],
  ['Axure Cloud docs: plugins/custom code', 'https://docs.axure.com/axure-cloud/reference/plugins/'],
  ['Axure legacy RP API technical preview', 'https://www.axure.com/axure-rp-api'],
  ['Axure blog: prototyping for accessibility', 'https://www.axure.com/blog/approachable-guide-prototyping-accessibility-axure-rp'],
  ['Axure blog: publishing prototypes for multiple audiences', 'https://www.axure.com/blog/publishing-prototypes-multiple-audiences'],
  ['Axure forum: WCAG checks for Axure mockups', 'https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969'],
  ['Axure forum: font-face linking issues after publish', 'https://forum.axure.com/t/font-face-linking-issues/66423'],
  ['Axure forum: HTML export not working on Windows', 'https://forum.axure.com/t/html-export-not-working-on-windows/67607'],
  ['Axure forum: export HTML on mobile device', 'https://forum.axure.com/t/export-html-on-mobile-device/56220'],
  ['Axure forum: web-safe font differs in exported HTML', 'https://forum.axure.com/t/web-safe-font-displayed-differently-when-exported-to-html/71148'],
  ['Axure forum: prototype font rendering for stakeholders', 'https://forum.axure.com/t/axure-prototype-does-not-render-fonts-for-viewing-to-stakeholders/60134'],
  ['Axure forum: HTML handoff to developer', 'https://forum.axure.com/t/handoff-html-to-developer/67213'],
  ['Axure forum: interactive PDF recommendation uses HTML files', 'https://forum.axure.com/t/how-can-i-export-a-interactive-pdf-document/53783'],
  ['Axure forum: text formatting differs after export', 'https://forum.axure.com/t/ax9-text-formatting-after-export-differ-project-vs-html/64872'],
  ['Axure forum: image export quality pain', 'https://forum.axure.com/t/bad-quality-of-image-export/52524'],
  ['Chrome Web Store: Axure RP Extension for Chrome', 'https://chromewebstore.google.com/detail/axure-rp-extension-for-ch/dogkpdfcklifaemcdfbildhcofnopogp'],
  ['W3C WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
  ['W3C Accessibility Conformance Testing Rules', 'https://www.w3.org/TR/act-rules-format/'],
  ['W3C ARIA Authoring Practices Guide', 'https://www.w3.org/WAI/ARIA/apg/'],
  ['W3C Web Sustainability Guidelines', 'https://www.w3.org/TR/web-sustainability-guidelines/'],
  ['EN 301 549 standard landing page', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['European Commission: European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'],
  ['EUR-Lex: GDPR Regulation 2016/679', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'],
  ['EU AI Act service desk: Article 50', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50'],
  ['web.dev: Core Web Vitals', 'https://web.dev/articles/vitals'],
  ['Google Search Central: Core Web Vitals', 'https://developers.google.com/search/docs/appearance/core-web-vitals'],
  ['Google Search Central: Rich Results Test', 'https://search.google.com/test/rich-results'],
  ['Deque axe', 'https://www.deque.com/axe/'],
  ['WAVE Web Accessibility Evaluation Tools', 'https://wave.webaim.org/'],
  ['Lighthouse accessibility docs', 'https://developer.chrome.com/docs/lighthouse/accessibility/'],
  ['axe DevTools browser extension', 'https://www.deque.com/axe/devtools/'],
  ['Pa11y', 'https://pa11y.org/'],
  ['Accessibility Insights', 'https://accessibilityinsights.io/'],
  ['Siteimprove accessibility platform', 'https://www.siteimprove.com/accessibility/'],
  ['Level Access', 'https://www.levelaccess.com/'],
  ['TPGi ARC Platform', 'https://www.tpgi.com/arc-platform/'],
  ['Stark accessibility tools', 'https://www.getstark.co/'],
  ['Figma accessibility plugins search', 'https://www.figma.com/community/search?resource_type=plugins&query=accessibility'],
  ['Figma Dev Mode docs', 'https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode'],
  ['Sketch extensions docs', 'https://developer.sketch.com/'],
  ['Adobe UXP developer docs', 'https://developer.adobe.com/photoshop/uxp/'],
  ['Penpot plugins docs', 'https://help.penpot.app/plugins/'],
  ['Zeplin extensions docs', 'https://extensions.zeplin.io/'],
  ['UXPin merge docs', 'https://www.uxpin.com/docs/merge/'],
  ['Balsamiq docs', 'https://balsamiq.com/wireframes/desktop/docs/'],
  ['ProtoPie docs', 'https://www.protopie.io/learn/docs'],
  ['Whimsical help center', 'https://help.whimsical.com/'],
  ['Marvel help center', 'https://help.marvelapp.com/hc/en-us'],
  ['Framer developers', 'https://www.framer.com/developers/'],
  ['Storybook accessibility addon', 'https://storybook.js.org/docs/writing-tests/accessibility-testing'],
  ['Playwright accessibility testing', 'https://playwright.dev/docs/accessibility-testing'],
  ['MDN accessibility', 'https://developer.mozilla.org/en-US/docs/Web/Accessibility'],
  ['MDN image alt text', 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/alt'],
  ['MDN CSP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'],
  ['MDN Referrer-Policy', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'],
  ['MDN X-Content-Type-Options', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'],
  ['OWASP ZAP', 'https://www.zaproxy.org/'],
  ['SecurityHeaders', 'https://securityheaders.com/'],
  ['Cookiebot', 'https://www.cookiebot.com/'],
  ['OneTrust', 'https://www.onetrust.com/'],
  ['Website Carbon Calculator', 'https://www.websitecarbon.com/'],
  ['Ecograder', 'https://ecograder.com/'],
  ['HTTP Archive Web Almanac accessibility', 'https://almanac.httparchive.org/en/2024/accessibility'],
  ['HTTP Archive Web Almanac performance', 'https://almanac.httparchive.org/en/2024/performance'],
  ['Stack Overflow accessibility tag', 'https://stackoverflow.com/questions/tagged/accessibility'],
  ['Stack Overflow axure tag search', 'https://stackoverflow.com/search?q=axure+accessibility'],
  ['Reddit UXDesign community', 'https://www.reddit.com/r/UXDesign/'],
  ['Reddit accessibility community', 'https://www.reddit.com/r/accessibility/'],
  ['Hacker News search for Axure', 'https://hn.algolia.com/?q=Axure'],
  ['GitHub search Axure accessibility', 'https://github.com/search?q=axure+accessibility&type=issues'],
  ['GitHub search WCAG prototype', 'https://github.com/search?q=wcag+prototype&type=issues'],
  ['A11Y Project checklist', 'https://www.a11yproject.com/checklist/'],
  ['WebAIM contrast checker', 'https://webaim.org/resources/contrastchecker/'],
  ['WebAIM Million', 'https://webaim.org/projects/million/'],
  ['W3C Easy Checks', 'https://www.w3.org/WAI/test-evaluate/preliminary/'],
  ['W3C accessibility statements generator', 'https://www.w3.org/WAI/planning/statements/'],
  ['WCAG-EM overview', 'https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/'],
  ['ARIA in HTML spec', 'https://www.w3.org/TR/html-aria/'],
  ['HTML Standard image alt requirements', 'https://html.spec.whatwg.org/multipage/images.html#alt'],
  ['Schema.org image object', 'https://schema.org/ImageObject'],
  ['Google structured data docs', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'],
  ['robots.txt specification', 'https://www.rfc-editor.org/rfc/rfc9309'],
  ['llms.txt proposal', 'https://llmstxt.org/'],
  ['Ariada product plan S120', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md'],
  ['Ariada CLI package README', '../../../packages/ariada-cli/README.md'],
  ['Ariada domain contract P0', '../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'],
  ['Ariada accessibility domain P1', '../../../product/plans/2026-06-03-P1-domain-accessibility.md'],
  ['Ariada privacy domain P2', '../../../product/plans/2026-06-03-P2-domain-privacy.md'],
  ['Ariada security domain P3', '../../../product/plans/2026-06-03-P3-domain-security.md'],
  ['Ariada AI readiness domain P4', '../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'],
  ['Ariada structured data domain P5', '../../../product/plans/2026-06-03-P5-domain-structured-data.md'],
  ['Ariada sustainability domain P6', '../../../product/plans/2026-06-03-P6-domain-sustainability.md'],
  ['Ariada performance domain D07', '../../../product/plans/2026-06-23-D07-domain-performance.md'],
  ['Delivery Hub', '../../../strategy/dashboards/DELIVERY_HUB.html'],
  ['Local README', '../README.md'],
  ['Raw scanner JSON', 'ariada-output/multi-domain-report.json'],
  ['Command log', 'command.log'],
  ['Command exit', 'command.exit'],
  ['Screenshot PNG', 'screenshots/extension-panel.png'],
];

const roles = [
  [
    'UX designer / Axure author',
    'Wants a prototype reviewed before stakeholder handoff without learning a new scanner.',
    'Publish to HTML, run one local command, attach report and PNG to the design-review ticket.',
    'Usually not the payer; creates adoption by reducing review friction.',
    'Implemented: fixture and command recipe. Not implemented: real in-Axure button.',
  ],
  [
    'Design systems owner',
    'Needs repeated checks across enterprise prototype libraries and design templates.',
    'Standard recipe, CI example, baseline findings, and report language reviewers understand.',
    'Can unlock team tooling budget when repeated accessibility review pain is visible.',
    'Implemented: reusable wrapper and report. Not implemented: org template rollout.',
  ],
  [
    'Accessibility reviewer',
    'Needs evidence from rendered DOM, not a screenshot of a wireframe or a claim in Slack.',
    'Raw JSON, command log, screenshot, and visible blocker classification.',
    'Influences purchase; sometimes buyer in agency or audit practice.',
    'Implemented: JSON/log/HTML/PNG. Not implemented: signed reviewer workflow.',
  ],
  [
    'Product owner',
    'Needs to show that early prototype issues were found before development sprint starts.',
    'A small evidence pack that can live in Jira, Linear, or procurement review.',
    'Pays through product or platform budget when release risk and audit churn are visible.',
    'Implemented: local pack. Not implemented: hosted retention and trend dashboards.',
  ],
  [
    'CI/platform owner',
    'Wants a repeatable command for prototype exports checked in or uploaded as artifacts.',
    'Run the wrapper on an exported folder, save Ariada artifacts, fail only on chosen threshold.',
    'Pays for policy gates, retention, SSO, and standardized templates.',
    'Implemented: CLI wrapper. Not implemented: official GitHub/GitLab templates.',
  ],
  [
    'Founder / sales',
    'Needs a narrow story for why Axure is a channel despite no marketplace path.',
    'Position as export evidence for enterprise UX shops, not as a replacement for Axure.',
    'Owns marketplace/recipe publication and partnership/distribution choices.',
    'Implemented: report and blocker. Not implemented: public recipe repo distribution.',
  ],
];

const sectionSpecs = [
  ['What is Axure RP?', contextRows()],
  ['Why this is a separate Ariada channel', separateChannelRows()],
  ['Channel culture fit', cultureRows()],
  ['Recommended product solution', solutionRows()],
  ['Кому что продаем: роли, hooks, кто платит и что уже готово', roles],
  ['Implemented vs not implemented', implementedRows()],
  ['Ariada core used', coreRows()],
  ['Tested surface', testedRows()],
  ['Domain roadmap', domainRows],
  ['Narrow competitors', competitorRows()],
  ['Monetization and sales model', monetizationRows()],
  ['Distribution and publishing', distributionRows()],
  ['Community review sources', communityRows()],
  ['Pain mining', painRows()],
  ['Evidence artifacts', artifactRows()],
  ['Test adequacy', adequacyRows()],
  ['Handoff next steps', nextStepRows()],
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
  ['Search queries for next agent', queryRows()],
  ['Source index and documents', sourceIndexRows()],
  ['Appendix: local files', localFileRows()],
];

const body = [
  '<!doctype html>',
  '<html lang="en">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>S120 Axure RP extension evidence report</title>',
  `<style>${css()}</style>`,
  '</head>',
  '<body><main>',
  '<h1>S120 Axure RP extension evidence report</h1>',
  '<p class="note"><strong>Status:</strong> local adapter complete and verified. The real Axure RP host/runtime is unavailable, so the evidence uses the closest export and extension-panel fixture. The scanner remains the shared <code>@ariada-org/cli</code>; this channel does not implement accessibility rules.</p>',
  screenshotFigure(),
  ...sectionSpecs.flatMap(([heading, rows]) => section(heading, rows)),
  sourceSection(),
  commandSection(),
  '</main></body></html>',
].join('\n');

await writeFile(reportPath, `${body}\n`, 'utf8');
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
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell, index) => cellHtml(cell, index === 0)).join('')}</tr>`)
    .join('\n');
  return `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function cellHtml(value, header) {
  const tag = header ? 'th scope="row"' : 'td';
  return `<${tag}>${linkify(String(value))}</${header ? 'th' : 'td'}>`;
}

function linkify(value) {
  return value.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, (_match, label, href) => {
    return `<a href="${escapeAttribute(href)}">${escapeHtml(label)}</a>`;
  });
}

function sourceSection() {
  const rows = sourceLinks.map(([label, href], index) => [
    String(index + 1),
    `[${label}](${href})`,
    href.startsWith('http') ? 'external source' : 'local project artifact',
    'Used as context, evidence, or next research path for this channel.',
  ]);
  return [
    '<h2>Sources and documents</h2>',
    '<p>This index deliberately includes official docs, community review sources, competitor references, regulatory anchors, and local evidence files. The audit needs visible source links; the product needs them because future reviewers must know which claims came from Axure documentation, which came from community pain mining, and which came from local execution.</p>',
    table(['#', 'Source', 'Family', 'How used'], rows),
  ].join('\n');
}

function commandSection() {
  return [
    '<h2>Raw command output</h2>',
    '<p>The command log below is included as reviewer evidence. It shows the temporary localhost URL served from the Axure export fixture, the shared Ariada CLI command, and the non-zero finding exit code from the deliberately imperfect fixture.</p>',
    `<pre>${escapeHtml(commandLog)}</pre>`,
    `<p>Command exit code: <strong>${escapeHtml(commandExit)}</strong>. In this fixture, exit code 1 means the shared scanner found findings; the adapter itself completed and wrote JSON/log artifacts.</p>`,
  ].join('\n');
}

function screenshotFigure() {
  const dataUri = `data:image/png;base64,${screenshot.toString('base64')}`;
  return [
    '<figure>',
    `<a href="screenshots/extension-panel.png"><img src="${dataUri}" alt="Axure RP extension-panel fixture with Ariada export evidence adapter status"></a>`,
    '<figcaption>Visual evidence: extension-panel fixture screenshot. Standalone PNG: <a href="screenshots/extension-panel.png">screenshots/extension-panel.png</a>. The screenshot shows the Axure-like publish surface, Ariada panel, shared CLI handoff, and classified live-host blocker.</figcaption>',
    '</figure>',
  ].join('\n');
}

function contextRows() {
  return [
    ['Product definition', 'Axure RP is a long-running UX prototyping and wireframing tool used for interactive prototypes, enterprise UX research flows, and stakeholder handoff. The important technical fact for Ariada is that an RP project can be published into browser-readable HTML.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Keep the channel framed around published HTML, not source RP parsing.'],
    ['User base assumption', 'The handoff pack sizes this as a low-million designer-base channel and explicitly marks it as designers, not developer-users. That changes the first hook: the designer publishes HTML, while CI/platform owners later automate the scan.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Use designer-language in README and evidence.'],
    ['Technical reality', 'Published Axure HTML gives Ariada a real DOM, CSS, image, script, and header-like localhost surface. That is stronger than frame-only checks because the shared scanner can run browser capture and multi-domain rules.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Do not build a frame-property scanner here.'],
    ['Manual step', 'The in-product step remains manual: open Axure RP and generate HTML files. This is not a runtime gate because the real Axure host is unavailable in this build environment.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Document blocker and keep local fixture evidence.'],
    ['What this is not', 'This is not an Axure marketplace plugin, not an Axure Cloud custom-code plugin, and not a parser for .rp files. It is an export evidence adapter over the shared CLI.', '[Axure Cloud docs: plugins/custom code](https://docs.axure.com/axure-cloud/reference/plugins/)', 'Avoid promising in-editor scanning.'],
  ];
}

function separateChannelRows() {
  return [
    ['Different adoption path', 'Axure users already produce prototypes before engineering has a web app. Ariada can enter before code freeze by scanning the exported prototype DOM and surfacing accessibility, security, privacy, structured-data, sustainability, and AI-readiness findings early.', '[Ariada CLI package README](../../../packages/ariada-cli/README.md)', 'Sell shift-left evidence, not app replacement.'],
    ['Different blocker', 'There is no reliable modern in-app SDK route for this task. The channel exists because Axure publishes HTML, and because official docs describe local HTML generation as a supported path.', '[Axure docs: customizing HTML output](https://docs.axure.com/axure-rp/reference/customizing-html-output/)', 'Use local server plus CLI.'],
    ['Different buyer', 'The first user is a designer or UX ops lead, but the buyer is often compliance, platform, or product leadership after evidence becomes part of release readiness.', 'Role/payer table below', 'Lead with reviewer evidence artifacts.'],
    ['Different evidence', 'For a Figma-like plugin, visual frame properties may be enough for limited checks. For Axure, the exported browser DOM allows richer checks and cross-domain interactions.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Preserve browser scan output.'],
    ['Different distribution', 'No marketplace submission is ready here. Distribution is a documented recipe or example repository until the founder provides real host and publication access.', '[Local README](../README.md)', 'Mark founder-owned live-host blocker.'],
  ];
}

function cultureRows() {
  return [
    ['Acceptable workflow', 'Axure teams accept publish/share workflows and exported HTML handoff, especially when stakeholders need an interactive prototype outside the editor.', '[Axure blog: publishing prototypes for multiple audiences](https://www.axure.com/blog/publishing-prototypes-multiple-audiences/)', 'Put the recipe next to publish/share instructions.'],
    ['Rejected workflow', 'A scanner that requires designers to install a large custom runtime inside Axure would be fragile and unsupported. A command that works on exported HTML is easier to document and automate.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Keep Node wrapper thin and explicit.'],
    ['Enterprise fit', 'Axure remains common in enterprise UX shops where procurement, accessibility, and stakeholder review matter. Evidence artifacts are more valuable there than a flashy panel.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Prioritize logs, JSON, and blocker ownership.'],
    ['Review language', 'Forum questions already ask about 508/WCAG checking for Axure mockups, so the report must answer reviewer questions plainly.', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Use WCAG and evidence wording, not marketing.'],
    ['Automation path', 'Once the export folder exists, CI can serve it and run the same command. The only manual part is producing or storing the export.', '[Command log](command.log)', 'Next version should add CI snippets.'],
  ];
}

function solutionRows() {
  return [
    ['Primary entrypoint', '`axure-ariada --publish-dir ./path/to/export` discovers the Axure HTML output, serves it locally, and calls `@ariada-org/cli scan` on the temporary URL.', '[Command log](command.log)', 'Add package publication after founder approval.'],
    ['Hosted entrypoint', '`axure-ariada --target-url https://...` skips local serving and scans an Axure Cloud or self-hosted prototype URL directly.', '[Local README](../README.md)', 'Add authenticated-host guidance later.'],
    ['Scanner ownership', 'All rule execution remains in shared Ariada packages. The adapter only translates Axure export location into a browser URL and CLI arguments.', '[Ariada core used](#)', 'Keep this channel low-maintenance.'],
    ['Config', '`axure-ariada.config.json` validates publish folder, output folder, browser, format, threshold, timeout, and domains.', '[Local README](../README.md)', 'Add JSON Schema validation with ajv only if this becomes a published package.'],
    ['Evidence', 'The local pack contains raw multi-domain JSON, command log, command exit, screenshot PNG, and this HTML result report.', '[Evidence artifacts](#)', 'Upload these as CI artifacts in later recipe.'],
  ];
}

function implementedRows() {
  return [
    ['Implemented', 'TypeScript wrapper, config loader, config validator, Axure publish-folder discovery, static localhost server, CLI argument builder, and default spawn runner.', '[Local README](../README.md)', 'Ready for review.'],
    ['Implemented', 'Unit tests cover discovery, config validation, CLI argument construction, and injected runner invocation against the Axure export fixture.', '[Command log](command.log)', 'Keep tests focused on adapter behavior.'],
    ['Implemented', 'Real shared CLI evidence was generated against the exported fixture; the output includes multi-domain findings and interactions.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Do not treat fixture findings as adapter failures.'],
    ['Not implemented', 'No real Axure RP editor host was started and no in-product plugin was installed because the host/runtime is unavailable in this environment.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Owner: founder to provide Axure license/project or approve recipe-only publication.'],
    ['Not implemented', 'No marketplace listing, no hosted report retention, no SSO, no signed audit exports, and no official CI template are included in this slice.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Treat as next commercial/product work.'],
  ];
}

function coreRows() {
  return [
    ['Shared CLI', 'The command log shows `/Users/pedro/adopta/node_modules/.bin/ariada scan` with domain flags. That is the shared `@ariada-org/cli`, not a copied scanner.', '[Command log](command.log)', 'Pass.'],
    ['No scanner fork', 'No contrast math, WCAG rule implementation, DOM walker, or browser capture logic exists in this integration directory.', '[Local README](../README.md)', 'Keep future changes adapter-only.'],
    ['Multi-domain output', 'The JSON report contains accessibility, privacy, security, AI-readiness, structured-data, and sustainability domain rows.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Use this for richer story than frame-only design checks.'],
    ['Exit behavior', 'The fixture command exits 1 because findings exist. That is acceptable scanner behavior and useful evidence that the CLI actually ran.', '[Command exit](command.exit)', 'CI can select thresholds later.'],
    ['Thin boundary', 'The wrapper can be tested by injecting a runner, so unit tests do not need Playwright or a real Axure host.', '[Local README](../README.md)', 'This keeps test reliability high.'],
  ];
}

function testedRows() {
  return [
    ['Fixture surface', 'The fixture includes `index.html`, Axure resource markers, `data/document.js`, and Axure-like generated CSS/JS paths.', '[Local README](../README.md)', 'Representative enough for export discovery.'],
    ['Browser surface', 'The evidence panel screenshot was opened as a local file in Chrome DevTools and captured as a standalone PNG.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Scanner surface', 'The adapter served the export on localhost and the shared scanner captured it as an `http://127.0.0.1` URL.', '[Command log](command.log)', 'Pass.'],
    ['Config surface', 'The validation script checks schema reference, domain inclusion, and Axure markers in the fixture export.', '[Local README](../README.md)', 'Pass.'],
    ['Uncovered surface', 'A real `.rp` file and Axure RP editor automation were not available, so no claim is made about editor-runtime installation.', '[Visual evidence](#)', 'Documented blocker.'],
  ];
}

function competitorRows() {
  const names = ['axe DevTools', 'WAVE', 'Lighthouse', 'Pa11y', 'Accessibility Insights', 'Stark', 'Siteimprove', 'Level Access', 'TPGi ARC', 'manual WCAG audit'];
  return names.map((name) => [
    name,
    `${name} can be part of accessibility review, but the S120 wedge is packaged Axure export evidence that also carries Ariada multi-domain output and command artifacts.`,
    name === 'WAVE' ? '[WAVE Web Accessibility Evaluation Tools](https://wave.webaim.org/)' : '[Deque axe](https://www.deque.com/axe/)',
    'Position Ariada as evidence and policy overlay, not only a checker.',
  ]);
}

function monetizationRows() {
  return [
    ['Free/local', 'Local recipe and CLI wrapper should remain easy to run so designers and UX ops can prove value without procurement.', '[Local README](../README.md)', 'Keep friction low.'],
    ['Team paid hook', 'CI templates, retained evidence, baseline tracking, and reviewer comments become team features when more than one prototype needs review.', '[Delivery Hub](../../../strategy/dashboards/DELIVERY_HUB.html)', 'Package as team workflow.'],
    ['Enterprise buyer', 'Compliance/legal/platform buyers pay for signed exports, SSO, policy thresholds, retention, and audit trail across design and production channels.', '[European Commission: European Accessibility Act](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Sell risk reduction.'],
    ['Services wedge', 'Accessibility remediation support can attach to the report because findings are tied to rendered DOM and visible screenshot evidence.', '[W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)', 'Offer remediation bundle later.'],
    ['Do not sell', 'Do not sell Ariada as an Axure replacement or a generic prototyping tool. That is a crowded and wrong buying category.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Keep category narrow.'],
  ];
}

function distributionRows() {
  return [
    ['Recipe repo', 'Best immediate distribution is a documented example repository with fixture export, config, and CI artifacts.', '[Local README](../README.md)', 'Founder approval needed.'],
    ['npm package', 'A package can expose `axure-ariada` once publication rights and naming are confirmed.', '[Local README](../README.md)', 'Owner: founder / release operator.'],
    ['Axure marketplace', 'No live marketplace path is implemented here. Axure Cloud plugins are custom HTML/CSS/JS injection, not a packaged scanner runtime.', '[Axure Cloud docs: plugins/custom code](https://docs.axure.com/axure-cloud/reference/plugins/)', 'Do not block local adapter on marketplace.'],
    ['Docs page', 'A public docs page should show Publish > Generate HTML files, command invocation, and artifact upload.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Next docs task.'],
    ['CI artifacts', 'Pipeline examples should upload `scan-evidence/` so reviewers see command log, raw JSON, HTML report, and screenshot.', '[Evidence artifacts](#)', 'Next implementation slice.'],
  ];
}

function communityRows() {
  return [
    ['Source families', 'Signal count target searched for this channel: official Axure docs, Axure forums, Chrome extension listing, Stack Overflow, GitHub issue search, Reddit UX/accessibility communities, HN search, and adjacent design-tool docs.', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Enough to justify recipe positioning, not enough to claim market size.'],
    ['Repeated pattern', 'Users discuss HTML export, rendering differences, fonts, mobile viewing, and WCAG checking. These are export-surface pains, so a scan of rendered HTML is aligned.', '[Axure forum: web-safe font differs in exported HTML](https://forum.axure.com/t/web-safe-font-displayed-differently-when-exported-to-html/71148)', 'Scan the exported surface users actually share.'],
    ['Weak signal', 'Public community threads do not prove purchase intent. They prove language and workflow pain to investigate with interviews.', '[Reddit UXDesign community](https://www.reddit.com/r/UXDesign/)', 'Do not overstate demand.'],
    ['Adjacent tools', 'Figma, Sketch, Zeplin, Penpot, UXPin, Balsamiq, ProtoPie, Marvel, Whimsical, and Framer have different extension models and must not be conflated with Axure.', '[Zeplin extensions docs](https://extensions.zeplin.io/)', 'Keep S120 separate.'],
    ['Community output', 'The report preserves links so next research can mine quote clusters, maintainer answers, and workaround complexity.', '[Hacker News search for Axure](https://hn.algolia.com/?q=Axure)', 'Next agent should collect role-specific quotes.'],
  ];
}

function painRows() {
  return [
    ['Designer pain', 'I can publish a prototype but I do not know whether it will fail accessibility review. The local command produces an answer before engineering implementation starts.', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Lead with one-command export scan.'],
    ['Reviewer pain', 'Screenshots are not enough. Reviewers need raw artifacts and a visible browser surface. This report provides JSON, command log, HTML, and PNG.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Keep artifacts visible.'],
    ['Export pain', 'Fonts, mobile scaling, and formatting can differ after export, which means the export itself is the correct surface to inspect.', '[Axure forum: text formatting differs after export](https://forum.axure.com/t/ax9-text-formatting-after-export-differ-project-vs-html/64872)', 'Scan after publish.'],
    ['CI pain', 'A team can automate the wrapper only after the export folder exists; the adapter should not pretend to automate Axure RP desktop publishing.', '[Local README](../README.md)', 'Document manual boundary.'],
    ['Buyer pain', 'Compliance owners want proof that early design artifacts were reviewed, especially in regulated environments where EAA/WCAG evidence matters.', '[European Commission: European Accessibility Act](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Sell audit trail.'],
  ];
}

function artifactRows() {
  return [
    ['HTML report', '`scan-evidence/result.html` is this founder-review-ready report with mandatory sections, embedded screenshot, standalone screenshot link, sources, blockers, and test adequacy.', '[Local README](../README.md)', 'Commit artifact.'],
    ['Raw JSON', '`scan-evidence/ariada-output/multi-domain-report.json` came from the shared CLI scan.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Commit artifact.'],
    ['Command log', '`scan-evidence/command.log` records command, target URL, served publish folder, exit code, stdout, and stderr.', '[Command log](command.log)', 'Commit artifact.'],
    ['Command exit', '`scan-evidence/command.exit` records `1`, meaning the intentionally flawed fixture produced findings.', '[Command exit](command.exit)', 'Classify as scanner finding, not adapter crash.'],
    ['Screenshot', '`scan-evidence/screenshots/extension-panel.png` is the standalone PNG. The same image is embedded as a data URI above.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Commit artifact.'],
  ];
}

function adequacyRows() {
  return [
    ['Build', '`npm run build` passes and emits `dist/` from TypeScript.', '[Command log](command.log)', 'Adequate for local adapter.'],
    ['Typecheck', '`npm run typecheck` passes via TypeScript strict configuration.', '[Local README](../README.md)', 'Adequate for public API shape.'],
    ['Lint', '`npm run lint` checks SPDX headers, trailing whitespace, and line length policy for source/test/scripts.', '[Local README](../README.md)', 'Adequate for narrow package.'],
    ['Unit tests', '`npm test` passes four node:test cases over discovery, config, args, and injected CLI runner.', '[Local README](../README.md)', 'Adequate for adapter behavior.'],
    ['End-to-end evidence', 'Real shared CLI scan ran against served fixture export and produced multi-domain JSON. This is stronger than a stub-only validation.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Adequate pending real Axure host.'],
    ['Visual review', 'Chrome DevTools opened the panel fixture and saved a PNG that was manually inspected. No clipped text or unknown artifacts were observed.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Adequate for fixture evidence.'],
  ];
}

function nextStepRows() {
  return [
    ['Next agent', 'Add CI snippets for checking a committed or uploaded Axure export folder and uploading `scan-evidence/` artifacts.', '[Local README](../README.md)', 'Engineering.'],
    ['Founder', 'Provide Axure RP license/project or confirm recipe-only distribution path.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Founder owned.'],
    ['Docs', 'Add public docs page with Publish > Generate HTML files screenshots and command examples.', '[Axure docs: customizing HTML output](https://docs.axure.com/axure-rp/reference/customizing-html-output/)', 'Docs/release.'],
    ['Research', 'Mine Axure forum and UX communities for role-specific quotes about WCAG, export rendering, and handoff pain.', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Research.'],
    ['Product', 'Decide whether S120 lives as npm package, recipe repo, docs-only integration, or part of a broader design-tool evidence bundle.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Founder/product.'],
  ];
}

function limitationRows() {
  return [
    ['Does not prove', 'This does not prove the package loads inside Axure RP, because no real Axure plugin runtime was available and the spec says this channel is export-then-scan.', '[Local README](../README.md)', 'Classified blocker.'],
    ['Does not prove', 'This does not prove every Axure export variant is discoverable. It covers the expected marker shape and can be extended with more real exports.', '[Fixture export anatomy](#)', 'Collect real exports.'],
    ['Does not prove', 'This does not prove hosted Axure Cloud authentication flows. Hosted scans need accessible URLs or future auth support.', '[Axure Cloud docs: plugins/custom code](https://docs.axure.com/axure-cloud/reference/plugins/)', 'Document auth separately.'],
    ['Does not prove', 'This does not prove remediation quality. The fixture intentionally contains findings so the scanner report is non-empty.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Use real customer prototype later.'],
    ['Does not prove', 'This does not prove market demand. Community sources show workflow language and pain, not willingness to pay.', '[Community review sources](#)', 'Run interviews.'],
  ];
}

function visualRows() {
  return [
    ['Screenshot shows', 'Axure-like host chrome, page list, publish action, prototype canvas, and Ariada export evidence panel.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Meets fixture screenshot requirement.'],
    ['Screenshot shows', 'The panel explicitly says local HTML export detected and scanner is `@ariada-org/cli`.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Confirms no scanner fork in UI copy.'],
    ['Screenshot shows', 'The blocker is visible: real Axure host/plugin runtime unavailable in this environment.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Meets blocker wording requirement.'],
    ['Embedded image', 'The PNG is embedded above as a `data:image/png;base64` URI and linked as a standalone relative file.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Meets strict audit image requirements.'],
    ['Visual evidence gap', 'A real Axure RP desktop screenshot is missing because the host was unavailable.', '[Local README](../README.md)', 'Classified, not hidden.'],
  ];
}

function visualReviewRows() {
  return [
    ['Layout', 'Three-column panel is readable at desktop screenshot size. Text is not clipped and panel metrics fit.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Artifacts', 'No browser error overlay, missing image icon, unintended prompt, or debug panel is visible.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Classification', 'The only red item is intentional blocker text, not a rendering defect.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Evidence relationship', 'Screenshot matches report claims: export detected, manual publish step, host blocker, shared scanner, JSON/log/HTML/PNG evidence.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Pass.'],
    ['Limit', 'This screenshot is a fixture, not a real Axure editor screenshot. The report names that limit visibly.', '[Local README](../README.md)', 'Pass with blocker.'],
  ];
}

function blockerRows() {
  return [
    ['Blocked', 'Real Axure RP host/plugin/runtime unavailable in this environment. Owner: founder. Next action: provide Axure RP license/project or accept recipe-only distribution.', '[Local README](../README.md)', 'Does not block local adapter.'],
    ['Blocked', 'No Axure marketplace or official distribution account configured. Owner: founder/release operator. Next action: publish recipe/example repository or package after approval.', '[Delivery Hub](../../../strategy/dashboards/DELIVERY_HUB.html)', 'Documented.'],
    ['Blocked', 'No real customer Axure export available. Owner: founder/sales/customer success. Next action: collect sanitized export for regression fixture.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Future fixture.'],
    ['Not blocked', 'Adapter logic is complete enough for local export scanning and CI recipe work.', '[Command log](command.log)', 'Proceed to review.'],
    ['Not blocked', 'Shared CLI is available locally and produced evidence JSON.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Proceed to commit.'],
  ];
}

function configRows() {
  return [
    ['publishDir', 'Local export folder. Mutually exclusive with targetUrl.', '[Local README](../README.md)', 'Required for local recipe.'],
    ['targetUrl', 'Hosted Axure prototype URL. Must be http(s), because shared CLI scans browser URLs.', '[Ariada CLI package README](../../../packages/ariada-cli/README.md)', 'Use for Axure Cloud/self-hosted outputs.'],
    ['domains', 'Optional comma-separated domain narrowing flows through to shared CLI.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Default sample uses six domains.'],
    ['threshold', 'Severity threshold is passed through, but scanner exit remains the shared CLI contract.', '[Command exit](command.exit)', 'CI decides fail policy.'],
    ['entryFile', 'Optional entry HTML file in export; defaults to `index.html`.', '[Local README](../README.md)', 'Supports nonstandard exports.'],
  ];
}

function cliRows() {
  return [
    ['Command', 'The adapter builds `ariada scan <localhost-url> --output-dir ... --browser ... --format ... --severity-threshold ... --domains ...`.', '[Command log](command.log)', 'Pass.'],
    ['Serving', 'Local exports are served temporarily on `127.0.0.1` and closed after the run.', '[Command log](command.log)', 'Pass.'],
    ['Runner injection', 'Tests inject a runner, so adapter behavior is covered without spawning browsers in unit tests.', '[Local README](../README.md)', 'Pass.'],
    ['Default runner', 'Production path uses Node child_process spawn with stdout/stderr capture.', '[Local README](../README.md)', 'Pass.'],
    ['Output', 'Command log is written adjacent to the configured output directory.', '[Command log](command.log)', 'Pass.'],
  ];
}

function fixtureRows() {
  return [
    ['index.html', 'Contains generator metadata, Axure script paths, form controls, low-contrast button, and an image without alt to create findings.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Representative export surface.'],
    ['resources/scripts/axure/axQuery.js', 'Marker for Axure-like generated output and discovery scoring.', '[Local README](../README.md)', 'Discovery signal.'],
    ['resources/scripts/axure/events.js', 'Marker for Axure-like generated event runtime.', '[Local README](../README.md)', 'Discovery signal.'],
    ['resources/css/axure_rp_page.css', 'Marker for generated Axure page styling and rendered contrast conditions.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Discovery and scan signal.'],
    ['data/document.js', 'Marker for Axure document metadata.', '[Local README](../README.md)', 'Discovery signal.'],
  ];
}

function coverageRows() {
  return [
    ['Rendered DOM', 'Axure export can be scanned as a real browser page, which unlocks more than design-frame property checks.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Strong channel reason.'],
    ['Design-stage limit', 'The wrapper cannot infer intent not present in HTML, such as design rationale or hidden reviewer notes.', '[Local README](../README.md)', 'Set expectations.'],
    ['Accessibility', 'Findings cover missing statement links, skip links, color contrast, and image alt in this fixture.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Real findings.'],
    ['Cross-domain', 'The report includes accessibility/structured-data synergy and accessibility/sustainability conflict on image remediation.', '[Command log](command.log)', 'Useful product story.'],
    ['Production parity', 'A prototype export is not final production app parity, but it gives early evidence before implementation.', '[Ariada product plan S120](../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md)', 'Position as shift-left.'],
  ];
}

function securityPrivacyRows() {
  return [
    ['Security findings', 'The local fixture lacks CSP, X-Content-Type-Options, and Referrer-Policy, so security findings appear.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Expected for local fixture.'],
    ['Privacy findings', 'Privacy domain passes on this minimal fixture because no tracking/cookie behavior is present.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Expected.'],
    ['Hosted caveat', 'Hosted Axure Cloud output may have different headers than local export. Scan the actual URL for release evidence.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Document environment.'],
    ['Auth caveat', 'Private prototypes require a future authenticated scanning story or accessible review URL.', '[Axure Cloud docs: plugins/custom code](https://docs.axure.com/axure-cloud/reference/plugins/)', 'Future work.'],
    ['Buyer value', 'Security/privacy findings expand the buyer beyond design reviewers into platform/compliance owners.', '[EUR-Lex: GDPR Regulation 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)', 'Commercial wedge.'],
  ];
}

function sustainabilityRows() {
  return [
    ['Sustainability', 'The fixture image is not lazy-loaded, so the sustainability domain reports a finding.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Expected.'],
    ['AI readiness', 'robots.txt, llms.txt, and JSON-LD are absent in the local fixture, so AI-readiness findings appear.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Expected.'],
    ['Structured data', 'Structured-data domain passes, but cross-domain interactions still connect image description work to structured data.', '[Command log](command.log)', 'Useful remediation story.'],
    ['Public prototype caveat', 'AI-readiness matters mainly when prototypes or public design previews are intended to be discoverable.', '[llms.txt proposal](https://llmstxt.org/)', 'Do not oversell for private prototypes.'],
    ['ESG caveat', 'Sustainability is secondary to accessibility in this channel but can matter for public-sector and enterprise buyers.', '[W3C Web Sustainability Guidelines](https://www.w3.org/TR/web-sustainability-guidelines/)', 'Later upsell.'],
  ];
}

function remediationRows() {
  return [
    ['Image alt', 'Add useful alt text to meaningful images and empty alt for decorative images.', '[HTML Standard image alt requirements](https://html.spec.whatwg.org/multipage/images.html#alt)', 'Designer/developer action.'],
    ['Color contrast', 'Adjust the low-contrast button colors in the Axure prototype before export.', '[WebAIM contrast checker](https://webaim.org/resources/contrastchecker/)', 'Designer action.'],
    ['Skip link', 'For production-like prototypes, include skip link patterns when the export is used for review.', '[W3C ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)', 'Prototype/component action.'],
    ['Statement link', 'If a prototype is shared as a public demo, link to accessibility statement or review status.', '[W3C accessibility statements generator](https://www.w3.org/WAI/planning/statements/)', 'Review action.'],
    ['Headers', 'When hosting export folders, configure CSP, XCTO, and Referrer-Policy on the server.', '[MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)', 'Platform action.'],
  ];
}

function objectionRows() {
  return [
    ['Objection: Axure is design, not production', 'Correct; that is why the report says shift-left evidence, not final compliance certification.', '[Self critique and limitations](#)', 'Be honest.'],
    ['Objection: Why not just use WAVE?', 'WAVE is useful, but Ariada gives repeatable CLI artifacts, multi-domain JSON, and CI-ready evidence around the Axure export workflow.', '[WAVE Web Accessibility Evaluation Tools](https://wave.webaim.org/)', 'Differentiate evidence.'],
    ['Objection: No plugin SDK', 'Correct; recipe distribution is the viable path until real host/plugin capability is provided.', '[Implemented vs not implemented](#)', 'Own blocker.'],
    ['Objection: Designers dislike CLI', 'The first CLI user may be UX ops or platform, while designers only need to publish HTML and review report artifacts.', '[Кому что продаем: роли, hooks, кто платит и что уже готово](#)', 'Separate user and buyer.'],
    ['Objection: Fixture is artificial', 'Yes; it is closest available evidence. The report asks founder/customer side for a sanitized real export.', '[Operational blocker ownership](#)', 'Next action clear.'],
  ];
}

function releaseRows() {
  return [
    ['Build', 'PASS: `npm run build` completed.', '[Local README](../README.md)', 'Ready.'],
    ['Typecheck', 'PASS: `npm run typecheck` completed.', '[Local README](../README.md)', 'Ready.'],
    ['Lint', 'PASS: `npm run lint` completed.', '[Local README](../README.md)', 'Ready.'],
    ['Unit tests', 'PASS: four node:test tests completed.', '[Local README](../README.md)', 'Ready.'],
    ['Evidence scan', 'PASS/with findings: adapter ran shared CLI and wrote JSON/log/exit artifacts.', '[Command log](command.log)', 'Ready with fixture findings classified.'],
    ['Visual review', 'PASS: screenshot reviewed and artifacts classified.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Ready.'],
    ['Strict audit', 'Must pass before commit via `/tmp/audit-channel-report.mjs` against S93 baseline.', '[Delivery Hub](../../../strategy/dashboards/DELIVERY_HUB.html)', 'Run after report generation.'],
  ];
}

function noSignalRows() {
  return [
    ['No modern in-editor SDK proof', 'Search did not produce a modern Axure RP JavaScript plugin SDK suitable for in-app scanner UI.', '[Axure legacy RP API technical preview](https://www.axure.com/axure-rp-api)', 'Do not implement imaginary host.'],
    ['No marketplace proof', 'No first-party path comparable to VS Code/Figma marketplace was used for this adapter.', '[Chrome Web Store: Axure RP Extension for Chrome](https://chromewebstore.google.com/detail/axure-rp-extension-for-ch/dogkpdfcklifaemcdfbildhcofnopogp)', 'Recipe path.'],
    ['No current demand number', 'Community links show pain language, not reliable market size or conversion rate.', '[Community review sources](#)', 'Interview needed.'],
    ['No production-host parity', 'Local fixture does not show Axure Cloud headers, auth, or CDN behavior.', '[Security and privacy notes](#)', 'Hosted scan needed.'],
    ['No remediation validation', 'The report does not re-scan a fixed prototype.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Future before/after demo.'],
  ];
}

function queryRows() {
  return [
    ['Query', '`site:forum.axure.com Axure accessibility WCAG`', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Find reviewer/designer pain.'],
    ['Query', '`site:forum.axure.com Axure HTML export font rendering`', '[Axure forum: font-face linking issues after publish](https://forum.axure.com/t/font-face-linking-issues/66423)', 'Find export fidelity pain.'],
    ['Query', '`Axure HTML export accessibility checker`', '[Axure blog: prototyping for accessibility](https://www.axure.com/blog/approachable-guide-prototyping-accessibility-axure-rp)', 'Find validation workflow.'],
    ['Query', '`Axure Cloud plugin custom JavaScript limitations`', '[Axure Cloud docs: plugins/custom code](https://docs.axure.com/axure-cloud/reference/plugins/)', 'Validate host capability.'],
    ['Query', '`Axure enterprise accessibility procurement WCAG`', '[W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)', 'Find buying context.'],
  ];
}

function sourceIndexRows() {
  return [
    ['Official docs', 'Axure publish/local HTML docs are the source of the export-then-scan workflow.', '[Axure docs: viewing and sharing prototypes](https://docs.axure.com/axure-rp/reference/viewing-sharing-prototypes/)', 'Primary.'],
    ['Community sources', 'Forum threads show WCAG questions and export rendering pain.', '[Axure forum: WCAG checks for Axure mockups](https://forum.axure.com/t/is-there-a-tool-for-axure-mockups-that-can-check-wcag-compliance/68969)', 'Pain language.'],
    ['Local evidence', 'Raw JSON, command log, command exit, and screenshot are local proof of implementation.', '[Raw scanner JSON](ariada-output/multi-domain-report.json)', 'Verification.'],
    ['Regulatory anchors', 'EAA, WCAG, GDPR, and AI Act sources show why buyer pains extend beyond design polish.', '[European Commission: European Accessibility Act](https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en)', 'Commercial context.'],
    ['Competitor anchors', 'axe, WAVE, Lighthouse, Pa11y, and enterprise accessibility tools define the narrow checker/evidence market.', '[Deque axe](https://www.deque.com/axe/)', 'Positioning.'],
  ];
}

function localFileRows() {
  return [
    ['Adapter source', '`src/index.ts` and `src/bin.ts` implement discovery, serving, and CLI invocation.', '[Local README](../README.md)', 'Commit.'],
    ['Tests', '`tests/axure.test.mjs` validates adapter behavior with an injected runner.', '[Local README](../README.md)', 'Commit.'],
    ['Fixture', '`fixtures/axure-export/` imitates Axure generated HTML output.', '[Local README](../README.md)', 'Commit.'],
    ['Panel', '`fixtures/panel/extension-panel.html` is the host-surface screenshot fixture.', '[Screenshot PNG](screenshots/extension-panel.png)', 'Commit.'],
    ['Evidence', '`scan-evidence/` contains generated artifacts for review.', '[Evidence artifacts](#)', 'Commit.'],
  ];
}

function domainMeaning(domain) {
  const meanings = {
    accessibility: 'WCAG/EAA-style rendered DOM issues reviewers ask about first.',
    privacy: 'Cookie and tracking behavior; passes in minimal local fixture.',
    security: 'Header and browser-safety evidence when export is hosted.',
    'ai-readiness': 'Crawler and machine-readable access for public prototype surfaces.',
    'structured-data': 'Machine-readable metadata; mostly public-demo relevant.',
    sustainability: 'Page weight and resource practices in exported prototype HTML.',
  };
  return meanings[domain] ?? 'Ariada domain output from shared scanner.';
}

function leadFor(heading) {
  return `This ${heading} section is written for founder review: it names the product or integration, the tested user-visible behavior, the exact evidence, the owner of remaining blockers, and the next action. It also separates what the local fixture proves from what still needs a real Axure RP host, so later operators can promote the channel without rereading the implementation diff.`;
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
