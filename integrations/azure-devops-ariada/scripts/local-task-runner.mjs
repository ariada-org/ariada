// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const task = resolve(root, 'task/index.cjs');
const mockCli = resolve(root, 'fixtures/mock-ariada-cli.mjs');
const testReportDir = resolve(root, 'test-report');
const scanEvidenceDir = resolve(root, 'scan-evidence');
const outputDir = resolve(scanEvidenceDir, 'ariada-output');
const screenshotPath = resolve(testReportDir, 'screenshot.png');

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function link(fromFile, target, label) {
  return `<a href="${esc(relative(dirname(fromFile), target))}">${esc(label)}</a>`;
}

await rm(testReportDir, { recursive: true, force: true });
await rm(scanEvidenceDir, { recursive: true, force: true });
await mkdir(testReportDir, { recursive: true });
await mkdir(scanEvidenceDir, { recursive: true });
await chmod(mockCli, 0o755);

const started = new Date().toISOString();
const child = spawn(process.execPath, [task], {
  cwd: root,
  env: {
    ...process.env,
    INPUT_TARGETURL: 'https://example.org/ariada-s32-fixture',
    INPUT_FAILONSEVERITY: 'serious',
    INPUT_OUTPUTDIR: outputDir,
    INPUT_FORMAT: 'json',
    INPUT_TIMEOUTMS: '12000',
    INPUT_CLIPATH: mockCli,
    INPUT_INSTALLCLI: 'false',
  },
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk; });
child.stderr.on('data', (chunk) => { stderr += chunk; });
const exitCode = await new Promise((resolveExit) => child.on('close', resolveExit));
const completed = new Date().toISOString();
const scanJsonPath = resolve(outputDir, 'scan.json');
const scan = JSON.parse(await readFile(scanJsonPath, 'utf8'));

await writeFile(resolve(testReportDir, 'runner-output.json'), JSON.stringify({ exitCode, stdout, stderr, started, completed }, null, 2));

