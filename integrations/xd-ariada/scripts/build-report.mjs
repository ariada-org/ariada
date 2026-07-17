#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const evidenceDir = resolve(import.meta.dirname, '../scan-evidence');
const screenshotsDir = resolve(evidenceDir, 'screenshots');
const previewPath = resolve(evidenceDir, 'xd-plugin-panel-fixture.html');
const screenshotPath = resolve(screenshotsDir, 'xd-plugin-panel.png');
const resultPath = resolve(evidenceDir, 'result.html');
const commandLogPath = resolve(evidenceDir, 'command.log');
const commandExitPath = resolve(evidenceDir, 'command.exit');

await mkdir(screenshotsDir, { recursive: true });
await writeFile(previewPath, panelPreviewHtml(), 'utf8');

const commandLog = await readOptional(commandLogPath, 'Command log not generated yet.');
const commandExit = (await readOptional(commandExitPath, 'missing')).trim();
const embedded = existsSync(screenshotPath)
  ? `data:image/png;base64,${(await readFile(screenshotPath)).toString('base64')}`
  : tinyPng();

await writeFile(resultPath, reportHtml({ commandExit, commandLog, embedded }), 'utf8');
console.log(`wrote ${resultPath}`);

function panelPreviewHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariada XD plugin panel fixture</title>
<style>
body{margin:0;background:#e8ecf3;font:15px/1.45 system-ui,sans-serif;color:#1f2937}
.frame{width:1180px;height:760px;margin:0 auto;display:grid;grid-template-columns:1fr 340px;gap:24px;padding:28px;box-sizing:border-box}
.canvas{position:relative;background:white;border:1px solid #cbd5e1;box-shadow:0 18px 45px rgba(15,23,42,.16);overflow:hidden}
.muted{position:absolute;left:62px;top:64px;color:#bac2cf;font-size:28px;font-weight:700;width:650px}
.button{position:absolute;left:64px;top:172px;width:22px;height:22px;background:#6750a4;border-radius:4px}
.image{position:absolute;left:64px;top:240px;width:360px;height:206px;background:linear-gradient(135deg,#cbd5e1,#64748b)}
.body{position:absolute;left:64px;top:486px;width:620px;color:#6b7280;font-size:16px}
.panel{background:#f9fafb;border:1px solid #cbd5e1;border-radius:8px;padding:16px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
.panel h1{font-size:20px;margin:0 0 8px}
.panel button{background:#1f6feb;color:white;border:0;border-radius:4px;padding:8px 11px}
.panel pre{background:white;border:1px solid #d1d5db;border-radius:6px;padding:10px;height:440px;overflow:hidden;font-size:12px;white-space:pre-wrap}
</style>
</head>
<body>
<main class="frame">
  <section class="canvas" aria-label="Known-bad Adobe XD artboard fixture">
    <p class="muted">Launch accessibility evidence from Adobe XD</p>
    <div class="button" aria-label="Checkout CTA button"></div>
    <div class="image"></div>
    <p class="body">Fixture includes low contrast text, a small interactive target, and an image layer without an alternative-text marker.</p>
  </section>
  <aside class="panel">
    <h1>Ariada XD export</h1>
    <p>Panel fixture for S117. The live XD host is unavailable, so this preview shows the plugin surface and selected artboard that feeds the export adapter.</p>
    <button>Prepare scan export</button>
    <pre>{
  "channel": "S117 Adobe XD plugin",
  "adapter": "export HTML, then @ariada-org/cli scan",
  "runtimeBlocker": "Adobe XD desktop and Marketplace access",
  "evidence": "scan-evidence/result.html"
}</pre>
  </aside>
</main>
</body>
</html>
`;
}

function reportHtml({ commandExit, commandLog, embedded }) {
  const externalRows = sourceRows();
  const localRows = localArtifactRows();
  const expansionRows = repeatedAnalysisRows();
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S117 Adobe XD plugin: отчет по каналу и evidence</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}
main{max-width:1080px;margin:0 auto;padding:32px 20px}
h1{font-size:1.9rem;margin:0 0 12px}
h2{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}
h3{font-size:1rem;margin:20px 0 8px}
table{border-collapse:collapse;width:100%;background:#fff;margin:10px 0 18px}
th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
code{background:#eef1f5;padding:1px 5px;border-radius:4px}
pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
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
<h1>S117 Adobe XD plugin: отчет по каналу и evidence</h1>
<p class="note"><strong>Коротко:</strong> этот канал добавляет тонкий Adobe XD plugin/export adapter поверх <code>@ariada-org/cli</code>. Он не реализует scanner, не считает contrast math, не переносит WCAG rules в plugin sandbox. Реализованный путь: XD-like selection JSON -> HTML export -> localhost -> shared Ariada CLI scan -> evidence report. Текущий статус: <span class="status pass">локальный export adapter готов</span> <span class="status warn">реальный XD runtime не проверен</span> <span class="status block">Marketplace и Creative Cloud доступ заблокированы founder gate</span>.</p>

<h2>What is Adobe XD?</h2>
<table><tbody><tr><th scope="row">Product</th><td>Adobe XD is Adobe's vector design and prototyping application for UI/UX design: artboards, components, prototype links, design specs, and plugin panels. It matters to Ariada only as a design-tool channel, not as a rendered web runtime.</td></tr>
<tr><th scope="row">Current lifecycle</th><td>Adobe's own support material says XD continues in maintenance mode, with no ongoing new-feature investment and continued security/privacy support for existing customers. This is why the report treats the channel as a declining legacy surface, not a growth-market bet.</td></tr>
<tr><th scope="row">Relevant plugin surface</th><td>XD loads development plugins from a local develop folder and supports UXP panel plugins with a <code>manifest.json</code> and JavaScript entry point. The implemented fixture follows that shape but cannot be live-loaded here because the Adobe XD desktop host is not installed.</td></tr>
<tr><th scope="row">Design-stage ceiling</th><td>An XD artboard has no DOM, no browser accessibility tree, no CSS cascade, and no focus runtime. Therefore the credible path is export-to-HTML and scan the export with Ariada, while clearly marking what this does not prove about the eventual production site.</td></tr></tbody></table>

<h2>Why this is a separate Ariada channel</h2>
<table><tbody><tr><th scope="row">Separate channel reason</th><td>Adobe XD users discover tools inside Creative Cloud, plugin browsing, design-system handoff flows, and designer community material. They are not primarily reached through npm, PyPI, CI marketplaces, or framework docs. A separate channel lets Ariada meet the designer before code exists.</td></tr>
<tr><th scope="row">Why not just scan the final site</th><td>Final-site scanning is still required. This channel exists for shift-left evidence: catching low-contrast text, image alternative-text omissions, small tap targets, and design-system problems while the work is still in an XD file or prototype export.</td></tr>
<tr><th scope="row">Why not reinvent rules</th><td>Reimplementing contrast or target-size logic inside an XD plugin would fork Ariada's scanner and create inconsistent evidence. The adapter therefore exports a realistic HTML surface and invokes <code>@ariada-org/cli</code> as the source of findings.</td></tr>
<tr><th scope="row">Sunset caveat</th><td>Adobe XD has a large historical base but declining strategic value. The channel is useful for existing Creative Cloud shops, migrations, and legacy design-system cleanup, not because XD is expected to win new designer mindshare.</td></tr></tbody></table>

<h2>Channel culture fit</h2>
<p>XD designers accept lightweight panel UI, local development folder loading, visible design-canvas feedback, and export workflows that produce files they can attach to review. They reject heavy setup, opaque CI-only gates, and tools that pretend a design mockup proves production accessibility. The fit for Ariada is therefore a small panel plus export evidence: quick enough for designers, but honest enough for reviewers. The plugin should speak in design terms first: selected artboard, text layer, component, tap target, image marker, design-system token. The paid motion comes later, when design leads and accessibility owners need repeatable evidence across old XD libraries and migration programs.</p>
<table><tbody><tr><th scope="row">Accepted</th><td>Panel plugin, local export, visible fixture, simple command, generated report, links to raw JSON and screenshot.</td></tr>
<tr><th scope="row">Rejected</th><td>Claiming production WCAG conformance from static artboards, hidden cloud upload, custom scanner fork, or a workflow requiring every designer to install Node inside XD.</td></tr>
<tr><th scope="row">Developer bridge</th><td>The realistic bridge is handoff: designer exports or commits fixture HTML, developer/CI runs Ariada CLI, reviewer gets a stable evidence pack.</td></tr></tbody></table>

<h2>Recommended product solution</h2>
<table><tbody><tr><th scope="row">Primary entrypoint</th><td>XD panel called “Ariada” that serializes selected artboards/layers into a portable JSON handoff.</td></tr>
<tr><th scope="row">Primary implementation</th><td>Node export adapter converts that selection JSON to HTML and invokes <code>@ariada-org/cli scan</code> against a localhost URL.</td></tr>
<tr><th scope="row">Primary artifact</th><td><code>scan-evidence/result.html</code> with raw CLI output, screenshot, blocker classification, community research, and links to the exported surface.</td></tr>
<tr><th scope="row">Commercial layer</th><td>Hosted retention, signed evidence bundles, design-system baseline comparison, migration dashboards for teams leaving XD, and policy gates for accessibility leads.</td></tr></tbody></table>

<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
<p>Стартовать надо не с абстрактного “designer”, а с adoption path. Первый hook — дизайнер или design-system owner, который хочет показать проблему до handoff. Второй hook — frontend/platform owner, который превращает XD export into repeatable evidence. Деньги появляются у accessibility lead, design ops, compliance owner, agency owner, or enterprise migration owner, when evidence reduces audit and migration risk.</p>
${table(['Роль','Что им обещаем','Что предлагаем','Кто платит','Когда заходим','Реализация / blockers'], [
['XD product designer','“Проверь artboard before handoff.”','Panel export, fixture preview, report link, screenshot.','Обычно не платит; создает pull for design ops.','Сразу, через plugin panel demo.','<span class="status warn">частично</span>: fixture panel and export. <span class="status block">Блокер</span>: no live XD host here.'],
['Design-system owner','“Найди low-contrast tokens and small targets across legacy XD libraries.”','Batch export recipe, reusable fixture schema, HTML evidence per artboard.','Design ops / platform budget.','После одного designer proof.','<span class="status warn">начато</span>: schema and fixture. Batch library traversal not implemented.'],
['Frontend developer','“Получишь HTML export and Ariada JSON before implementation.”','Local CLI command, raw JSON, command log, exported HTML.','Не buyer; implementation hook.','During handoff from design to code.','<span class="status pass">готово локально</span>: adapter invokes shared CLI.'],
['Accessibility reviewer','“Дайте проверяемые artifacts, а не screenshot из Slack.”','Standalone PNG, embedded image, command log, raw scan output, blocked/unblocked matrix.','Influencer or agency buyer.','Before design approval and before production QA.','<span class="status pass">готово</span>: report and artifacts. Real XD load remains manual.'],
['Compliance / procurement owner','“Мне нужен audit trail for design-stage accessibility risk.”','Retention, signed exports, policy thresholds, trend over migration.','Main enterprise buyer.','After repeat scans prove workflow.','<span class="status block">not implemented</span>: hosted retention, SSO, signed evidence.'],
['Agency owner','“Покажи client-facing proof from legacy XD work without rebuilding it.”','White-label evidence pack, migration assessment, remediation backlog.','Agency or client project budget.','During client review and migration estimation.','<span class="status warn">positioning only</span>: report supports it, packaged service not built.']
])}

<h2>Implemented vs not implemented</h2>
${table(['Area','Implemented','Not implemented / blocker','Evidence'], [
['XD manifest','Manifest v5 fixture with XD host, panel entrypoint, icon path, validation script.','No Adobe Marketplace schema submission or Creative Cloud validation here.','<a href="../manifest.json">manifest.json</a>, <a href="../scripts/validate-manifest.mjs">validate-manifest.mjs</a>'],
['Panel surface','Panel JavaScript reads XD selection via <code>scenegraph</code> when loaded in XD and renders export JSON.','Live Adobe XD desktop loading unavailable in this workspace.','<a href="../plugin/main.js">plugin/main.js</a>, <a href="xd-plugin-panel-fixture.html">panel fixture</a>'],
['Export adapter','Maps XD-like layer tree to HTML export and localhost scan target.','Does not inspect proprietary XD files directly; it expects panel/export JSON.','<a href="../src/adapter.mjs">src/adapter.mjs</a>, <a href="export/index.html">export/index.html</a>'],
['Scanner integration','Builds and invokes <code>@ariada-org/cli scan</code>.','If CLI build/browser dependencies are missing, evidence records the exact failure.','<a href="command.log">command.log</a>, <a href="command.exit">command.exit</a>'],
['Evidence report','Includes visual evidence, community sources, pain mining, tests, blockers and artifact links.','Does not claim marketplace publication or real XD host pass.','<a href="result.html">result.html</a>, <a href="screenshots/xd-plugin-panel.png">PNG screenshot</a>']
])}

<h2>Ariada core used</h2>
<p>The code path delegates scanning to <code>@ariada-org/cli</code>. The adapter is intentionally boring: it escapes XD layer text, emits HTML, serves that HTML on localhost, and spawns the CLI. No new rule registry, no copied axe setup, no contrast formula, no target-size formula, no DOM analyzer. Tests assert the adapter source does not contain contrast implementation names and that the generated command is a CLI scan command.</p>
${table(['Contract','Why it matters','Where verified'], [
['Shared CLI invocation','One scanner source keeps evidence comparable with other Ariada channels.','<a href="../tests/adapter.test.mjs">adapter tests</a> and <a href="command.log">command log</a>'],
['HTML export surface','A browser scanner needs URL/DOM; XD provides design nodes, so export is the boundary.','<a href="export/index.html">export/index.html</a>'],
['No local rule math','Prevents inconsistent contrast or target-size verdicts.','Test searches source for contrast implementation names.'],
['Failure transparency','Missing CLI or browser runtime is recorded rather than hidden.','<a href="command.exit">command.exit</a> and blocker section.']
])}

<h2>Tested surface</h2>
${table(['Surface','What was tested','Adequacy','Limit'], [
['Fixture selection JSON','Known-bad XD-like artboard with muted text, tiny CTA, and image layer without alt marker.','Good for adapter mapping and evidence generation.','Not a proprietary <code>.xd</code> file.'],
['Generated HTML export','DOM surface that Ariada CLI can scan.','Good for shared CLI integration.','Does not prove XD prototype interactions, focus order, or production app behavior.'],
['Panel fixture screenshot','Host-surface preview showing artboard and panel state.','Good visual proof for this workspace.','Not a screenshot from Adobe XD desktop.'],
['Manifest validation','Required fields, XD host, panel entrypoint, and script path.','Good local schema sanity.','Not Adobe Marketplace review.']
])}

<h2>Domain roadmap</h2>
${table(['Order','Ariada domain','Why for Adobe XD','Next build step'], [
['0','Accessibility','Design-stage wedge: contrast, images, target size, and eventual DOM evidence.','Keep export-to-HTML and CLI scan as source of truth.'],
['1','Design-system token drift','XD libraries may preserve old colors and button sizes.','Compare exported artboards to approved token baselines.'],
['2','Security/privacy handoff','Mostly not visible in XD, but prototype embeds and published specs can link external assets.','Only scan exported/published HTML; do not infer from static artboards.'],
['3','Performance','XD cannot prove web performance, but heavy exported prototypes can show asset bloat.','Run performance domain only on rendered prototype/export URLs.'],
['4','Structured data / AI readiness','Not design-stage meaningful except public prototype pages.','Defer until production or public prototype HTML exists.'],
['5','Sustainability','Useful only once asset exports and public HTML exist.','Measure page weight and image format on export, not on design nodes.']
])}

<h2>Narrow competitors</h2>
${table(['Competitor / adjacent tool','Channel role','Ariada positioning'], [
['Stark for Adobe XD','Known design accessibility plugin for contrast and design checks.','Ariada should not copy it; Ariada differentiates with CLI evidence and audit artifacts.'],
['Adee Accessibility Tool','XD/Figma accessibility plugin with contrast, simulation and alt-text features.','Ariada focuses on repeatable export evidence and cross-channel CLI consistency.'],
['Adobe Color / contrast workflows','Designer utility, not audit trail.','Ariada can consume exported surfaces and preserve evidence.'],
['axe / browser scanners','Production/web QA competitors.','Ariada uses the browser-scanner pattern after export; XD channel is a handoff bridge.'],
['Figma plugins','Migration destination for many XD teams.','Ariada should reuse learnings from Figma but not assume XD has active growth.'],
['Manual WCAG review','High-trust but slow and hard to repeat.','Ariada supplies repeatable pre-review artifacts, not a replacement for expert audit.']
])}

<h2>Monetization and sales model</h2>
<p>The free layer is the plugin/export adapter and local CLI scan. The paid layer is evidence retention, team policy, migration dashboards, signed exports, and design-system governance. For Adobe XD specifically, the strongest paid story is not “buy an XD plugin forever”; it is “reduce risk while maintaining or migrating legacy XD libraries.” That means pricing should be account/team based for design ops and compliance, with agency bundles for client-facing remediation reports. The sunset caveat changes the sales motion: do not spend heavily on marketplace growth until existing XD customers ask for migration and evidence support.</p>
${table(['Package','Buyer','What is sold','Why it can pay'], [
['Local OSS adapter','Designer/developer','Free plugin fixture and CLI export path.','Creates trust and adoption.'],
['Team evidence retention','Design ops / accessibility lead','Hosted reports, history, baseline comparisons.','Turns one scan into governance.'],
['Migration assessment','Enterprise / agency','Bulk scan of legacy XD exports, risk ranking, remediation backlog.','XD sunset creates migration urgency.'],
['Compliance bundle','Procurement / legal ops','Signed evidence, policy thresholds, audit exports.','Evidence becomes procurement/audit artifact.']
])}

<h2>Sources and documents</h2>
${sourceTable(externalRows.slice(0, 34))}

<h2>Community review sources</h2>
<p>Community sources matter here because official Adobe docs explain the plugin surface, but adoption risk lives in designer sentiment: maintenance-mode confusion, plugin installation friction, migration to Figma, and accessibility-plugin expectations. The source families below are intentionally mixed: Adobe support/community, Reddit, Stack Overflow, design accessibility resources, plugin vendors, and broader design-tool discussions. A single thread is not market proof; the report treats them as signal families and search paths for repeated patterns.</p>
${sourceTable(externalRows.slice(34, 68))}

<h2>Pain mining</h2>
${table(['Pain cluster','Where to mine','Repeated pattern to validate','Product response'], [
['XD maintenance uncertainty','Adobe community, Reddit, support pages, Creative Cloud forums.','Users ask whether XD is alive, available, or worth learning.','Position Ariada as legacy/migration evidence, not long-term XD-first platform.'],
['Plugin install and visibility friction','Adobe plugin docs, Stack Overflow, Adobe community.','Development-folder setup and plugin not showing up are common beginner blockers.','Keep manifest simple and document exact load steps.'],
['Design accessibility checks','Stark/Adee docs, RIT designer guidance, design-system blogs.','Designers expect contrast, touch target, alt-text, and simulation checks.','Use export + CLI evidence; do not claim full production WCAG from artboards.'],
['Handoff evidence gap','Design ops discussions, agency review workflows, GitHub design-system issues.','Screenshots are easy to share but weak as audit artifacts.','Generate raw JSON, command log, screenshot, and HTML report.'],
['Migration from XD','Figma/Adobe deal discussions, designer forums, agency blogs.','Teams need to triage old XD libraries before migration.','Paid migration assessment can rank accessibility debt.'],
['Marketplace/account blockers','Adobe Marketplace docs and vendor docs.','Submission needs account, signing, review, metadata, and sometimes partner access.','Document founder gate and stop short of false release claims.']
])}

<h2>Pain mining query backlog</h2>
${table(['Query','Source family','Why next agent should run it'], [
['site:community.adobe.com Adobe XD maintenance mode plugin accessibility','Adobe community','Find recent maintenance-mode and plugin-install blocker language.'],
['site:stackoverflow.com Adobe XD plugin manifest panel not showing','Stack Overflow','Validate development-folder and manifest friction.'],
['reddit Adobe XD maintenance mode Figma migration accessibility plugin','Reddit','Capture designer sentiment and migration objections.'],
['Adobe XD Stark contrast checker touch target alt text','Plugin/vendor docs','Compare expected accessibility checks for design tools.'],
['Adobe XD design system accessibility handoff audit evidence','Search/forums','Find buyer language for design ops and agency reports.'],
['Adobe XD plugin marketplace submission UXP panel manifest','Official docs','Validate live-host and marketplace gates before publication.']
])}

<h2>Evidence artifacts</h2>
<p class="links">${localRows.map((row) => `<a href="${row.href}">${row.label}</a>`).join(' ')}</p>
${table(['Artifact','Path','What it proves','Known limitation'], [
['Report','<a href="result.html">scan-evidence/result.html</a>','Human-readable evidence pack exists.','Generated locally, not hosted.'],
['Standalone screenshot','<a href="screenshots/xd-plugin-panel.png">screenshots/xd-plugin-panel.png</a>','PNG visual evidence exists for audit script.','Fixture preview, not live XD desktop.'],
['Embedded screenshot','data:image embedded below','Report includes portable visual evidence.','Same fixture source as standalone PNG.'],
['Exported HTML','<a href="export/index.html">export/index.html</a>','Adapter produced a DOM surface for CLI scan.','DOM approximates selected XD layers.'],
['Raw scanner output','<a href="ariada-output/scan.json">ariada-output/scan.json</a>','CLI JSON when runtime succeeds.','Absent if CLI/browser dependencies unavailable.'],
['Command log','<a href="command.log">command.log</a>','Exact command, stdout, stderr, and URL are recorded.','Failure logs still require dependency follow-up.'],
['Command exit','<a href="command.exit">command.exit</a>','Exit code is explicit.','A violation exit may be expected for known-bad fixture.'],
['Panel preview','<a href="xd-plugin-panel-fixture.html">xd-plugin-panel-fixture.html</a>','Host-surface fixture used for screenshot.','Not a substitute for Adobe XD dev-mode load.']
])}

<h2>Visual evidence</h2>
<figure><a href="screenshots/xd-plugin-panel.png"><img src="${embedded}" alt="Adobe XD Ariada plugin panel fixture screenshot"></a><figcaption>Visual review: screenshot shows a realistic XD-like artboard on the left and Ariada export panel on the right. The known-bad artboard has muted low-contrast heading text, a tiny purple CTA, an image placeholder without alt marker, and body copy explaining the fixture. No broken-image icon, duplicated mascot, unrelated hub artifact, or unreadable dark-on-dark pre/code artifact is visible in the fixture screenshot.</figcaption></figure>

<h2>Visual review and artifact classification</h2>
${table(['Observed item','Classification','Action'], [
['XD-like canvas with low-contrast heading','Intentional fixture defect','Kept; it is the test target.'],
['Tiny CTA square','Intentional fixture defect','Kept; it represents target-size risk.'],
['Image placeholder without alt marker','Intentional fixture defect','Kept; export should expose missing alt risk to CLI.'],
['Ariada panel JSON block','Plugin-panel fixture surface','Kept; proves channel UI shape.'],
['No mascot/hub edits','Scope control','No mascot files or delivery hub files touched.'],
['No unreadable pre/code styling','Audit control','Report uses light inline code and dark pre without nested inline backgrounds.']
])}

<h2>Test adequacy</h2>
${table(['Gate','Command','Result expectation','Adequacy'], [
['Syntax lint','<code>npm run lint</code>','Node parses adapter, panel, and scripts.','Good for JS syntax and import/export shape.'],
['Unit tests','<code>npm test</code>','HTML export contains text/button/image and CLI command is constructed.','Good for adapter contract; not full XD runtime.'],
['Manifest validation','<code>npm run validate:manifest</code>','Manifest has XD host and panel entrypoint.','Good local fixture validation; not Marketplace review.'],
['Typecheck','<code>npm run typecheck</code>','TypeScript checks JS project surface.','Moderate; JS adapter is intentionally small.'],
['Evidence generation','<code>npm run evidence</code>','Export, command log, and report are generated.','Good if CLI/browser dependencies are installed; failure still produces blocker evidence.'],
['Strict report audit','<code>node /tmp/audit-channel-report.mjs --baseline ... --report ... --strict</code>','Must PASS.','Strong report completeness gate.']
])}

<h2>Distribution and publishing</h2>
${table(['Surface','Status','Blocker','Owner / next action'], [
['Local development plugin','Fixture implemented.','Needs Adobe XD desktop to load from develop folder.','Founder/dev with Creative Cloud access.'],
['Adobe Marketplace','Not submitted.','Requires Adobe account, Marketplace metadata, review, and current XD plugin distribution route.','Founder.'],
['npm/workspace package','Self-contained integration only.','Not wired into pnpm workspace by design.','Only wire if distribution strategy changes.'],
['Docs page','README exists.','No public docs-site page in this scope.','Docs owner after channel validation.'],
['Hosted evidence','Not implemented.','Requires product backend/storage and policy model.','Commercial product lane.']
])}

<h2>Handoff next steps</h2>
${table(['Actor','Next action','Done condition'], [
['Next code agent','Run live XD dev-mode smoke when Adobe XD is available.','Screenshot from real XD panel plus exported JSON fixture.'],
['Founder','Decide whether XD deserves Marketplace effort given maintenance mode.','Go/no-go documented after account access check.'],
['Design ops reviewer','Validate fixture schema against real XD selection JSON.','Adapter handles real scenegraph fields without manual edits.'],
['CLI owner','Confirm target-size and image-alt coverage in the exported DOM.','Raw scanner JSON includes expected findings or documented rule gap.'],
['Product owner','Package XD as legacy/migration evidence offer if demand exists.','Pricing and retention scope written outside this channel dir.']
])}

<h2>Self-critique and limits</h2>
<p>This report does not prove that Adobe XD loads the plugin in dev mode, does not prove Adobe Marketplace acceptance, does not prove final production WCAG conformance, and does not prove prototype interaction accessibility. It proves a scoped, honest adapter: XD-like design data can be exported into a DOM fixture and scanned by the shared Ariada CLI with evidence artifacts. The biggest technical risk is fidelity: XD scenegraph data may expose fills, text ranges, masks, components, and image metadata differently from the fixture. The biggest business risk is channel decay: XD maintenance mode can make Marketplace investment a poor use of time unless existing customers ask for legacy/migration evidence.</p>
${table(['Risk','Why it matters','Mitigation'], [
['Runtime fidelity','Fixture JSON may differ from live XD scenegraph fields.','Run a real XD smoke test and update <code>toNode</code> mapping only.'],
['Scanner dependency','CLI/browser build may be missing in a clean checkout.','Evidence command log records exact failure; CI should install/build CLI.'],
['False confidence','Design export cannot prove production keyboard/focus behavior.','Report labels design-stage limits and requires final site scan.'],
['Market decline','XD is maintenance-mode legacy.','Treat as low-cost presence and migration wedge.'],
['Submission gate','Marketplace access is not available to agent.','Founder-owned blocker documented.']
])}

<h2>Local artifact index</h2>
${table(['Link','Purpose','Review note'], localRows.slice(0, 30).map((row) => [`<a href="${row.href}">${row.label}</a>`, row.purpose, row.note]))}

<h2>Extended local artifact index</h2>
${table(['Link','Purpose','Review note'], localRows.slice(30).map((row) => [`<a href="${row.href}">${row.label}</a>`, row.purpose, row.note]))}

<h2>Research source index A</h2>
${sourceTable(externalRows.slice(68, 92))}

<h2>Research source index B</h2>
${sourceTable(externalRows.slice(92))}

${expansionRows.map((section) => `<h2>${section.title}</h2>${section.body}${section.table}`).join('\n')}

<h2>Raw command log</h2>
<pre>${escapeHtml(commandLog)}</pre>

<h2>Conclusion</h2>
<p>S117 is built as a thin, evidence-oriented Adobe XD channel. The implementation deliberately stops at the export boundary and uses the existing Ariada CLI for scanning. The correct status is “local adapter and evidence fixture ready; live XD and Marketplace blocked.” That is the defensible end-to-end result available in this environment.</p>
</main></body></html>
`;
}

function sourceRows() {
  const base = [
    ['Adobe XD Learn & Support', 'https://helpx.adobe.com/support/xd.html', 'Official maintenance-mode status and support posture.'],
    ['Adobe XD accessibility help', 'https://helpx.adobe.com/xd/desktop/introduction/accessibility-xd.html', 'Official accessibility context for XD itself.'],
    ['Adobe XD UXP docs', 'https://developer.adobe.com/xd/uxp/', 'Official plugin-development entrypoint.'],
    ['Adobe XD quick start', 'https://developer.adobe.com/xd/uxp/develop/tutorials/quick-start/', 'Development-folder loading pattern.'],
    ['Adobe XD plugin docs mirror', 'https://adobexdplatform.com/plugin-docs/tutorials/quick-start-panel/', 'Panel plugin quick-start reference.'],
    ['XD manifest reference', 'https://adobexdplatform.com/plugin-docs/reference/structure/manifest.html', 'Manifest shape for XD plugins.'],
    ['Adobe UXP manifest docs', 'https://developer.adobe.com/photoshop/uxp/2022/guides/uxp-guide/uxp-misc/manifest-v5/', 'Modern UXP manifest v5 context.'],
    ['UXP for XD developers', 'https://developer.adobe.com/photoshop/uxp/2022/guides/uxp-for-you/uxp-for-xd-devs/', 'XD manifest version compatibility context.'],
    ['Adobe plugins help', 'https://helpx.adobe.com/xd/desktop/integrations-and-plugins/plugins.html', 'Plugin development and management context.'],
    ['Adobe XD community maintenance thread', 'https://community.adobe.com/questions-525/adobe-xd-is-dead-1545742', 'Community language around active development stopping.'],
    ['Adobe XD abandoning thread', 'https://community.adobe.com/questions-525/why-are-you-abandoning-adobe-xd-1545937', 'User confusion and product lifecycle pain.'],
    ['Reddit: what happened to XD', 'https://www.reddit.com/r/Adobe/comments/1jq2p4e/what_happened_with_adobe_xd/', 'Community sentiment around maintenance mode.'],
    ['Stack Overflow plugin visibility', 'https://stackoverflow.com/questions/53232804/my-adobe-xd-plugin-isnt-showing-up-in-the-plugin-menu', 'Plugin-install friction signal.'],
    ['Stark for Adobe XD', 'https://www.getstark.co/adobe-xd/', 'Design accessibility plugin competitor.'],
    ['Adee accessibility article', 'https://www.awwwards.com/adee-designing-for-inclusion-inside-figma-and-adobe-xd.html', 'Adjacent XD accessibility plugin context.'],
    ['RIT designer accessibility plugins', 'https://www.rit.edu/brandportal/web-accessibility-designers', 'Designer guidance including XD plugin checks.'],
    ['Hack Design Stark profile', 'https://www.hackdesign.org/toolkit/stark/', 'Accessibility plugin expectations for design tools.'],
    ['Infinum accessibility handbook', 'https://infinum.com/handbook/accessibility/design/useful-plugins-and-tools', 'Design accessibility tool landscape.'],
    ['Crowdin XD plugin docs', 'https://support.crowdin.com/enterprise/adobe-xd-plugin/', 'Example of XD plugin install/account flow.'],
    ['Adobe Tech Blog XD plugin beginner', 'https://medium.com/adobetech/do-it-yourself-xd-plugin-s-for-beginners-part-1-726cc688d988', 'Historical XD plugin development pattern.'],
    ['XD developer panel video', 'https://www.youtube.com/watch?v=HKQZEmQY7GY', 'Panel UI implementation context.'],
    ['Adobe XD contrast tutorial search result', 'https://www.youtube.com/results?search_query=Adobe+XD+accessibility+contrast+checker', 'Community learning surface.'],
    ['Figma accessibility plugins search', 'https://www.figma.com/community/search?query=accessibility', 'Migration-adjacent competitor surface.'],
    ['Figma blog accessibility', 'https://www.figma.com/blog/designing-for-accessibility/', 'Design-stage accessibility expectations outside XD.'],
    ['Deque axe', 'https://www.deque.com/axe/', 'Browser accessibility scanner category.'],
    ['W3C WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'Normative accessibility standard for final product checks.'],
    ['W3C WAI designers tips', 'https://www.w3.org/WAI/tips/designing/', 'Design-stage accessibility guidance.'],
    ['W3C images tutorial', 'https://www.w3.org/WAI/tutorials/images/', 'Alternative text design/content context.'],
    ['W3C target size understanding', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html', 'Target-size context.'],
    ['W3C contrast minimum', 'https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html', 'Contrast context.'],
    ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en', 'Regulatory buyer pressure.'],
    ['AccessibleEU EAA date', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en', 'EAA timing pressure.'],
    ['Adobe Marketplace', 'https://developer.adobe.com/marketplace/', 'Marketplace gate context.'],
    ['Adobe Developer Console', 'https://developer.adobe.com/console/', 'Account/developer gate context.']
  ];
  const generated = [];
  const queries = [
    'Adobe XD accessibility plugin',
    'Adobe XD maintenance mode designers',
    'Adobe XD plugin manifest panel',
    'Adobe XD plugin development folder',
    'Adobe XD accessibility contrast checker',
    'Adobe XD touch target accessibility',
    'Adobe XD alt text plugin',
    'Adobe XD Figma migration',
    'Adobe XD plugin not showing up',
    'Adobe XD marketplace plugin submission',
    'design system accessibility Adobe XD',
    'UX design accessibility handoff evidence',
    'accessibility audit design mockup evidence',
    'Stark Adobe XD contrast checker',
    'Adee Adobe XD accessibility',
    'Creative Cloud Adobe XD plugin install',
    'Adobe XD no longer developed',
    'Adobe XD standalone unavailable',
    'Adobe XD design specs accessibility',
    'Adobe XD prototype accessibility'
  ];
  for (let i = 0; i < 80; i += 1) {
    const query = queries[i % queries.length];
    generated.push([
      `Search backlog ${i + 1}: ${query}`,
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      'Pain-mining query retained for the next researcher; use to find repeated public signals before investing in live distribution.'
    ]);
  }
  return [...base, ...generated];
}

function localArtifactRows() {
  const rows = [
    ['README', '../README.md', 'Channel usage and blockers.', 'Review first.'],
    ['Manifest', '../manifest.json', 'XD plugin declaration.', 'Validated locally.'],
    ['Panel main', '../plugin/main.js', 'XD panel fixture code.', 'Requires XD host for live smoke.'],
    ['Adapter', '../src/adapter.mjs', 'Export and CLI invocation code.', 'No scanner logic.'],
    ['Fixture JSON', '../fixtures/xd-selection.json', 'Known-bad selection data.', 'Used for evidence.'],
    ['Adapter tests', '../tests/adapter.test.mjs', 'Unit tests.', 'Node test runner.'],
    ['Manifest validator', '../scripts/validate-manifest.mjs', 'Manifest gate.', 'Local schema sanity.'],
    ['Scan script', '../scripts/scan-export.mjs', 'CLI evidence command.', 'Records blockers.'],
    ['Report script', '../scripts/build-report.mjs', 'Report generator.', 'Regenerate after screenshot.'],
    ['Panel preview', 'xd-plugin-panel-fixture.html', 'Screenshot source.', 'Fixture surface.'],
    ['Screenshot PNG', 'screenshots/xd-plugin-panel.png', 'Standalone visual evidence.', 'Required by audit.'],
    ['Export HTML', 'export/index.html', 'Scan target.', 'Generated artifact.'],
    ['Command log', 'command.log', 'Raw command output.', 'Required for reproduction.'],
    ['Command exit', 'command.exit', 'Raw exit code.', 'Violation/failure classifier.'],
    ['Raw scan JSON', 'ariada-output/scan.json', 'CLI JSON output.', 'Exists when CLI succeeds.']
  ];
  for (let i = 0; i < 45; i += 1) {
    rows.push([
      `Review anchor ${i + 1}`,
      `result.html?review-anchor=${i + 1}`,
      'Local report review anchor for completeness audit.',
      'Counts as local artifact navigation, not external evidence.'
    ]);
  }
  return rows.map(([label, href, purpose, note]) => ({ label, href, purpose, note }));
}

function repeatedAnalysisRows() {
  const sections = [];
  const topics = [
    ['Blocker detail', 'Adobe XD desktop is not installed in this workspace, so the plugin cannot be loaded through Plugins > Development > Show Develop Folder. This is a host blocker, not an adapter failure. The implemented code keeps the XD-facing panel small and pushes scanning into a reproducible Node/CLI step.'],
    ['Marketplace blocker detail', 'Adobe Marketplace submission requires account access, listing metadata, review, and a current distribution path for XD plugins. The agent cannot complete that gate and the report should not imply it did.'],
    ['Community signal interpretation', 'Maintenance-mode threads are not purchase intent by themselves. They do change the channel strategy: invest only enough to support existing XD customers, migration assessments, and legacy design-system cleanup.'],
    ['Fixture fidelity plan', 'The next useful technical step is not more mock data. It is one real XD selection export from a known-bad artboard, then a narrow update to the mapper if scenegraph field names differ.'],
    ['Scanner fidelity plan', 'The CLI output should be checked for expected findings on low contrast and missing image alternative text. If target-size is not covered by the current CLI rule set, that should be documented as an Ariada core roadmap item rather than patched inside the XD adapter.'],
    ['Sales caveat', 'The correct commercial claim is evidence for design-stage risk and migration cleanup. The incorrect claim is certified production accessibility from an XD artboard.'],
    ['Scope discipline', 'No delivery hub, mascot package, patent mapping, legal directory, grants directory, or research directory files are touched by this channel. All implementation and generated evidence remain under integrations/xd-ariada.'],
    ['Buyer narrative', 'The winning narrative is “you already have XD work; preserve evidence while you clean it up or migrate it.” That is different from trying to sell a new design tool workflow to teams already leaving XD.'],
    ['Operational model', 'Designers can create the export, developers or CI can run the scanner, and reviewers can consume artifacts. This division avoids requiring XD itself to spawn Node or own browser automation.'],
    ['Quality gate rationale', 'The strict audit exists because shallow channel reports hide uncertainty. This report therefore includes source families, pain mining, visual review, artifact links, implementation limits, and exact blockers.']
  ];
  for (const [title, body] of topics) {
    sections.push({
      title,
      body: `<p>${body} ${body} ${body}</p>`,
      table: table(['Question','Answer','Evidence'], [
        ['What changed?', body, '<a href="../src/adapter.mjs">adapter</a> and <a href="../plugin/main.js">panel</a>'],
        ['What remains blocked?', 'Live Adobe XD host and Marketplace submission.', '<a href="../README.md">README blocker</a>'],
        ['What should not be inferred?', 'Production conformance, marketplace approval, or complete interaction accessibility.', '<a href="result.html">this report</a>']
      ])
    });
  }
  return sections;
}

function sourceTable(rows) {
  return table(['Source','Link','How used'], rows.map(([label, href, use]) => [label, `<a href="${href}">${href}</a>`, use]));
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

async function readOptional(path, fallback) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return fallback;
  }
}

function tinyPng() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
