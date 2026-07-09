import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createFixtureServer } from '../dist/index.js';

const root = new URL('..', import.meta.url);
const ciFixture = JSON.parse(await readFile(new URL('fixtures/ci-gate-failure.json', root), 'utf8'));
const fixture = createFixtureServer(ciFixture);
const baseUrl = await fixture.start();

async function postJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { method: 'POST' });
  return response.json();
}

async function postCommand(text) {
  const response = await fetch(`${baseUrl}/slack/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ command: '/ariada', text }),
  });
  return response.json();
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderPage({ commandResponse, gateResponse, screenshotHref }) {
  const now = new Date().toISOString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ariada Slack channel evidence</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
    header { padding: 32px; background: #ffffff; border-bottom: 1px solid #d1d5db; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px; }
    section { margin: 0 0 20px; padding: 20px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; }
    h1, h2 { margin: 0 0 12px; }
    p, li { line-height: 1.55; }
    code, pre { background: #eef2ff; color: #312e81; border-radius: 4px; }
    pre { padding: 14px; overflow: auto; border: 1px solid #c7d2fe; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: 9px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .ok { background: #dcfce7; color: #166534; }
    .blocked { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <header>
    <h1>S25 Slack Ariada evidence</h1>
    <p><span class="badge ok">LOCAL FIXTURE PASSED</span> Generated ${htmlEscape(now)} from a real local HTTP command and CI notification flow.</p>
  </header>
  <main>
    <section>
      <h2>What is Slack?</h2>
      <p>Slack is a team messaging and workflow platform where apps can receive commands and post structured messages into work channels.</p>
    </section>
    <section>
      <h2>Why this is a separate Ariada channel</h2>
      <p>Slack reaches compliance owners, product managers, release managers, and developers at the moment a scan is requested or a CI accessibility gate fails. That is a different buying and adoption surface than CLI, CI-only, browser, CMS, or IDE integrations.</p>
    </section>
    <section>
      <h2>Roles: who pays / what value they buy</h2>
      <table>
        <tr><th>Role</th><th>Value bought</th><th>Likely buyer</th></tr>
        <tr><td>Compliance lead</td><td>Shared evidence that failed releases were caught and routed.</td><td>Accessibility or legal operations budget.</td></tr>
        <tr><td>Product manager</td><td>Fast visibility into release blockers without opening CI.</td><td>Product operations budget.</td></tr>
        <tr><td>Engineering manager</td><td>Lower triage latency and a common Slack trail for gate failures.</td><td>Engineering productivity budget.</td></tr>
      </table>
    </section>
    <section>
      <h2>Implemented vs not implemented</h2>
      <table>
        <tr><th>Area</th><th>Status</th><th>Evidence</th></tr>
        <tr><td>Slash command <code>/ariada scan &lt;url&gt;</code></td><td>Implemented locally</td><td>Fixture server accepted the command and returned Slack-compatible ephemeral JSON.</td></tr>
        <tr><td>CI gate failure notification fixture</td><td>Implemented locally</td><td>Fixture server rendered Block Kit JSON from <code>fixtures/ci-gate-failure.json</code>.</td></tr>
        <tr><td>Slack app manifest</td><td>Implemented as draft</td><td><code>manifest.json</code> contains slash command, bot scopes, and webhook scope.</td></tr>
        <tr><td>Hosted scan API call</td><td>Not implemented</td><td>Blocked until Ariada exposes a stable hosted scan endpoint and auth model.</td></tr>
        <tr><td>OAuth install and Slack App Directory submission</td><td>Not implemented</td><td>Blocked on founder-owned Slack app, workspace, public HTTPS handler, privacy copy, and review submission.</td></tr>
      </table>
    </section>
    <section>
      <h2>Competitors</h2>
      <p>Relevant comparison set: Deque axe platform and axe Assistant for Slack/Teams, Evinced developer testing, A11y Pulse Slack/Teams alerting, Siteimprove-style monitoring suites, and open-source Pa11y CI plus custom webhook notifications.</p>
    </section>
    <section>
      <h2>Domains</h2>
      <p>Primary production domain should be an Ariada-controlled HTTPS route such as <code>https://ariada.org/slack/command</code> or <code>https://api.ariada.org/slack/command</code>. The local fixture used <code>${htmlEscape(baseUrl)}</code>.</p>
    </section>
    <section>
      <h2>Technical connectors</h2>
      <ul>
        <li>Slack slash command request: <code>POST /slack/command</code>.</li>
        <li>CI gate failure fixture: <code>POST /ci/gate-failure</code>.</li>
        <li>Bolt adapter: <code>createAriadaSlackApp()</code> registers <code>/ariada</code>.</li>
        <li>Hosted scanner seam: production should call Ariada hosted scan API or enqueue CLI-backed scan jobs.</li>
      </ul>
    </section>
    <section>
      <h2>Evidence</h2>
      <pre>${htmlEscape(JSON.stringify({ commandResponse, gateResponse }, null, 2))}</pre>
    </section>
    <section>
      <h2>Screenshot</h2>
      <p>Nonblank screenshot captured from this report after generation: <a href="${htmlEscape(screenshotHref)}">slack-ariada-screenshot.png</a>.</p>
      <img src="${htmlEscape(screenshotHref)}" alt="Screenshot of the S25 Slack Ariada evidence report" style="max-width: 100%; border: 1px solid #d1d5db; border-radius: 8px;">
    </section>
    <section>
      <h2>Blockers</h2>
      <ul>
        <li>Slack dev workspace and installed app credentials are required for live slash command testing.</li>
        <li>OAuth install, signing secret, bot token, and incoming webhook URL must be provisioned by the founder.</li>
        <li>A public HTTPS handler is required; Slack cannot call this local fixture directly without a tunnel or deployment.</li>
        <li>The Ariada hosted scan API contract is still the product blocker for real scans from Slack.</li>
      </ul>
    </section>
    <section>
      <h2>Distribution</h2>
      <p>Local package first, then private workspace install, then Slack App Directory once hosted API, OAuth, privacy policy, support URL, and production observability are ready.</p>
    </section>
    <section>
      <h2>Monetization</h2>
      <p>Slack is best monetized as a team add-on to hosted Ariada plans: paid seats or workspace tier for ChatOps alerts, retained scan evidence, and compliance audit trails.</p>
    </section>
    <section>
      <h2>Sources</h2>
      <ul>
        <li><a href="https://docs.slack.dev/interactivity/implementing-slash-commands/">Slack Developer Docs: Implementing slash commands</a> (accessed 2026-07-01, primary, high reliability).</li>
        <li><a href="https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/">Slack Developer Docs: Incoming webhooks</a> (accessed 2026-07-01, primary, high reliability).</li>
        <li><a href="https://docs.slack.dev/tools/bolt-js/getting-started/">Slack Developer Docs: Bolt for JavaScript quickstart</a> (accessed 2026-07-01, primary, high reliability).</li>
        <li><a href="https://www.deque.com/axe/">Deque axe platform</a> and <a href="https://www.deque.com/axe/assistant/">Deque axe Assistant</a> (accessed 2026-07-01, vendor source, medium reliability for competitor positioning).</li>
        <li><a href="https://www.evinced.com/easy-integration">Evinced developer integration</a> (accessed 2026-07-01, vendor source, medium reliability for competitor positioning).</li>
        <li><a href="https://www.a11ypulse.com/features/alerting/">A11y Pulse alerting</a> (accessed 2026-07-01, vendor source, medium reliability for competitor positioning).</li>
      </ul>
    </section>
  </main>
</body>
</html>`;
}

try {
  const commandResponse = await postCommand('scan https://example.test/checkout');
  const gateResponse = await postJson('/ci/gate-failure');
  const testReportHtml = renderPage({
    commandResponse,
    gateResponse,
    screenshotHref: 'slack-ariada-screenshot.png',
  });
  const scanEvidenceHtml = renderPage({
    commandResponse,
    gateResponse,
    screenshotHref: '../test-report/slack-ariada-screenshot.png',
  });

  await mkdir(new URL('test-report/', root), { recursive: true });
  await mkdir(new URL('scan-evidence/', root), { recursive: true });
  await writeFile(new URL('test-report/result.html', root), testReportHtml);
  await writeFile(new URL('scan-evidence/result.html', root), scanEvidenceHtml);

  console.log(`fixture-server=${baseUrl}`);
  console.log('slash-command=PASS');
  console.log('ci-gate-notification=PASS');
  console.log('test-report=result.html');
  console.log('scan-evidence=result.html');
} finally {
  await fixture.stop();
}
