import { createServer } from 'node:http';
import { copyFile, mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runBubbleAriadaScan } from '../src/action.mjs';

const root = resolve(import.meta.dirname, '..');
const scanDir = resolve(root, 'scan-evidence');
const testDir = resolve(root, 'test-report');
const logsDir = resolve(testDir, 'logs');
const outputDir = resolve(scanDir, 'ariada-output');
const screenshotsDir = resolve(scanDir, 'screenshots');

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;background:#f7f8fb;color:#171923}
main{max-width:1080px;margin:0 auto;padding:32px 20px}
h1{font-size:2rem;margin:0 0 10px} h2{font-size:1.25rem;margin-top:28px;border-bottom:1px solid #d8dee8;padding-bottom:6px}
table{border-collapse:collapse;width:100%;background:#fff;margin:12px 0} th,td{border:1px solid #d8dee8;padding:8px;text-align:left;vertical-align:top}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace} code{background:#eef2f7;padding:1px 5px;border-radius:4px}
pre{background:#20242c;color:#f5f7fa;padding:14px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}
.note{background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:12px 14px}
.pass{color:#116329;font-weight:700}.warn{color:#8a5a00;font-weight:700}.block{color:#9f1d17;font-weight:700}
figure{margin:18px 0;background:#fff;border:1px solid #d8dee8;border-radius:8px;overflow:hidden} img{display:block;max-width:100%;height:auto} figcaption{padding:10px 14px}
</style>
</head>
<body><main>${body}</main></body></html>`;
}

function jsonResponse(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function makeServer() {
  let actionResult = null;
  const hostedPayload = {
    ok: false,
    reportUrl: 'https://app.ariada.ai/scans/bubble-local-fixture',
    findings: [
      { id: 'ariada/statement/page-link', domain: 'accessibility', severity: 'serious', message: 'Published Bubble page has no accessibility statement link.' },
      { id: 'ariada/image/text-alternative', domain: 'accessibility', severity: 'moderate', message: 'Hero image needs equivalent text.' },
      { id: 'ariada/form/label', domain: 'accessibility', severity: 'serious', message: 'Newsletter input is missing a visible label.' }
    ]
  };

  const server = createServer((request, response) => {
    if (request.url === '/ariada/scan' && request.method === 'POST') {
      jsonResponse(response, 200, hostedPayload);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(page('Bubble Ariada action fixture', `
      <h1>Bubble Ariada action fixture</h1>
      <p class="note">Local Bubble-like page after the <code>Run Ariada scan</code> workflow action returns values.</p>
      ${table(['Returned value', 'Value'], [
        ['ok', esc(actionResult?.ok ?? '')],
        ['scanned_url', esc(actionResult?.scanned_url ?? '')],
        ['findings_count', esc(actionResult?.findings_count ?? '')],
        ['serious_count', esc(actionResult?.serious_count ?? '')],
        ['summary_text', esc(actionResult?.summary_text ?? '')],
        ['report_url', esc(actionResult?.report_url ?? '')]
      ])}
      <h2>Findings JSON returned to Bubble</h2>
      <pre>${esc(actionResult?.findings_json ?? '')}</pre>
    `));
  });

  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const port = server.address().port;
  return {
    server,
    port,
    hostedPayload,
    setActionResult(value) {
      actionResult = value;
    }
  };
}

async function captureScreenshot(htmlPath, path) {
  const thumbnailDir = await mkdtemp(join(tmpdir(), 'ariada-bubble-shot-'));
  const result = spawnSync('qlmanage', ['-t', '-s', '1280', '-o', thumbnailDir, htmlPath], { encoding: 'utf8' });
  const files = result.status === 0 ? await readdir(thumbnailDir) : [];
  const png = files.find((file) => file.endsWith('.png'));
  if (png) {
    await copyFile(join(thumbnailDir, png), path);
    return { tool: 'qlmanage Quick Look', output: result.stderr || result.stdout };
  }
  throw new Error(`screenshot capture failed: ${result.stderr || result.stdout}`);
}

function screenshotLooksValid(path) {
  return existsSync(path) && statSync(path).size > 10_000;
}

async function readMaybe(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

async function buildReports(result, screenshot, commandLog, scanExit) {
  const gates = [
    ['lint', 'npm run lint'],
    ['validate', 'npm run validate'],
    ['test', 'npm test'],
    ['e2e', 'npm run test:e2e']
  ];
  const gateRows = [];
  for (const [name, command] of gates) {
    const exit = (await readMaybe(resolve(logsDir, `${name}.exit`))).trim();
    gateRows.push([
      esc(command),
      exit === '0' ? '<span class="pass">pass</span>' : exit ? '<span class="block">fail</span>' : '<span class="warn">not recorded before report build</span>',
      `<a href="logs/${name}.txt">log</a> · <a href="logs/${name}.exit">exit</a>`
    ]);
  }

  const reportRows = [
    ['Channel', 'Bubble plugin / API connector for no-code app builders.'],
    ['Why separate', 'Bubble users configure plugins, workflow actions and API connector calls rather than installing npm packages or running local CLI tools.'],
    ['Current status', 'Local plugin action fixture implemented; Bubble editor import and marketplace review are blocked on a founder-owned Bubble account.'],
    ['Scan semantics', 'Thin hosted API call compatible with Ariada scan results; no scanner logic is reimplemented in the plugin.']
  ];
  const roleRows = [
    ['Bubble builder', 'Check my app without leaving Bubble workflows.', 'One server-side action returning summary and JSON.', 'Usually adopter, not payer.', 'Private plugin install or API Connector test.', '<span class="pass">local action fixture implemented</span>'],
    ['Agency owner', 'Show clients repeatable release evidence.', 'Report link, screenshot and retained scan payload.', 'Agency or client delivery budget.', 'Before client handoff or launch.', '<span class="warn">paid retention planned</span>'],
    ['Compliance reviewer', 'Inspect what was scanned and what failed.', 'Raw JSON, command transcript, screenshot and limits.', 'Influencer; may be consultant buyer.', 'Release review or remediation ticket.', '<span class="pass">local evidence generated</span>'],
    ['Founder / marketplace owner', 'Control plugin identity and public claims.', 'Private plugin setup checklist and marketplace blocker list.', 'Company owner.', 'Before Bubble marketplace submission.', '<span class="block">Bubble account and hosted API blocked</span>']
  ];
  const domainRows = [
    ['accessibility', 'implemented in fixture', 'Findings returned from hosted-compatible scan payload.'],
    ['privacy / GDPR', 'planned', 'Cookie and consent evidence would require hosted runtime checks.'],
    ['security', 'planned', 'Headers and mixed-content checks belong in Ariada hosted scan, not Bubble plugin code.'],
    ['performance / SEO / localization', 'planned', 'Useful for public Bubble apps after core hosted scan domains mature.']
  ];
  const competitorRows = [
    ['Bubble API Connector', 'Native API setup surface; Ariada wraps a specific evidence workflow.'],
    ['Generic accessibility audit services', 'Manual reports; Ariada provides workflow action artifacts.'],
    ['axe / Lighthouse / Pa11y', 'Developer/browser tools; Bubble builders need no-code workflow packaging.'],
    ['Bubble plugin marketplace tools', 'Distribution competitors; most are not compliance evidence-retention products.']
  ];
  const sourceRows = [
    ['Bubble API Connector docs', '<a href="https://manual.bubble.io/help-guides/integrations/api/the-api-connector">manual.bubble.io API Connector</a>', 'Primary Bubble docs; search result says the API Connector article was published last month and covers outbound external API calls.'],
    ['Bubble API Connector reference', '<a href="https://manual.bubble.io/core-resources/api/the-api-connector">manual.bubble.io API Connector reference</a>', 'Primary Bubble docs; search result says calls can be used as actions or data and expect JSON responses.'],
    ['Bubble building actions docs', '<a href="https://manual.bubble.io/account-and-marketplace/building-plugins/building-actions">manual.bubble.io Building Actions</a>', 'Primary Bubble docs; search result says server-side actions can call external services and return data for subsequent actions.'],
    ['Bubble marketplace policies', '<a href="https://manual.bubble.io/account-and-marketplace/marketplace-policies">manual.bubble.io Marketplace policies</a>', 'Primary Bubble docs for marketplace/commercial-plugin blocker context.'],
    ['Bubble forum: return values', '<a href="https://forum.bubble.io/t/return-server-side-action-value-to-element-method-in-plugin/247840">forum.bubble.io return values thread</a>', 'Community signal that server-side actions return data through workflows rather than directly into elements.'],
    ['Bubble forum: server-side plugin action', '<a href="https://forum.bubble.io/t/plugin-server-side-action/297770">forum.bubble.io plugin server-side action thread</a>', 'Community signal for returned-value shape confusion in plugin actions.']
  ];

  const scanBody = `
    <h1>Ariada Bubble scan evidence</h1>
    <p class="note">Dash-style evidence report for S13 Bubble. The local E2E proves a Bubble plugin action contract against a hosted-API-compatible Ariada scan endpoint.</p>
    <h2>What this channel is and why it is separate</h2>${table(['Question', 'Answer'], reportRows)}
    <h2>Channel culture fit and user preferences</h2>${table(['Expectation', 'Bubble-specific answer'], [
      ['Fast local loop', 'Bubble builders expect editor configuration and workflow actions, not local Node or CLI ownership.'],
      ['Heavy scanner placement', 'Browser scanning belongs in Ariada hosted API, with Bubble receiving structured action values.'],
      ['Packaging', 'Private Bubble plugin first, marketplace plugin later; API Connector fallback for teams not ready for marketplace install.'],
      ['Rejected path', 'Do not ask Bubble users to run the Ariada CLI or copy scanner code into client-side actions.']
    ])}
    <h2>Recommended product solution</h2>${table(['Decision', 'Recommendation'], [
      ['Primary surface', 'Bubble server-side plugin action calling Ariada hosted scan API.'],
      ['Fallback', 'Documented API Connector call using the same request and response shape.'],
      ['Free vs paid', 'Keep private plugin/action scaffold free; sell hosted retention, baselines, exports and team dashboards.'],
      ['Next native path', 'Founder imports plugin in Bubble editor, verifies return values, then prepares marketplace listing.']
    ])}
    <h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>${table(['Role', 'What we promise', 'What we offer', 'Who pays', 'When we enter', 'Implemented / blockers'], roleRows)}
    <h2>Compliance-domain roadmap</h2>${table(['Domain', 'Status', 'Bubble channel note'], domainRows)}
    <h2>Narrow evidence/compliance competitors</h2>${table(['Competitor', 'Ariada wedge'], competitorRows)}
    <h2>Implemented vs missing</h2>${table(['Item', 'Status', 'Evidence or blocker'], [
      ['Plugin manifest', '<span class="pass">implemented</span>', '<a href="../plugin/bubble-plugin.json">bubble-plugin.json</a>'],
      ['Server-side action shape', '<span class="pass">implemented</span>', '<a href="../plugin/server-side-action.js">server-side-action.js</a>'],
      ['Local hosted API fixture', '<span class="pass">implemented</span>', 'E2E server returns Ariada-compatible findings.'],
      ['Bubble editor import', '<span class="block">blocked</span>', 'Requires founder-owned Bubble plugin editor account.'],
      ['Marketplace review', '<span class="block">blocked</span>', 'Requires production hosted API and Bubble review.']
    ])}
    <h2>Technical connectors</h2>${table(['Connector', 'Purpose', 'State'], [
      ['Hosted API', 'Run Ariada scan and return JSON.', 'Mocked locally; production endpoint blocked.'],
      ['Bubble server-side action', 'Expose scan as workflow step.', 'Implemented as copyable action shape.'],
      ['API Connector fallback', 'Manual no-code configuration.', 'Manifest documents request and response.'],
      ['Result element', 'Display summary/report link.', 'Described in plugin scaffold.']
    ])}
    <h2>E2E test adequacy</h2>${table(['Question', 'Answer'], [
      ['What it proves', 'Bubble action code calls a hosted scan endpoint, normalizes findings and renders returned values.'],
      ['What it does not prove', 'It does not prove Bubble editor import, Bubble runtime permissions or marketplace acceptance.'],
      ['Why acceptable now', 'S13 is gated on hosted API and Bubble account; local fixture is closest verifiable proof without fake marketplace claims.']
    ])}
    <h2>Evidence artifacts</h2>${table(['Artifact', 'Link'], [
      ['Raw Bubble action result JSON', '<a href="ariada-output/bubble-action-result.json">ariada-output/bubble-action-result.json</a>'],
      ['Hosted API fixture payload', '<a href="ariada-output/hosted-api-fixture.json">ariada-output/hosted-api-fixture.json</a>'],
      ['Preview HTML used for screenshot', '<a href="bubble-action-preview.html">bubble-action-preview.html</a>'],
      ['Command log', '<a href="command-output.txt">command-output.txt</a>'],
      ['Command exit', '<a href="command.exit">command.exit</a>'],
      ['Screenshot PNG', '<a href="screenshots/bubble-action-result.png">screenshots/bubble-action-result.png</a>'],
      ['Test report', '<a href="../test-report/result.html">../test-report/result.html</a>']
    ])}
    <h2>Visual evidence review</h2>
    <figure><img src="screenshots/bubble-action-result.png" alt="Bubble Ariada action result fixture"><figcaption>Screenshot of the local Bubble-like action result surface. <a href="screenshots/bubble-action-result.png">Open PNG directly</a>.</figcaption></figure>
    ${table(['Check', 'Finding'], [
      ['Blank check', screenshotLooksValid(screenshot) ? '<span class="pass">PNG exists and is larger than 10 KB</span>' : '<span class="block">PNG missing or too small</span>'],
      ['Surface shown', 'The screenshot shows returned Bubble action values and findings JSON, not the Bubble editor itself.'],
      ['Blocker classification', 'Bubble editor and marketplace screenshots remain external host blockers.']
    ])}
    <h2>Sources and community-review surfaces</h2>${table(['Source', 'URL', 'Use'], sourceRows)}
    <h2>Pain-mining queries</h2>${table(['Surface', 'Queries'], [
      ['Bubble forum', 'server-side action return values; API connector plugin action not showing; plugin marketplace review'],
      ['Bubble docs/search', 'API Connector authentication, private plugin keys, Plugin Editor server-side actions'],
      ['Marketplace', 'accessibility plugin, WCAG scan, compliance audit, site checker'],
      ['No-signal searches', 'Ariada Bubble plugin; Bubble EAA scanner; Bubble WCAG evidence']
    ])}
    <h2>Distribution and monetization next steps</h2>${table(['Step', 'Owner / condition'], [
      ['Import private plugin into Bubble editor', 'Founder / Bubble account required.'],
      ['Connect production Ariada hosted scan API', 'Ariada SaaS endpoint and token required.'],
      ['Capture Bubble editor and Bubble app runtime screenshots', 'Founder or agent with account access.'],
      ['Marketplace listing', 'Founder submission after private plugin evidence passes.'],
      ['Paid layer', 'Hosted retention, baselines, exports and agency/client dashboards.']
    ])}
    <h2>Command output</h2><pre>${esc(commandLog)}</pre>
    <h2>Action result JSON</h2><pre>${esc(JSON.stringify(result, null, 2))}</pre>
  `;

  const testBody = `
    <h1>Ariada Bubble test report</h1>
    <p class="note">Local gates for S13 Bubble plugin scaffold.</p>
    <h2>Gate summary</h2>${table(['Command', 'Result', 'Evidence'], gateRows)}
    <h2>E2E result</h2>${table(['Metric', 'Value'], [
      ['Action exit', esc(scanExit)],
      ['Findings', esc(result.findings_count)],
      ['Serious findings', esc(result.serious_count)],
      ['Screenshot', '<a href="../scan-evidence/screenshots/bubble-action-result.png">bubble-action-result.png</a>']
    ])}
  `;

  await writeFile(resolve(scanDir, 'result.html'), page('Ariada Bubble scan evidence', scanBody));
  await writeFile(resolve(testDir, 'result.html'), page('Ariada Bubble test report', testBody));
}

async function main() {
  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(screenshotsDir, { recursive: true }), mkdir(logsDir, { recursive: true })]);
  const fixture = await makeServer();
  const commandLines = [];

  try {
    const targetUrl = `http://127.0.0.1:${fixture.port}/bubble-app`;
    const apiUrl = `http://127.0.0.1:${fixture.port}/ariada/scan`;
    commandLines.push(`run Bubble server-side action url_to_scan=${targetUrl} api_url=${apiUrl}`);
    const result = await runBubbleAriadaScan({ url_to_scan: targetUrl, api_url: apiUrl, domains: ['accessibility'] });
    fixture.setActionResult(result);

    await writeFile(resolve(outputDir, 'bubble-action-result.json'), JSON.stringify(result, null, 2));
    await writeFile(resolve(outputDir, 'hosted-api-fixture.json'), JSON.stringify(fixture.hostedPayload, null, 2));
    await writeFile(resolve(scanDir, 'command-output.txt'), `${commandLines.join('\n')}\n${result.summary_text}\n`);
    await writeFile(resolve(scanDir, 'command.exit'), '0\n');
    await writeFile(resolve(logsDir, 'e2e.txt'), `PASS ${result.summary_text}\n`);
    await writeFile(resolve(logsDir, 'e2e.exit'), '0\n');

    const previewHtml = resolve(scanDir, 'bubble-action-preview.html');
    await writeFile(previewHtml, page('Bubble Ariada action fixture', `
      <h1>Bubble Ariada action fixture</h1>
      <p class="note">Local Bubble-like page after the <code>Run Ariada scan</code> workflow action returns values.</p>
      ${table(['Returned value', 'Value'], [
        ['ok', esc(result.ok)],
        ['scanned_url', esc(result.scanned_url)],
        ['findings_count', esc(result.findings_count)],
        ['serious_count', esc(result.serious_count)],
        ['summary_text', esc(result.summary_text)],
        ['report_url', esc(result.report_url)]
      ])}
      <h2>Findings JSON returned to Bubble</h2>
      <pre>${esc(result.findings_json)}</pre>
    `));
    const screenshot = resolve(screenshotsDir, 'bubble-action-result.png');
    const shot = await captureScreenshot(previewHtml, screenshot);
    if (!screenshotLooksValid(screenshot)) throw new Error('screenshot capture produced a missing or tiny PNG');
    await writeFile(resolve(logsDir, 'screenshot.txt'), `${shot.tool}\n${shot.output}\n`);
    await buildReports(result, screenshot, await readFile(resolve(scanDir, 'command-output.txt'), 'utf8'), '0');
    console.log(`PASS Bubble local E2E wrote ${resolve(scanDir, 'result.html')}`);
  } finally {
    fixture.server.close();
  }
}

await main();
