// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
'use strict';

const { execFileSync } = require('node:child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const evidenceDir = join(root, 'scan-evidence');
mkdirSync(evidenceDir, { recursive: true });

const gates = [
  run('Typecheck', 'npm', ['run', 'typecheck', '--silent']),
  run('Lint', 'npm', ['run', 'lint', '--silent']),
  run('Tests', 'npm', ['test', '--silent']),
];

const hostBlocked = !hasExecutable('hexo');
const screenshot = makeScreenshotSvg({
  status: gates.every((gate) => gate.ok) ? 'PASS' : 'FAIL',
  host: hostBlocked ? 'Hexo CLI missing: host integration test skipped' : 'Hexo CLI available',
});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S111 Hexo Ariada scan evidence</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; color: #15171a; background: #f7f8fa; }
  header, main { max-width: 980px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 1.8rem; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; background: white; }
  th, td { text-align: left; border-bottom: 1px solid #d8dde3; padding: 8px 10px; vertical-align: top; }
  code, pre { font: 13px/1.4 ui-monospace, monospace; }
  code { background: #eef1f4; padding: 1px 4px; border-radius: 4px; }
  pre { background: #20242b; color: #f3f6fa; padding: 12px; overflow: auto; border-radius: 6px; }
  .pass { color: #146c2e; font-weight: 700; }
  .blocked { color: #865600; font-weight: 700; }
  .fail { color: #9f1828; font-weight: 700; }
  figure { margin: 18px 0; background: white; border: 1px solid #d8dde3; }
  img { display: block; width: 100%; height: auto; }
  figcaption { padding: 10px 12px; }
</style>
</head>
<body>
<header>
  <h1>S111 Hexo plugin evidence</h1>
  <p>Hexo plugin that registers an <code>after_generate</code> filter, serves <code>public/</code> on loopback, and invokes the shared <code>@ariada-org/cli</code>.</p>
</header>
<main>
  <h2>Review Screenshot</h2>
  <figure>
    <img alt="Screenshot-style summary of S111 Hexo Ariada validation results" src="data:image/svg+xml;base64,${Buffer.from(screenshot).toString('base64')}">
    <figcaption>Embedded validation screenshot. It records the local gates and the host-tool status for Hexo.</figcaption>
  </figure>
  <h2>Gate Results</h2>
  <table>
    <thead><tr><th scope="col">Gate</th><th scope="col">Status</th><th scope="col">Command</th></tr></thead>
    <tbody>
      ${gates.map((gate) => `<tr><th scope="row">${escapeHtml(gate.label)}</th><td class="${gate.ok ? 'pass' : 'fail'}">${gate.ok ? 'Pass' : 'Fail'}</td><td><code>${escapeHtml(gate.command)}</code></td></tr>`).join('\n')}
      <tr><th scope="row">Hexo host integration</th><td class="${hostBlocked ? 'blocked' : 'pass'}">${hostBlocked ? 'Blocked' : 'Pass'}</td><td>${hostBlocked ? 'Blocked: Hexo CLI is not installed on this host. Owner: founder or runner maintainer. Next action: install hexo-cli, then rerun npm test.' : '<code>hexo generate</code> exercised by the integration test.'}</td></tr>
    </tbody>
  </table>
  <h2>Logs</h2>
  ${gates.map((gate) => `<details${gate.ok ? '' : ' open'}><summary>${escapeHtml(gate.label)}</summary><pre>${escapeHtml(gate.output.slice(-8000))}</pre></details>`).join('\n')}
</main>
</body>
</html>
`;

writeFileSync(join(evidenceDir, 'result.html'), html, 'utf8');
process.stdout.write(`Wrote ${join(evidenceDir, 'result.html')}\n`);

function run(label, command, args) {
  const full = `${command} ${args.join(' ')}`;
  try {
    const output = execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { label, command: full, ok: true, output };
  } catch (error) {
    return {
      label,
      command: full,
      ok: false,
      output: `${error.stdout || ''}\n${error.stderr || ''}`.trim(),
    };
  }
}

function hasExecutable(name) {
  for (const dir of (process.env.PATH || '').split(':')) {
    if (existsSync(join(dir, name))) return true;
  }
  return false;
}

function makeScreenshotSvg({ status, host }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620">
  <rect width="1200" height="620" fill="#f7f8fa"/>
  <rect x="54" y="48" width="1092" height="524" rx="8" fill="#ffffff" stroke="#ccd3dc"/>
  <text x="92" y="112" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#15171a">S111 Hexo Ariada Evidence</text>
  <text x="92" y="158" font-family="Arial, sans-serif" font-size="22" fill="#39414d">after_generate hook -> local public/ preview -> @ariada-org/cli scan</text>
  <rect x="92" y="204" width="1016" height="74" rx="6" fill="${status === 'PASS' ? '#e8f6ed' : '#fcebed'}" stroke="${status === 'PASS' ? '#16803c' : '#9f1828'}"/>
  <text x="122" y="251" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${status === 'PASS' ? '#146c2e' : '#9f1828'}">Local gates: ${status}</text>
  <rect x="92" y="310" width="1016" height="74" rx="6" fill="#fff8e6" stroke="#b97900"/>
  <text x="122" y="357" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#865600">${escapeSvg(host)}</text>
  <text x="92" y="446" font-family="Arial, sans-serif" font-size="22" fill="#39414d">Evidence artifact: integrations/hexo-ariada/scan-evidence/result.html</text>
  <text x="92" y="492" font-family="Arial, sans-serif" font-size="20" fill="#39414d">Scope: integrations/hexo-ariada only. No scan logic reimplemented.</text>
</svg>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeSvg(value) {
  return escapeHtml(value).replace(/'/g, '&apos;');
}
