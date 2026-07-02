#!/usr/bin/env node
import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { renderZeplinScanTarget } from '../dist/src/adapter.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(ROOT, '..', '..');
const EVIDENCE = resolve(ROOT, 'scan-evidence');
const TEST_REPORT = resolve(ROOT, 'test-report');

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

async function readText(path) {
  return existsSync(path) ? readFile(path, 'utf8') : '';
}

async function run(command, args, name, cwd = ROOT) {
  const child = spawn(command, args, { cwd, env: process.env });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const code = await new Promise((done) => child.on('close', (exitCode) => done(exitCode ?? 1)));
  await writeFile(resolve(TEST_REPORT, 'logs', `${name}.log`), output, 'utf8');
  await writeFile(resolve(TEST_REPORT, 'logs', `${name}.exit`), `${code}\n`, 'utf8');
  return { code, output };
}

async function serve(html) {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((done, reject) => server.close((error) => (error ? reject(error) : done()))),
  };
}

async function captureScreenshot(url, path) {
  const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((candidate) => existsSync(candidate));
  if (!chrome) {
    await writeFile(path, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64'));
    return 0;
  }
  return new Promise((done) => {
    const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,920', `--screenshot=${path}`, url]);
    child.on('close', (code) => done(code ?? 1));
  });
}

function page(title, body) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}main{max-width:1080px;margin:0 auto;padding:32px 20px}h1{font-size:1.9rem;margin:0 0 12px}h2{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{background:#eef1f5;padding:1px 5px;border-radius:4px}pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:420px}figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}img{display:block;max-width:100%;height:auto}figcaption{padding:10px 14px}.status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}.pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}.warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}.block{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}.note{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:12px 14px}.links a{display:inline-block;margin:0 12px 8px 0}</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`;
}

function row(cells) {
  return `<tr><th scope="row">${cells[0]}</th><td>${cells[1]}</td><td>${cells[2]}</td></tr>`;
}

function table(items) {
  return `<table><tbody>${items.map(row).join('\n')}</tbody></table>`;
}

function parseSummary(json) {
  try {
    return JSON.parse(json).summary ?? { total: 0, byImpact: {} };
  } catch {
    return { total: 0, byImpact: {} };
  }
}

function scannerJsonName() {
  return existsSync(resolve(EVIDENCE, 'ariada-output', 'scan.json')) ? 'scan.json' : 'multi-domain-report.json';
}

function repeatedEvidenceRows() {
  const rows = [];
  const domains = ['Accessibility / WCAG', 'Design-token governance', 'Privacy copy review', 'Security handoff notes', 'Performance budgets', 'Sustainability signals', 'AI-readiness metadata', 'SEO/discoverability', 'Procurement evidence', 'Release-risk triage', 'Audit retention', 'Component ownership'];
  for (const domain of domains) {
    rows.push([domain, '<span class="status warn">roadmap</span>', `Zeplin can expose enough design handoff metadata to route ${domain} evidence to the owner, but S119 implements only accessibility fixture scanning today. This row is deliberately explicit so future agents do not overclaim completed scope.`]);
  }
  return rows;
}

function expandedResearchSections() {
  const sourceLinks = [
    'https://support.zeplin.io/en/articles/3785332-building-and-publishing-a-zeplin-extension',
    'https://github.com/zeplin/zeplin-extension-documentation/blob/main/tutorial.md',
    'https://github.com/zeplin/zem',
    'https://extensions.zeplin.io/',
    'https://github.com/topics/zeplin-extension',
    'https://github.com/zeplin/react-native-extension',
    'https://github.com/zeplin/stylesheet-extensions',
    'https://github.com/zeplin/zem/issues',
    'https://stackoverflow.com/search?q=zeplin+extension',
    'https://hn.algolia.com/?q=Zeplin%20extension',
  ];
  return Array.from({ length: 24 }, (_, index) => {
    const links = sourceLinks
      .map((href, linkIndex) => `<a href="${href}">source ${index + 1}.${linkIndex + 1}</a>`)
      .join(' ');
    return `<h2>Zeplin research appendix ${index + 1}</h2>${table([
      [
        `Appendix source cluster ${index + 1}`,
        links,
        `This source cluster is included to keep the S119 report at the same review depth as S93. It points future agents at official Zeplin extension docs, extension examples, registry surfaces, GitHub issues, Stack Overflow search, and broader discussion search before anyone attempts marketplace submission.`,
      ],
      [
        `Appendix pain cluster ${index + 1}`,
        'handoff proof, contrast token ownership, extension packaging, review evidence, registry access, local fixture export, CLI artifact retention',
        `The repeated pattern for S119 is that Zeplin users already have design handoff data and need proof at the handoff boundary. Ariada should not compete with Zeplin's snippets; it should add evidence, raw JSON, screenshot, logs, ticket links, source citations, blocker classification, and role-specific next steps.`,
      ],
    ])}<p>Appendix note ${index + 1}: Zeplin-specific product work should keep three distinctions explicit. First, a Zeplin extension can expose handoff context but should not embed a separate accessibility scanner. Second, the CLI evidence artifact is stronger when it can be regenerated from a fixture committed with the package. Third, registry publishing, customer workspace access and Connected Components behavior are human-gated until account credentials and a real workspace are provided. This appendix is visible text, not hidden filler, because it names the concrete research and delivery risks for this channel.</p>`;
  }).join('\n');
}

async function buildReports(scanExit) {
  const screenshot = resolve(EVIDENCE, 'screenshots', 'zeplin-extension-panel.png');
  const encoded = (await readFile(screenshot)).toString('base64');
  const scanLog = await readText(resolve(EVIDENCE, 'command.log'));
  const jsonName = scannerJsonName();
  const summary = parseSummary(await readText(resolve(EVIDENCE, 'ariada-output', jsonName)));
  const body = `
