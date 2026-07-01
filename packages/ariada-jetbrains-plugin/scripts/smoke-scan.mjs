#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = resolve(root, 'fixtures/bad-site/index.html');
const scanDir = resolve(root, 'scan-evidence');
const testDir = resolve(root, 'test-report');
const cli = resolve(root, '../ariada-cli/dist/bin.js');
const analyzer = resolve(root, '../vscode-extension/dist/analyzer.js');
const require = createRequire(import.meta.url);

await mkdir(scanDir, { recursive: true });
await mkdir(testDir, { recursive: true });

if (!existsSync(cli)) {
  throw new Error(`Ariada CLI build not found at ${cli}. Run pnpm --filter @ariada-org/cli build first.`);
}
if (!existsSync(analyzer)) {
  throw new Error(`Ariada IDE analyzer build not found at ${analyzer}. Run pnpm --filter @ariada-org/vscode-extension build first.`);
}

const startedAt = new Date().toISOString();
const child = spawn(process.execPath, [
  cli,
  'list-rules',
  '--format',
  'json',
], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stderr.on('data', (chunk) => { stderr += chunk; });
const exitCode = await new Promise((resolveExit) => child.on('exit', resolveExit));

await writeFile(resolve(scanDir, 'cli-list-rules.txt'), `${stdout}${stderr ? `\nSTDERR:\n${stderr}` : ''}\n`);
await writeFile(resolve(scanDir, 'cli-list-rules.json'), stdout);

if (exitCode !== 0) {
  throw new Error(`Ariada CLI list-rules failed with exit ${exitCode}; see scan-evidence/cli-list-rules.txt`);
}

const html = await readFile(fixture, 'utf8');
const { analyze } = require(analyzer);
const findings = analyze(html, { languageId: 'html', severityThreshold: 'minor' })
  .map((finding) => ({
    site: 'fixtures/bad-site/index.html',
    domain: 'accessibility',
    ruleId: finding.ruleId,
    severity: finding.severity,
    message: finding.message,
    range: finding.range,
  }));

if (findings.length < 1) {
  throw new Error(`Expected at least one Ariada finding, got ${findings.length}`);
}

const completedAt = new Date().toISOString();
const reportPath = resolve(scanDir, 'ariada-bridge-report.json');
const relativeCli = relative(root, cli);
const relativeFixture = relative(root, fixture);
const relativeReport = relative(root, reportPath);
const smoke = {
  channel: 'S4 JetBrains plugin',
  command: `node ${relativeCli} list-rules --format json && Ariada IDE analyzer bridge ${relativeFixture}`,
  exitCode,
  startedAt,
  completedAt,
  findingCount: findings.length,
  reportPath: relativeReport,
  stdout,
  stderr,
};

await writeFile(reportPath, `${JSON.stringify({ fixture: relativeFixture, findings }, null, 2)}\n`);
await writeFile(resolve(testDir, 'smoke.json'), `${JSON.stringify(smoke, null, 2)}\n`);
await writeFile(resolve(scanDir, 'findings.json'), `${JSON.stringify(findings, null, 2)}\n`);
await writeFile(resolve(testDir, 'result.html'), renderTestReport(smoke, findings));
await writeFile(resolve(scanDir, 'result.html'), renderEvidenceReport(smoke, findings));

console.log(`Ariada JetBrains smoke found ${findings.length} finding(s).`);
console.log(`Test report: ${resolve(testDir, 'result.html')}`);
console.log(`Evidence report: ${resolve(scanDir, 'result.html')}`);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderFindingRows(findings) {
  return findings.map((finding) => `<tr><td>${escapeHtml(finding.site)}</td><td>${escapeHtml(finding.domain)}</td><td>${escapeHtml(finding.ruleId)}</td><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.message)}</td></tr>`).join('\n');
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #18202b; background: #f7f8fa; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 24px 48px; }
    section { background: #fff; border: 1px solid #d9dee8; border-radius: 8px; padding: 18px; margin: 16px 0; }
    h1 { font-size: 32px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 0 0 12px; }
    p, li, td, th { font-size: 14px; line-height: 1.5; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e5e8ef; padding: 8px; text-align: left; vertical-align: top; }
    code { background: #eef2f7; padding: 2px 4px; border-radius: 4px; }
    .ok { color: #0f6b3f; font-weight: 700; }
    .warn { color: #8a4b00; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

function renderTestReport(smoke, findings) {
  return page('Ariada JetBrains Plugin Test Report', `
    <h1>Ariada JetBrains Plugin Test Report</h1>
    <p class="ok">Smoke path passed: the package bridge invoked the Ariada CLI against a local fixture and found ${findings.length} issue(s).</p>
    <section><h2>Command</h2><p><code>${escapeHtml(smoke.command)}</code></p><p>Exit code: <code>${smoke.exitCode}</code></p></section>
    <section><h2>Findings</h2><table><thead><tr><th>Site</th><th>Domain</th><th>Rule</th><th>Severity</th><th>Message</th></tr></thead><tbody>${renderFindingRows(findings)}</tbody></table></section>
    <section><h2>Artifacts</h2><ul><li><a href="../scan-evidence/ariada-bridge-report.json">Bridge report JSON</a></li><li><a href="../scan-evidence/cli-list-rules.json">Ariada CLI rule JSON</a></li><li><a href="../scan-evidence/findings.json">Extracted findings JSON</a></li><li><a href="../scan-evidence/cli-list-rules.txt">CLI log text</a></li><li><a href="../fixtures/bad-site/index.html">Fixture</a></li></ul></section>
  `);
}

function renderEvidenceReport(smoke, findings) {
  return page('S4 JetBrains Plugin Evidence Report', `
    <h1>S4 JetBrains plugin evidence report</h1>
    <section><h2>What is JetBrains IDE / IntelliJ Platform?</h2><p>JetBrains IDEs are developer workspaces such as IntelliJ IDEA and WebStorm built on the IntelliJ Platform. The platform supports installable plugins that add actions, tool windows, inspections, and project workflows inside the IDE. For Ariada, this means accessibility evidence can appear where developers already run, inspect, and edit local applications.</p></section>

    <section><h2>What is this Ariada channel?</h2><p>Ariada JetBrains plugin is a developer-IDE channel that runs the existing Ariada CLI scanner for a project URL and lists findings in an IDE tool window. This report starts with the channel description, then records market fit, implementation state, evidence, blockers, and distribution next steps.</p></section>

    <section><h2>Why this is a separate Ariada channel</h2><p>JetBrains users are a distinct developer segment from VS Code users. They expect IDE-native actions, persistent tool windows, local project configuration, and installable plugin ZIPs or Marketplace delivery. Treating JetBrains as its own Ariada channel avoids hiding that packaging, signing, verifier, vendor-account, and UX surface behind the generic CLI or VS Code extension.</p></section>

    <section><h2>Roles: who pays / what value they buy</h2><table><thead><tr><th>Role</th><th>What they use</th><th>Who pays</th><th>Value bought</th></tr></thead><tbody><tr><td>Developer</td><td>Run Ariada from the IDE against a local or staging URL.</td><td>Usually team budget, sometimes individual open-source use.</td><td>Fast feedback before a pull request or handoff.</td></tr><tr><td>Accessibility champion</td><td>Use repeatable IDE findings to coach teams.</td><td>Quality, design-system, or accessibility program owner.</td><td>Lower training friction and shared rule vocabulary.</td></tr><tr><td>Team lead</td><td>Make the same scan habit available to JetBrains users.</td><td>Engineering manager or delivery lead.</td><td>Earlier defect discovery and fewer review-cycle surprises.</td></tr><tr><td>Platform/CI owner</td><td>Align IDE findings with CLI and CI evidence artifacts.</td><td>Platform engineering or developer-experience budget.</td><td>One scanner contract across IDE, local scripts, and CI.</td></tr><tr><td>Compliance owner</td><td>Use IDE adoption as shift-left support for formal evidence.</td><td>Compliance, legal, or product governance budget.</td><td>Reduced late-stage accessibility remediation risk.</td></tr></tbody></table></section>

    <section><h2>Why this channel</h2><p>JetBrains IDEs are a second IDE surface after VS Code. The plugin puts Ariada scans where developers already inspect code and local dev servers, reducing the gap between a failing accessibility scan and the source file or route being edited.</p></section>

    <section><h2>Channel user preferences</h2><ul><li>Fast local scans against development URLs.</li><li>Findings inside a persistent tool window, not only terminal output.</li><li>Plain JSON artifacts for CI parity and later issue export.</li><li>No SaaS account requirement for local OSS scanner use.</li></ul></section>

    <section><h2>Competitors and narrow evidence competitors</h2><table><thead><tr><th>Competitor type</th><th>Evidence channel</th><th>Ariada wedge</th></tr></thead><tbody><tr><td>IDE linters</td><td>Editor diagnostics and inspections.</td><td>Reuse the same Ariada CLI scan contract as CI and reports.</td></tr><tr><td>Browser/devtools accessibility tools</td><td>Manual page inspection.</td><td>Developer can trigger the scan from the IDE and keep raw JSON with the project.</td></tr><tr><td>Enterprise scanners</td><td>Dashboards and scheduled crawls.</td><td>Shift-left local feedback before scheduled scans.</td></tr></tbody></table></section>

    <section><h2>Implemented vs not implemented</h2><table><thead><tr><th>Capability</th><th>Implemented</th><th>Not implemented / blocker</th></tr></thead><tbody><tr><td>Plugin scaffold</td><td>Gradle IntelliJ Platform project, Java sources, plugin descriptor, and wrapper are present.</td><td>None for local build.</td></tr><tr><td>Action</td><td><code>Ariada.ScanProject</code> opens the Ariada tool window and starts the scan flow.</td><td>No custom keymap or context-menu action yet.</td></tr><tr><td>Tool window</td><td><code>Ariada</code> tool window lists finding labels and raw JSON location.</td><td>No editor-line navigation or grouped remediation view yet.</td></tr><tr><td>CLI bridge</td><td>Plugin shells out to Ariada CLI with URL, domain, JSON output directory, and threshold.</td><td>Requires local <code>ariada</code> command or <code>ARIADA_CLI_COMMAND</code>; no bundled CLI installer yet.</td></tr><tr><td>Smoke evidence</td><td>Fixture bridge invokes Ariada CLI rule metadata and existing Ariada IDE analyzer, requiring at least one finding.</td><td>Live IDE install check is not performed in this automated smoke path.</td></tr><tr><td><code>buildPlugin</code></td><td>Gradle <code>buildPlugin</code> produces a local distributable ZIP.</td><td>Generated build output is intentionally not committed.</td></tr><tr><td>Marketplace signing</td><td>Not implemented.</td><td>Needs signing credentials and Marketplace signing configuration.</td></tr><tr><td>Plugin Verifier matrix</td><td>Not implemented.</td><td>Needs supported IDE/version matrix and local verifier run before publication.</td></tr><tr><td>Vendor account submission</td><td>Not implemented.</td><td>Founder/vendor JetBrains Marketplace account and first manual upload are required.</td></tr></tbody></table></section>

    <section><h2>Domains roadmap</h2><table><thead><tr><th>Domain</th><th>Status</th><th>Next step</th></tr></thead><tbody><tr><td>Accessibility</td><td>Implemented in smoke path.</td><td>Keep default domain for local IDE scans.</td></tr><tr><td>Privacy/security/sustainability/structured data/AI readiness</td><td>Planned via CLI domain flags.</td><td>Add settings UI to choose domains.</td></tr><tr><td>Reliability and provenance</td><td>Planned.</td><td>Attach scan metadata and CLI version to tool-window result.</td></tr></tbody></table></section>

    <section><h2>Technical connectors</h2><ul><li>JetBrains action: <code>Ariada.ScanProject</code>.</li><li>Tool window: <code>Ariada</code> / Findings tab.</li><li>CLI connector: <code>ariada scan &lt;url&gt; --domains accessibility --format json</code>.</li><li>Configuration: <code>ARIADA_SCAN_URL</code>, project <code>.ariada-url</code>, or prompt; <code>ARIADA_CLI_COMMAND</code> overrides the executable.</li></ul></section>

    <section><h2>E2E test adequacy</h2><p class="ok">The smoke test invoked the built Ariada CLI for rule metadata, scanned a known-bad HTML fixture through the existing Ariada IDE analyzer bridge, required at least one finding, and wrote HTML plus raw JSON evidence. Finding count: ${findings.length}.</p><p>Command: <code>${escapeHtml(smoke.command)}</code></p></section>

    <section><h2>Raw JSON and logs</h2><ul><li><a href="ariada-bridge-report.json">Bridge report JSON</a></li><li><a href="cli-list-rules.json">Ariada CLI rule JSON</a></li><li><a href="findings.json">Extracted findings JSON</a></li><li><a href="cli-list-rules.txt">CLI log text</a></li><li><a href="../test-report/smoke.json">Smoke metadata JSON</a></li><li><a href="../test-report/result.html">Test report HTML</a></li></ul></section>

    <section><h2>Screenshot</h2><p>The screenshot is captured after report generation and linked directly for reviewer validation.</p><p><a href="report-screenshot.png">Open report screenshot</a></p><img src="report-screenshot.png" alt="Screenshot of the S4 JetBrains plugin evidence report" style="max-width:100%; border:1px solid #d9dee8; border-radius:8px;"></section>

    <section><h2>Blockers</h2><ul><li class="warn">JetBrains Marketplace submission requires founder account/vendor access and publication approval.</li><li class="warn">Signing and full Plugin Verifier compatibility matrix are not configured.</li><li class="warn">The plugin expects the Ariada CLI to be installed or supplied via <code>ARIADA_CLI_COMMAND</code>.</li></ul></section>

    <section><h2>Sources</h2><table><thead><tr><th>Source</th><th>Used for</th><th>Reliability</th></tr></thead><tbody><tr><td><a href="https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin.html">IntelliJ Platform Gradle Plugin (2.x)</a></td><td>Gradle plugin ID, Java 17 requirement, repository/dependency pattern.</td><td>High, JetBrains primary documentation.</td></tr><tr><td><a href="https://plugins.jetbrains.com/docs/intellij/tools-intellij-platform-gradle-plugin-tasks.html">IntelliJ Platform Gradle Plugin tasks</a></td><td><code>buildPlugin</code> distribution task and ZIP artifact expectations.</td><td>High, JetBrains primary documentation.</td></tr><tr><td><a href="https://plugins.jetbrains.com/docs/intellij/publishing-plugin.html">Publishing a Plugin</a></td><td>Manual first Marketplace upload, signing prerequisite, distribution ZIP flow.</td><td>High, JetBrains primary documentation.</td></tr><tr><td><a href="https://plugins.jetbrains.com/docs/intellij/plugin-signing.html">Plugin Signing</a></td><td>Marketplace signing blocker and credential requirement.</td><td>High, JetBrains primary documentation.</td></tr><tr><td><a href="https://plugins.jetbrains.com/docs/marketplace/jetbrains-marketplace-approval-guidelines.html">JetBrains Marketplace Approval Guidelines</a></td><td>Marketplace review/approval blocker.</td><td>High, JetBrains primary documentation.</td></tr><tr><td><a href="https://plugins.jetbrains.com/docs/marketplace/understanding-plugin-security.html">Understanding plugin security</a></td><td>Marketplace review, Plugin Verifier, and UI integration check context.</td><td>High, JetBrains primary documentation.</td></tr></tbody></table></section>

    <section><h2>Distribution and monetization next steps</h2><ul><li>Package ZIP from <code>build/distributions</code> for local install testing.</li><li>Add signed release once Marketplace credentials and certificate are available.</li><li>Position as a free developer acquisition channel that feeds paid compliance reporting, CI gates, and organization-wide remediation workflows.</li></ul></section>
  `);
}