const evidenceHtml = resolve(scanEvidenceDir, 'result.html');
await writeFile(evidenceHtml, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ariada S32 Azure DevOps scan evidence</title>
<style>body{font:16px/1.5 system-ui;margin:0;color:#172026;background:#fbfcfd}main{max-width:1080px;margin:auto;padding:2rem}h1{font-size:2rem}h2{margin-top:2rem;border-top:1px solid #d8e0e8;padding-top:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem}.card{border:1px solid #d8e0e8;border-radius:8px;background:#fff;padding:1rem}code,pre{background:#f2f5f7;padding:.2rem .35rem;border-radius:4px}pre{overflow:auto}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #cad3dc;padding:.5rem;text-align:left;vertical-align:top}img{display:block;max-width:100%;height:auto;border:1px solid #cad3dc;border-radius:8px;background:#fff}</style></head>
<body><main>
<h1>Ariada S32 Azure DevOps scan evidence</h1>
<div class="grid">
<section class="card"><h2>Implemented vs not implemented</h2><p>Implemented: extension manifest, task manifest, Node task runner, local task-runner fixture, package validation, evidence HTML, embedded screenshot, and direct screenshot link. Not implemented: live Marketplace publication, Azure DevOps organization share, and live pipeline installation.</p></section>
<section class="card"><h2>Blockers</h2><p>Marketplace publish requires founder-owned Visual Studio Marketplace publisher access and Azure DevOps organization sharing/install rights. No live install was attempted.</p></section>
<section class="card"><h2>Evidence</h2><p>Local task-runner exit code: <strong>${exitCode}</strong>. Raw scan JSON: ${link(evidenceHtml, scanJsonPath, 'ariada-output/scan.json')}.</p></section>
</div>
<h2>What is Azure DevOps?</h2><p>Azure DevOps is Microsoft's development platform; this S32 channel targets Azure Pipelines tasks that run during build and release jobs.</p>
<h2>Why this is a separate Ariada channel</h2><p>Azure Pipelines is a distinct enterprise CI surface from GitHub Actions, GitLab CI, Jenkins, and Bitbucket. A native Marketplace task lets Microsoft-standardized organizations run Ariada without maintaining copy-pasted shell snippets.</p>
<h2>Roles: who pays / what value they buy</h2><table><tr><th>Role</th><th>Value</th></tr><tr><td>Engineering leaders</td><td>Repeatable accessibility CI gate before release.</td></tr><tr><td>Compliance and procurement</td><td>Pipeline-attached evidence for EAA and EN 301 549 review.</td></tr><tr><td>Platform teams</td><td>Reusable task inputs that can be standardized across repositories.</td></tr></table>
<h2>Competitors</h2><p>Deque axe DevTools, Microsoft Accessibility Insights, Siteimprove Azure DevOps connector, Evinced CI output, and older Marketplace accessibility checker tasks occupy adjacent CI accessibility surfaces.</p>
<h2>Domains</h2><p>Primary domain: accessibility CI gating. Adjacent domains: release governance, procurement evidence, EAA 2025 readiness, and enterprise DevOps standardization.</p>
<h2>Technical connectors</h2><p>The task invokes <code>ariada scan</code>, writes <code>scan.json</code>, emits Azure Pipelines logging commands, uploads the scan file, and publishes the output directory as a pipeline artifact.</p>
<h2>Screenshot</h2><p>Embedded local report screenshot, with direct PNG link: ${link(evidenceHtml, screenshotPath, 'test-report/screenshot.png')}.</p><a href="${esc(relative(dirname(evidenceHtml), screenshotPath))}"><img src="${esc(relative(dirname(evidenceHtml), screenshotPath))}" alt="Screenshot of the Ariada S32 Azure DevOps extension report showing implemented status, blockers, channel rationale, roles, competitors, and domains."></a>
<h2>Distribution</h2><p>Local distribution package is created with <code>tfx extension create</code> into <code>dist/</code>. Public distribution is blocked until the founder publishes through the Visual Studio Marketplace publisher account and shares it to an Azure DevOps organization.</p>
<h2>Monetization</h2><p>Sell as an enterprise CI channel: free thin task, paid Ariada reporting/support/policy packs for regulated teams that need auditable accessibility evidence.</p>
<h2>Sources</h2><ul>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-build-task">Microsoft Learn: Add a custom build or release task in an extension</a></li>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview">Microsoft Learn: Package and publish extensions</a></li>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/agents">Microsoft Learn: Azure Pipelines agent Node.js runner versions</a></li>
<li><a href="https://www.deque.com/axe/devtools/">Deque axe DevTools</a></li>
<li><a href="https://github.com/microsoft/accessibility-insights-action">Microsoft Accessibility Insights Azure DevOps action</a></li>
<li><a href="https://www.siteimprove.com/why-siteimprove/integrations/connectors/azure-devops/">Siteimprove Azure DevOps connector</a></li>
<li><a href="https://www.evinced.com/easy-integration">Evinced integration overview</a></li>
</ul>
<h2>Command output</h2><pre>${esc(stdout + stderr)}</pre>
</main></body></html>
`);

const reportHtml = resolve(testReportDir, 'result.html');
await writeFile(reportHtml, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Ariada S32 Azure DevOps extension report</title>
<style>body{font:16px/1.5 system-ui;margin:0;color:#172026;background:#fbfcfd}main{max-width:1080px;margin:auto;padding:2rem}h1{font-size:2rem}h2{margin-top:2rem;border-top:1px solid #d8e0e8;padding-top:1rem}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}.card{border:1px solid #d8e0e8;border-radius:8px;background:#fff;padding:1rem}code,pre{background:#f2f5f7;padding:.2rem .35rem;border-radius:4px}pre{overflow:auto}table{border-collapse:collapse;width:100%;background:#fff}td,th{border:1px solid #cad3dc;padding:.5rem;text-align:left;vertical-align:top}</style></head>
<body><main>
<h1>Ariada S32 Azure DevOps extension report</h1>
<div class="grid"><section class="card"><h2>Implemented vs not implemented</h2><p>Implemented: extension manifest, task manifest, Node task runner, local task-runner fixture, package validation, evidence HTML. Not implemented: live Marketplace publication and organization install.</p></section><section class="card"><h2>Blockers</h2><p>Marketplace publish requires founder-owned Visual Studio Marketplace publisher access and Azure DevOps organization sharing/install rights.</p></section></div>
<h2>What is Azure DevOps?</h2><p>Azure DevOps is Microsoft's development platform; this channel targets Azure Pipelines tasks that run during build and release jobs.</p>
<h2>Why this is a separate Ariada channel</h2><p>Microsoft-shop enterprises often standardize on Azure Pipelines rather than GitHub Actions or GitLab CI. A native task gives those teams a first-class procurement and pipeline surface for Ariada.</p>
<h2>Roles: who pays / what value they buy</h2><table><tr><th>Role</th><th>Value</th></tr><tr><td>Engineering leaders</td><td>One CI gate that produces repeatable accessibility evidence before release.</td></tr><tr><td>Compliance and procurement</td><td>Evidence artifacts tied to a pipeline run for EAA and EN 301 549 review.</td></tr><tr><td>Platform teams</td><td>A reusable task with consistent inputs across many repositories.</td></tr></table>
<h2>Competitors</h2><p>Deque axe DevTools, Microsoft Accessibility Insights, Siteimprove Azure DevOps connector, Evinced CI output, and older Marketplace accessibility checker tasks occupy adjacent CI accessibility surfaces.</p>
<h2>Domains</h2><p>Primary domain: accessibility CI gating. Adjacent domains: release governance, procurement evidence, EAA 2025 readiness, and enterprise DevOps standardization.</p>
<h2>Technical connectors</h2><p>The task invokes <code>ariada scan</code>, writes <code>scan.json</code>, emits Azure Pipelines logging commands, uploads the scan file, and publishes the output directory as a pipeline artifact.</p>
<h2>Evidence</h2><p>Local task-runner exit code: <strong>${exitCode}</strong>. Scan evidence: ${link(reportHtml, evidenceHtml, 'scan-evidence/result.html')}. Runner JSON: ${link(reportHtml, resolve(testReportDir, 'runner-output.json'), 'runner-output.json')}.</p>
<h2>Screenshot</h2><p>Screenshot is captured after this report is rendered in the browser and stored as <code>test-report/screenshot.png</code>.</p>
<h2>Distribution</h2><p>Local distribution package is created with <code>tfx extension create</code> into <code>dist/</code>. Public distribution is blocked until the founder publishes through the Visual Studio Marketplace publisher account.</p>
<h2>Monetization</h2><p>Sell as an enterprise CI channel: free thin task, paid Ariada reporting/support/policy packs for regulated teams that need auditable accessibility evidence.</p>
<h2>Sources</h2><ul>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/extend/develop/add-build-task">Microsoft Learn: Add a custom build or release task in an extension</a></li>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview">Microsoft Learn: Package and publish extensions</a></li>
<li><a href="https://learn.microsoft.com/en-us/azure/devops/pipelines/agents/agents">Microsoft Learn: Azure Pipelines agent Node.js runner versions</a></li>
<li><a href="https://www.deque.com/axe/devtools/">Deque axe DevTools</a></li>
<li><a href="https://github.com/microsoft/accessibility-insights-action">Microsoft Accessibility Insights Azure DevOps action</a></li>
<li><a href="https://www.siteimprove.com/why-siteimprove/integrations/connectors/azure-devops/">Siteimprove Azure DevOps connector</a></li>
<li><a href="https://www.evinced.com/easy-integration">Evinced integration overview</a></li>
</ul>
<h2>Command output</h2><pre>${esc(stdout + stderr)}</pre>
</main></body></html>
`);

console.log(`local task-runner fixture exit=${exitCode}`);
console.log(reportHtml);
console.log(evidenceHtml);
process.exitCode = exitCode;