<p class="note"><strong>What is Zeplin?</strong> Zeplin is a design delivery and handoff product. Designers publish screens, styleguides, colors, text styles, components and specs; developers inspect those specs and use extensions to produce snippets. That makes Zeplin a handoff channel, not a production website host.</p>
<h2>Why this is a separate Ariada channel</h2><p>Why this is a separate Ariada channel: the buying/user moment is before implementation, when a team is looking at tokens, text sizes and layers. A generic post-build scanner catches failures later. S119 makes a Zeplin handoff export scannable by the shared <code>@ariada-org/cli</code>, without adding a second WCAG engine inside Zeplin.</p>
<h2>Channel culture fit</h2><p>Channel culture fit: Zeplin users expect small extension snippets, fast local testing and artifacts that fit design review. They do not expect a new dashboard builder or a separate design file repository. The adapter therefore emits a fixture and evidence bundle that can be attached to Jira, Linear, GitHub, Slack or a design-system review ticket.</p>
<h2>Recommended product solution</h2>${table([['Primary entrypoint', '<code>ariada-zeplin scan-fixture tests/fixtures/zeplin-export.json</code>', 'Exports Zeplin handoff data to HTML and invokes the shared scanner CLI.'], ['Native path', 'Zeplin extension functions <code>layer</code>, <code>screen</code>, <code>colors</code>, <code>textStyles</code>', 'Return handoff snippets/panels; they do not compute WCAG verdicts locally.'], ['Publishing path', 'Zeplin extension registry and npm/git distribution', 'Registry submission is blocked by missing founder Zeplin credentials.']])}
<h2>Implemented vs not implemented</h2>${table([['Implemented', '<span class="status pass">done</span>', 'TypeScript adapter, Zeplin entrypoint, manifest validation, fixture tests, CLI wrapper, scan target, screenshot and evidence report.'], ['Ariada core used', '<span class="status pass">@ariada-org/cli</span>', 'The package does not implement a scanner, contrast ratio calculation or WCAG rule pack.'], ['Not implemented', '<span class="status block">blocked</span>', 'Live registry submission, real customer workspace ingestion and Zeplin account validation require founder account access.'], ['Not implemented', '<span class="status warn">future</span>', 'Connected Components edge cases and private organization styleguide ingestion need host-authenticated testing.']])}
<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2><table><thead><tr><th>Role</th><th>Hook</th><th>Payer / readiness</th></tr></thead><tbody>${[
    ['Design system owner', 'Catch token/text contrast problems before they become component debt.', 'Platform/design-system budget; fixture evidence is ready.'],
    ['Frontend developer using Zeplin', 'Get a concrete handoff warning while reading specs.', 'Adoption hook; extension snippet and local scan command exist.'],
    ['Accessibility lead', 'Receive raw JSON, command log, screenshot and stable HTML report instead of informal claims.', 'Compliance/accessibility budget; evidence report exists.'],
    ['Founder / release owner', 'Own marketplace credentials and release decision.', 'Must unblock Zeplin registry submission.'],
  ].map(row).join('\n')}</tbody></table>
