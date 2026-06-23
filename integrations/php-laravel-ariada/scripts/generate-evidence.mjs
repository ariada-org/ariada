#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
 existsSync,
 mkdirSync,
 readFileSync,
 writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const integrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(integrationDir, '..', '..');
const evidenceDir = join(integrationDir, 'scan-evidence');
const outputDir = join(evidenceDir, 'ariada-output');
const fixturePath = join(integrationDir, 'fixtures', 'laravel-dashboard.html');
const screenshotPath = join(evidenceDir, 's98-laravel-scan.png');
const pagePath = join(evidenceDir, '_capture.html');
const resultPath = join(evidenceDir, 'result.html');
const testReportPath = join(integrationDir, 'test-report', 'result.html');

mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(testReportPath), { recursive: true });

function escapeHtml(value) {
 return String(value)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;');
}

function startFixtureServer() {
 const fixture = readFileSync(fixturePath);
 const server = createServer((req, res) => {
 if (req.url === '/chart.png') {
 res.writeHead(404, { 'Content-Type': 'text/plain' });
 res.end('not found');
 return;
 }
 res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
 res.end(fixture);
 });

 return new Promise((resolveServer) => {
 server.listen(0, '127.0.0.1', () => {
 const address = server.address();
 resolveServer({ server, url: `http://127.0.0.1:${address.port}/dashboard` });
 });
 });
}

function run(command, args, options = {}) {
 const startedAt = Date.now();
 const result = spawnSync(command, args, {
 cwd: repoRoot,
 encoding: 'utf8',
 timeout: options.timeout ?? 120_000,
...options,
 });

 return {
 command: [command,...args].join(' '),
 status: result.error ? 124: (result.status ?? 1),
 stdout: result.stdout ?? '',
 stderr: `${result.stderr ?? ''}${result.error ? `\n${result.error.message}`: ''}`.trim(),
 durationMs: Date.now() - startedAt,
 };
}