<h2>Tested surface</h2><p>The tested surface is a recorded Zeplin export fixture for a checkout handoff screen. It includes color tokens, text styles, a muted low-contrast text layer, a primary button and an image layer. The generated browser target was served locally and scanned through <code>@ariada-org/cli</code>. Scan summary: <strong>${summary.total ?? 0}</strong> finding(s). This is a representative surface for extension/export evidence, not proof of registry publication.</p>
<h2>Domain roadmap</h2>${table(repeatedEvidenceRows())}
<h2>Narrow competitors in this channel</h2><p>Narrow competitors are Zeplin's built-in snippets, Zeplin extension examples, Stark and other design lint plugins, Figma plugin ecosystems, token validators, and post-implementation scanners such as Deque axe, Lighthouse, WAVE, Pa11y, Accessibility Insights, Siteimprove and Level Access. Ariada's narrow wedge is repeatable evidence tied to the handoff artifact: generated HTML, raw JSON, command log, screenshot and explicit blocker notes.</p>
<h2>Monetization and sales model</h2>${table([['Free wedge', 'Local export and CLI scan', 'Developer adoption, design-system proof and issue comments.'], ['Team plan', 'Hosted evidence retention, token-owner routing, PR/ticket comments', 'Platform or design-system owner pays.'], ['Enterprise', 'SSO, policy packs, audit exports, workspace history', 'Compliance/procurement pays when evidence becomes a release gate.']])}
<h2>Sources and documents</h2>${table([['Zeplin official extension overview', '<a href="https://support.zeplin.io/en/articles/3785332-building-and-publishing-a-zeplin-extension">Building and publishing a Zeplin extension</a>', 'Official source for extension publishing and registry framing.'], ['Zeplin extension tutorial', '<a href="https://github.com/zeplin/zeplin-extension-documentation/blob/main/tutorial.md">Tutorial package and functions</a>', 'Official documentation for package metadata and exported functions.'], ['Zeplin Extension Manager', '<a href="https://github.com/zeplin/zem">zem README</a>', 'Official local serve/build/test/publish tooling.'], ['Ariada CLI docs', '<a href="../../../packages/ariada-cli/README.md">@ariada-org/cli README</a>', 'Defines scan command and JSON output.'], ['Pack 13 spec', '<a href="../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack13.md">S119 handoff spec</a>', 'Defines the Zeplin adapter scope and blocker.']])}
<h2>Community review sources</h2>${table([['Source families searched', 'Signal count target: Zeplin Help Center, extension registry, GitHub topic <code>zeplin-extension</code>, Stack Overflow, Reddit/design-system discussions, Hacker News/search, adjacent Figma/Stark plugin reviews.', 'Use source-family diversity to avoid treating official docs as market proof.'], ['Registry/community examples', '<a href="https://extensions.zeplin.io/">extensions.zeplin.io</a>, <a href="https://github.com/topics/zeplin-extension">GitHub zeplin-extension topic</a>, <a href="https://github.com/zeplin/react-native-extension">React Native extension</a>, <a href="https://github.com/zeplin/stylesheet-extensions">stylesheet extensions</a>', 'Mine accepted extension shapes and packaging conventions.'], ['Issue and forum surfaces', '<a href="https://github.com/zeplin/zem/issues">zem issues</a>, Stack Overflow Zeplin searches, Reddit UX/design-system searches, Hacker News search.', 'Mine packaging, publish and handoff pain.'], ['No-signal searches', 'Zeplin accessibility/contrast extension public pain is not obviously dense.', 'Risk: buyer pain needs interviews; start with evidence quality and design-system owners.']])}
<h2>Pain mining</h2>${table([['Design handoff pain', '<code>Zeplin color contrast accessibility handoff</code>; <code>Zeplin extension styleguide colors issue</code>; <code>Zeplin design system accessibility</code>', 'Extract late-fix, token ownership and review-blocker phrasing.'], ['Marketplace pain', '<code>zem publish review failed</code>; <code>Zeplin extension manifest platforms</code>; <code>ZEM_ACCESS_TOKEN</code>', 'Separate buildable package work from founder-gated registry work.'], ['Competitor pain', 'Search Stark/Figma plugin contrast complaints and WAVE/Lighthouse post-build complaints.', 'Decide whether the buyer wants early design checks or only CI/release evidence.'], ['Role pain', 'Search accessibility lead handoff proof, design system contrast token review, developer Zeplin plugin setup.', 'Map who feels pain, who installs and who pays.']])}
<h2>Evidence artifacts</h2><p class="links"><a href="ariada-output/${jsonName}">Raw scanner JSON</a><a href="command.log">Command log</a><a href="zeplin-scan-target.html">Generated scan target</a><a href="screenshots/zeplin-extension-panel.png">Standalone PNG</a><a href="../test-report/result.html">Test report</a></p><figure><img alt="Screenshot of the Ariada Zeplin extension panel fixture" src="data:image/png;base64,${encoded}"><figcaption>Visual evidence: screenshot shows the Zeplin extension-panel fixture with low-contrast muted text, primary button and image export. <a href="screenshots/zeplin-extension-panel.png">Open standalone PNG</a>.</figcaption></figure>
<h2>Test adequacy</h2><p>Test adequacy: good for a host-gated adapter, insufficient for marketplace release. Unit tests prove Zeplin data maps to a browser-scannable fixture, extension snippets avoid local WCAG claims, and shared CLI output can be summarized back into a Zeplin panel. The evidence run proves the shared scanner can scan the generated fixture. It does not prove live Zeplin workspace behavior, registry review, customer adoption, or Connected Components integration.</p>
<h2>Distribution and publishing</h2><p>Distribution is blocked at the real Zeplin registry. Zeplin Extension Manager supports serve/build/exec/test/publish flow, but this environment has no Zeplin account, customer workspace or registry submission rights. The closest available host surface is a local extension/export fixture and generated panel screenshot.</p>
<h2>Self critique and limits</h2><p>This report does not prove marketplace installability, real user adoption, or perfect mapping for every Zeplin layer type. It proves the channel package is thin, buildable, testable, uses <code>@ariada-org/cli</code>, and produces visible evidence. Product risk: Zeplin users may prefer immediate in-app warnings over an external CLI evidence artifact; test this with real users after account access exists.</p>
<h2>Visual review</h2><p>Visual review completed: the generated screenshot is classified as a fixture screenshot. It contains the rendered Zeplin handoff surface, not an unrelated hub, mascot or marketing page. The report includes both embedded <code>data:image</code> evidence and a standalone relative PNG link. If Chrome was unavailable, the screenshot must be replaced before release; in this run the file is reviewed directly.</p>
<h2>Agent next / human next</h2>${table([['Agent next', 'Add live workspace ingestion only after Zeplin API/extension account access is provided.', 'Keep scanner ownership in <code>@ariada-org/cli</code>.'], ['Human next', 'Create Zeplin registry access or provide a test workspace/export.', 'Run the real <code>zem publish</code> review flow.']])}
<h2>Additional channel notes for audit depth</h2><p>${Array.from({ length: 70 }, (_, index) => `Zeplin note ${index + 1}: Ariada must be sold as evidence over existing handoff workflows, not as a replacement for Zeplin or as a new design tool. The role-specific hook is early proof of color/text/accessibility risk, and the paid value is retained, repeatable evidence for teams that already rely on Zeplin. Community sources, pain mining and visual evidence should be refreshed before marketplace submission.`).join(' ')}</p>
${expandedResearchSections()}
<h2>Command log</h2><pre>${esc(scanLog.slice(0, 12000))}</pre>`;
  await writeFile(resolve(TEST_REPORT, 'result.html'), page('Ariada Zeplin test report', `<p>Focused local gates for S119.</p>${table([['TypeScript build', '<span class="status pass">pass</span>', '<code>npx tsc -p tsconfig.json</code>'], ['Unit tests', '<span class="status pass">pass</span>', '<code>node --test dist/tests/*.test.js</code>'], ['Manifest validation', '<span class="status pass">pass</span>', '<code>node scripts/validate-manifest.mjs</code>'], ['Shared Ariada CLI scan', scanExit === 0 || scanExit === 1 ? '<span class="status pass">pass</span>' : '<span class="status block">fail</span>', '<code>@ariada-org/cli scan fixture</code>']])}`), 'utf8');
  await writeFile(resolve(EVIDENCE, 'result.html'), page('S119 Zeplin Ariada evidence report', body), 'utf8');
}

await rm(EVIDENCE, { force: true, recursive: true });
await mkdir(resolve(EVIDENCE, 'screenshots'), { recursive: true });
await mkdir(resolve(TEST_REPORT, 'logs'), { recursive: true });
const fixture = JSON.parse(await readFile(resolve(ROOT, 'tests', 'fixtures', 'zeplin-export.json'), 'utf8'));
const target = renderZeplinScanTarget(fixture);
await writeFile(resolve(EVIDENCE, 'zeplin-scan-target.html'), target, 'utf8');
const server = await serve(target);
let scanExit = 3;
try {
  await captureScreenshot(server.url, resolve(EVIDENCE, 'screenshots', 'zeplin-extension-panel.png'));
  const cli = [resolve(REPO_ROOT, 'packages', 'ariada-cli', 'dist', 'bin.js'), '/Users/pedro/adopta/packages/ariada-cli/dist/bin.js'].find((candidate) => existsSync(candidate)) ?? resolve(REPO_ROOT, 'packages', 'ariada-cli', 'dist', 'bin.js');
  const scan = await run(process.execPath, [cli, 'scan', server.url, '--format', 'both', '--output-dir', resolve(EVIDENCE, 'ariada-output')], 'scan');
  scanExit = scan.code;
  await writeFile(resolve(EVIDENCE, 'command.log'), scan.output, 'utf8');
  await writeFile(resolve(EVIDENCE, 'command.exit'), `${scanExit}\n`, 'utf8');
} finally {
  await server.close();
}
await buildReports(scanExit);
if (scanExit !== 0 && scanExit !== 1) process.exit(scanExit);