function renderCapturePage({ fixtureUrl, scanRun, structureRun, reportJson }) {
 const captureLabel = [0, 1].includes(scanRun.status) ? 'REAL SCAN CAPTURE': 'SCAN BLOCKER CAPTURE';
 const captureDescription = [0, 1].includes(scanRun.status)
 ? 'Representative rendered Laravel Blade dashboard scanned by the shared @ariada-org/cli.'
: 'Representative rendered Laravel Blade dashboard sent to the shared @ariada-org/cli; this capture records the exact blocker instead of faking a pass.';

 return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S98 Laravel Ariada scan evidence capture</title>
<style>
 body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
 main { max-width: 1100px; margin: 0 auto; padding: 28px; }
 h1 { font-size: 1.7rem; margin: 0 0 8px; }
 h2 { font-size: 1.1rem; margin: 24px 0 8px; }
.badge { display: inline-block; border: 2px solid #0b5f2a; color: #0b5f2a; background: #eaf7ef; border-radius: 6px; padding: 4px 10px; font-weight: 700; }
.warn { border-color: #946200; color: #6f4a00; background: #fff4d6; }
 code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
 pre { white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; overflow: auto; }
 table { border-collapse: collapse; width: 100%; background: #fff; }
 th, td { border-bottom: 1px solid #dbe2ea; padding: 8px 10px; text-align: left; vertical-align: top; }
</style>
</head>
<body>
<main>
 <h1>S98 PHP Composer package + Laravel integration</h1>
 <p><span class="badge">${escapeHtml(captureLabel)}</span> ${escapeHtml(captureDescription)}</p>
 <table>
 <tbody>
 <tr><th scope="row">Fixture URL</th><td><code>${escapeHtml(fixtureUrl)}</code></td></tr>
 <tr><th scope="row">Structure check</th><td><code>${escapeHtml(structureRun.command)}</code> exit ${structureRun.status}</td></tr>
 <tr><th scope="row">Ariada scan</th><td><code>${escapeHtml(scanRun.command)}</code> exit ${scanRun.status}</td></tr>
 <tr><th scope="row">Finding count</th><td>${escapeHtml(reportJson?.summary?.total ?? 'see scan log')}</td></tr>
 </tbody>
 </table>
 <h2>Scan stdout</h2>
 <pre>${escapeHtml(scanRun.stdout || '(empty)')}</pre>
 <h2>Scan stderr</h2>
 <pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
 <h2>Machine report excerpt</h2>
 <pre>${escapeHtml(JSON.stringify(reportJson?.summary ?? reportJson ?? {}, null, 2))}</pre>
</main>
</body>
</html>`;
}

function renderResult({ fixtureUrl, scanRun, structureRun, reportJson, screenshotDataUrl }) {
 const ok = structureRun.status === 0 && [0, 1].includes(scanRun.status) && screenshotDataUrl;
 const blocker = !ok
 ? 'PHP and Composer are not available in this environment, and the local shared CLI scan hit the evidence-generator timeout. The package code is present with mocked PHPUnit/Testbench tests, structure validation passes, and this report preserves the exact blocked command, stderr, and screenshot evidence instead of pretending the live host passed.'
: 'Packagist publication remains a founder-owned human gate: Packagist account, repository submit, and release tag.';
 const screenshotLink = './s98-laravel-scan.png';
 const scanStatus = [0, 1].includes(scanRun.status) ? 'real shared CLI scan completed': 'scan command blocked or timed out';
 const findingCount = reportJson?.summary?.total ?? 'not available because scan did not produce scan.json';

 return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S98 PHP/Laravel Ariada evidence</title>
<style>
 body { margin: 0; font: 16px/1.55 system-ui, sans-serif; color: #15181d; background: #fafbfc; }
 a { color: #075da8; }
 header, main, footer { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
 header { padding-top: 30px; }
 h1 { font-size: 1.9rem; margin: 0 0 6px; }
 h2 { font-size: 1.25rem; margin: 28px 0 10px; border-bottom: 1px solid #d8dee6; padding-bottom: 6px; }
 h3 { font-size: 1rem; margin: 20px 0 6px; }
 p { max-width: 78ch; }
.badge { display: inline-block; border-radius: 7px; padding: 5px 11px; font-weight: 700; border: 2px solid; }
.ok { color: #0b6b2f; border-color: #0b6b2f; background: #e8f7ed; }
.warn { color: #7a5200; border-color: #a36b00; background: #fff5d8; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.panel { border: 1px solid #d8dee6; border-radius: 8px; padding: 14px; background: #fff; }
 table { border-collapse: collapse; width: 100%; }
 th, td { border-bottom: 1px solid #e0e5eb; padding: 8px 10px; text-align: left; vertical-align: top; }
 code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
 code { background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
 pre { white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; overflow: auto; max-height: 420px; }
 figure { margin: 0; border: 1px solid #d8dee6; border-radius: 8px; overflow: hidden; background: #fff; }
 img { display: block; width: 100%; height: auto; }
 figcaption { padding: 10px 14px; }
 footer { color: #5b6470; margin: 36px auto; }
</style>
</head>
<body>
<header>
 <h1>S98 PHP Composer package + Laravel integration evidence</h1>
 <p><span class="badge ${ok ? 'ok': 'warn'}">${ok ? 'REVIEW READY': 'HOST BLOCKED / SCAN TIMEOUT'}</span></p>
</header>
<main>
 <h2>What this channel is</h2>
 <p><strong>PHP Composer + Laravel</strong> is the distribution channel for PHP teams that already ship server-rendered Laravel applications and need repeatable accessibility evidence in release review. Composer is the package path, Laravel auto-discovery is the adoption path, and Artisan is the workflow hook developers already use in CI and local release checks.</p>
 <p>The package adds <code>php artisan ariada:scan {url?}</code>, a Laravel service provider, publishable config, and a framework-neutral PHP wrapper that invokes the shared <code>@ariada-org/cli</code>. It is not a PHP scanner fork: Ariada domain logic stays in the existing Node CLI and core engine.</p>

 <h2>Why this is a separate channel</h2>
 <p>Laravel agencies, SME product teams, public-sector vendors, and SaaS teams often cannot replace their PHP stack just to satisfy accessibility review. This channel lets them add Ariada evidence to an existing Laravel release flow through Composer and Artisan. The wedge is narrow: make the existing Laravel estate produce raw JSON, command logs, screenshot evidence, and a stable HTML report before publishing.</p>

 <h2>Roles, payers, and hooks</h2>
 <table>
 <thead><tr><th scope="col">Role</th><th scope="col">What they need</th><th scope="col">Ariada offer</th><th scope="col">Likely payer</th><th scope="col">First hook</th></tr></thead>
 <tbody>
 <tr><th scope="row">Laravel developer</th><td>A command that runs locally and in CI without replacing the app.</td><td><code>php artisan ariada:scan</code> over the shared CLI.</td><td>No, but they trigger adoption.</td><td>Composer install, Artisan command, README snippet.</td></tr>
 <tr><th scope="row">CI/platform owner</th><td>Stable release gate and machine-readable artifacts.</td><td>Exit codes, JSON report, deterministic command log.</td><td>Often budget owner for engineering tooling.</td><td>GitHub Actions/GitLab CI step around Artisan.</td></tr>
 <tr><th scope="row">Product owner / agency lead</th><td>Evidence attached to release tickets and client handoff.</td><td>HTML evidence report with screenshot and blocker status.</td><td>Yes for agency/client delivery.</td><td>Per-project compliance package.</td></tr>
 <tr><th scope="row">Accessibility/compliance reviewer</th><td>Repeatable proof, not a screenshot-only claim.</td><td>Raw CLI JSON, logs, report, screenshot, and human blockers.</td><td>Yes in regulated procurement.</td><td>Review ticket attachment.</td></tr>
 </tbody>
 </table>

 <h2>Implemented surface</h2>
 <table>
 <tbody>
 <tr><th scope="row">Package path</th><td><code>integrations/php-laravel-ariada</code></td></tr>
 <tr><th scope="row">Composer package</th><td><code>ariada/laravel-accessibility</code></td></tr>
 <tr><th scope="row">Laravel command</th><td><code>php artisan ariada:scan {url?}</code></td></tr>
 <tr><th scope="row">Core dependency</th><td>Shared <code>@ariada-org/cli</code>, specifically <code>ariada scan &lt;url&gt; --domains accessibility --format json</code>; domain logic is not reimplemented in PHP.</td></tr>
 <tr><th scope="row">Representative surface</th><td><code>${escapeHtml(fixtureUrl)}</code>, static Laravel Blade-style dashboard HTML with an image missing alt text and an empty button.</td></tr>
 <tr><th scope="row">What is implemented</th><td>Composer metadata, Laravel auto-discovery provider, publishable config, injectable CLI runner, scanner wrapper, scan result parser, Artisan command, mocked PHPUnit/Testbench tests, structure validator, evidence generator.</td></tr>
 <tr><th scope="row">What is not implemented</th><td>Packagist publication, live Laravel application smoke with Composer dependencies, PHP lint/Pint/PHPUnit execution in this machine, hosted API fallback, route auto-discovery beyond a configured/default URL.</td></tr>
 <tr><th scope="row">Current scan status</th><td>${escapeHtml(scanStatus)}; finding count: ${escapeHtml(findingCount)}.</td></tr>
 <tr><th scope="row">Human blocker</th><td>${escapeHtml(blocker)}</td></tr>
 </tbody>
 </table>

 <h2>Domain roadmap and applicability</h2>
 <table>
 <thead><tr><th scope="col">Domain</th><th scope="col">Applicability to Laravel</th><th scope="col">Status in this channel</th></tr></thead>
 <tbody>
 <tr><th scope="row">Accessibility</th><td>Primary wedge: rendered Blade pages, dashboards, forms, checkout, account pages.</td><td>Implemented as the first default domain through shared CLI.</td></tr>
 <tr><th scope="row">Privacy / GDPR</th><td>Useful for cookie banners, forms, analytics scripts, consent surfaces.</td><td>Config can pass domains once core CLI domain is chosen; not default yet.</td></tr>
 <tr><th scope="row">Security</th><td>Useful for CSP/SRI/client-side findings on Laravel-rendered pages.</td><td>Future domain toggle; not PHP-specific logic.</td></tr>
 <tr><th scope="row">Performance</th><td>Relevant for public Laravel sites and dashboards with heavy tables/charts.</td><td>Needs Ariada performance domain PRD/package before this channel can expose it honestly.</td></tr>
 <tr><th scope="row">SEO and GEO/AIEO</th><td>Relevant for public marketing, docs, marketplaces, and content-heavy Laravel sites.</td><td>Candidate future toggle after Ariada SEO/GEO domains exist in core.</td></tr>
 <tr><th scope="row">i18n/localization</th><td>Relevant for EU multilingual Laravel sites, locale routing, hreflang, RTL surfaces.</td><td>Candidate future toggle.</td></tr>
 <tr><th scope="row">Payments / PCI-adjacent</th><td>Relevant if the Laravel app hosts checkout or payment forms.</td><td>Out of scope for v0.1; future narrow domain after product PRD.</td></tr>
 <tr><th scope="row">Data provenance</th><td>Relevant for analytics dashboards and public data portals built in Laravel.</td><td>Candidate future domain; needs fixture set and rules.</td></tr>
 </tbody>
 </table>

 <h2>Narrow competitors</h2>
 <p>The direct competitor is not Laravel itself. The narrow channel is release evidence for existing Laravel/PHP apps.</p>
 <table>
 <thead><tr><th scope="col">Category</th><th scope="col">Examples</th><th scope="col">Ariada difference</th></tr></thead>
 <tbody>
 <tr><th scope="row">General a11y scanners</th><td>axe CLI, Pa11y, Lighthouse CI, Accessibility Insights.</td><td>Ariada packages scanner output as reviewer evidence with domain roadmap and release-handoff context.</td></tr>
 <tr><th scope="row">PHP QA tools</th><td>PHPUnit, Pest, Laravel Pint, PHPStan, Psalm.</td><td>These validate PHP code quality; Ariada validates rendered web evidence.</td></tr>
 <tr><th scope="row">CI evidence tools</th><td>GitHub Actions artifacts, GitLab job reports, custom QA dashboards.</td><td>Ariada provides a domain-specific report and raw scanner JSON rather than only logs.</td></tr>
 <tr><th scope="row">Enterprise accessibility suites</th><td>Deque, Siteimprove, Evinced, Level Access.</td><td>Ariada is positioned as a lightweight OSS-friendly adapter for existing PHP delivery flows, not a proprietary dashboard-first suite.</td></tr>
 </tbody>
 </table>

 <h2>Evidence screenshot</h2>
 ${
 screenshotDataUrl
 ? `<figure><a href="${screenshotLink}"><img src="${screenshotDataUrl}" alt="Screenshot of the S98 Laravel representative surface scan result, including fixture URL, CLI command, stdout, stderr, and finding summary." /></a><figcaption>Embedded screenshot from the local scan evidence page. <a href="${screenshotLink}">Open standalone PNG screenshot</a>.</figcaption></figure>`
: '<p>No screenshot could be captured because Playwright was unavailable.</p>'
 }

 <h2>Evidence artifacts</h2>
 <table>
 <thead><tr><th scope="col">Artifact</th><th scope="col">Path</th><th scope="col">Purpose</th></tr></thead>
 <tbody>
 <tr><th scope="row">Reviewer report</th><td><code>scan-evidence/result.html</code></td><td>This rich channel report.</td></tr>
 <tr><th scope="row">Standalone screenshot</th><td><a href="${screenshotLink}"><code>scan-evidence/s98-laravel-scan.png</code></a></td><td>Openable full-size evidence screenshot.</td></tr>
 <tr><th scope="row">Capture page</th><td><code>scan-evidence/_capture.html</code></td><td>HTML page used as screenshot source.</td></tr>
 <tr><th scope="row">Machine output</th><td><code>scan-evidence/ariada-output/scan.json</code></td><td>Expected CLI JSON output when the real scan completes.</td></tr>
 <tr><th scope="row">Concise test report</th><td><code>test-report/result.html</code></td><td>Short command/gate summary for the coordinator.</td></tr>
 </tbody>
 </table>

 <h2>Verification commands and adequacy</h2>
 <table>
 <thead><tr><th scope="col">Gate</th><th scope="col">Command</th><th scope="col">Exit</th></tr></thead>
 <tbody>
 <tr><th scope="row">Structure</th><td><code>${escapeHtml(structureRun.command)}</code></td><td>${structureRun.status}</td></tr>
 <tr><th scope="row">Shared CLI scan</th><td><code>${escapeHtml(scanRun.command)}</code></td><td>${scanRun.status}</td></tr>
 <tr><th scope="row">Composer</th><td><code>composer validate</code>, <code>composer install</code>, <code>vendor/bin/phpunit</code>, <code>vendor/bin/pint --test</code></td><td>host blocked: no php/composer in this environment</td></tr>
 </tbody>
 </table>
 <p>The test is adequate for adapter structure and command wiring: it proves the Composer package shape, Laravel provider registration path, command name, injected scanner path, and evidence generation harness exist. It is not adequate for claiming a live Laravel package release: PHP/Composer/Testbench/Pint must run on a PHP-enabled host, and the shared CLI scan timeout must be resolved before marking the channel review-ready.</p>

 <h2>Distribution and publishing next steps</h2>
 <ol>
 <li>Run <code>composer validate</code>, <code>composer install</code>, <code>vendor/bin/phpunit</code>, and <code>vendor/bin/pint --test</code> on a PHP 8.1+ host.</li>
 <li>Resolve the local shared CLI scan timeout or document the exact Playwright/browser host dependency if it reproduces.</li>
 <li>Tag a package release and submit <code>ariada/laravel-accessibility</code> to Packagist after founder confirms namespace/account access.</li>
 <li>Add CI snippets for GitHub Actions and GitLab once Composer tests pass.</li>
 <li>Coordinator should update the Delivery Hub only after integrating this branch and linking this report plus the concise test report.</li>
 </ol>

 <h2>Scan stdout</h2>
 <pre>${escapeHtml(scanRun.stdout || '(empty)')}</pre>
 <h2>Scan stderr</h2>
 <pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
 <h2>Machine summary</h2>
 <pre>${escapeHtml(JSON.stringify(reportJson?.summary ?? reportJson ?? {}, null, 2))}</pre>

 <h2>Coordinator hub row note</h2>
 <p>Do not edit the hub from this worktree. Coordinator row suggestion for S98: <strong>CODE_READY / HOST_BLOCKED</strong> until PHP/Composer gates and shared CLI scan finish; link <code>integrations/php-laravel-ariada/scan-evidence/result.html</code>, <code>integrations/php-laravel-ariada/test-report/result.html</code>, and list Packagist publication as the founder human gate.</p>
</main>
<footer>
 <p>Ariada S98 evidence. Self-contained HTML with embedded screenshot; safe to open offline.</p>
</footer>
</body>
</html>`;
}

function renderTestReport({ structureRun, scanRun, screenshotDataUrl }) {
 return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>S98 PHP/Laravel test report</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:30px auto;padding:0 20px}code,pre{font-family:ui-monospace,monospace}pre{background:#111827;color:#fff;padding:12px;border-radius:8px;overflow:auto}</style></head>
<body>
<h1>S98 PHP/Laravel test report</h1>
<ul>
 <li>Structure validator: exit ${structureRun.status}</li>
 <li>Shared CLI scan command: exit ${scanRun.status}</li>
 <li>Screenshot captured: ${screenshotDataUrl ? 'yes': 'no'}</li>
 <li>PHP/Composer/PHPUnit/Pint: host blocked in this environment.</li>
</ul>
<p>Reviewer-ready report: <a href="../scan-evidence/result.html">scan-evidence/result.html</a>.</p>
<h2>Scan stderr</h2>
<pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
</body>
</html>`;
}

const structureRun = run('node', ['integrations/php-laravel-ariada/scripts/validate-structure.mjs']);

let scanRun = {
 command: 'node packages/ariada-cli/dist/bin.js scan <fixture>',
 status: 1,
 stdout: '',
 stderr: 'scan not attempted',
 durationMs: 0,
};
let fixtureUrl = 'host-blocked://laravel-fixture';
let reportJson = {};

const { server, url } = await startFixtureServer();
fixtureUrl = url;
try {
 const buildRun = run('pnpm', ['--filter', '@ariada-org/cli', 'build']);
 if (buildRun.status !== 0) {
 scanRun = {
...buildRun,
 command: `${buildRun.command} && node packages/ariada-cli/dist/bin.js scan ${fixtureUrl}`,
 };
 } else {
 scanRun = run('node', [
 'packages/ariada-cli/dist/bin.js',
 'scan',
 fixtureUrl,
 '--domains',
 'accessibility',
 '--format',
 'both',
 '--output-dir',
 outputDir,
 '--severity-threshold',
 'serious',
 '--timeout-ms',
 '5000',
 ], { timeout: 15_000 });
 const scanJsonPath = join(outputDir, 'scan.json');
 if (existsSync(scanJsonPath)) {
 reportJson = JSON.parse(readFileSync(scanJsonPath, 'utf8'));
 }
 }
} finally {
 server.close();
}

writeFileSync(pagePath, renderCapturePage({ fixtureUrl, scanRun, structureRun, reportJson }), 'utf8');

let screenshotDataUrl = '';
try {
 const playwrightPath = join(
 repoRoot,
 'node_modules',
 '.pnpm',
 'playwright@1.61.0',
 'node_modules',
 'playwright',
 'index.js',
);
 const playwrightModule = await import(playwrightPath);
 const playwright = playwrightModule.default ?? playwrightModule;
 const browser = await playwright.chromium.launch({ headless: true });
 const page = await browser.newPage({ viewport: { width: 1280, height: 980 } });
 await page.goto(`file://${pagePath}`);
 await page.screenshot({ path: screenshotPath, fullPage: true });
 await browser.close();
 screenshotDataUrl = `data:image/png;base64,${readFileSync(screenshotPath).toString('base64')}`;
} catch (error) {
 writeFileSync(join(evidenceDir, 'playwright-blocker.txt'), String(error), 'utf8');
}

writeFileSync(resultPath, renderResult({ fixtureUrl, scanRun, structureRun, reportJson, screenshotDataUrl }), 'utf8');
writeFileSync(testReportPath, renderTestReport({ structureRun, scanRun, screenshotDataUrl }), 'utf8');
console.log(`wrote ${resultPath}`);
console.log(`wrote ${testReportPath}`);
if (screenshotDataUrl) {
 console.log(`embedded screenshot ${basename(screenshotPath)}`);
}

if (structureRun.status !== 0 || !screenshotDataUrl) {
 process.exit(1);
}
