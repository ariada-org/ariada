'use strict';

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { basename, join, resolve } = require('node:path');
const { deflateSync } = require('node:zlib');

const { auditDesignNodes } = require('../src/audit.cjs');

const root = resolve(__dirname, '..');
const fixturePath = join(root, 'fixtures', 'known-bad-frame.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const result = auditDesignNodes(fixture.nodes);
const generatedAt = process.env.ARIADA_EVIDENCE_TIMESTAMP || '2026-07-01T00:00:00.000Z';

if (result.issues.length !== 3) {
  throw new Error(`known-bad fixture should produce exactly 3 issues, got ${result.issues.length}`);
}

const testReportDir = join(root, 'test-report');
const evidenceDir = join(root, 'scan-evidence');
mkdirSync(testReportDir, { recursive: true });
mkdirSync(evidenceDir, { recursive: true });

writeFileSync(join(evidenceDir, 'result.json'), JSON.stringify({ fixture: basename(fixturePath), generatedAt, result }, null, 2));
writeFileSync(join(testReportDir, 'result.html'), renderTestReport(fixture, result, generatedAt));
writeFileSync(join(evidenceDir, 'result.html'), renderEvidenceReport(fixture, result, generatedAt));
writeFileSync(join(evidenceDir, 'result-screenshot.png'), renderPngSummary(result));

function renderTestReport(fixtureData, auditResult, timestamp) {
  return htmlPage('Ariada Framer fixture test report', `
    <h1>Ariada Framer fixture test report</h1>
    <p><strong>Fixture:</strong> ${escapeHtml(fixtureData.name)}</p>
    <p><strong>Generated:</strong> ${escapeHtml(timestamp)}</p>
    <p><strong>Scanned nodes:</strong> ${auditResult.scannedNodes}</p>
    <p><strong>Issues:</strong> ${auditResult.issues.length}</p>
    <table>
      <thead><tr><th>Rule</th><th>Severity</th><th>Node</th><th>Message</th></tr></thead>
      <tbody>${auditResult.issues.map(renderIssueRow).join('')}</tbody>
    </table>
  `);
}

function renderEvidenceReport(fixtureData, auditResult, timestamp) {
  const observedRules = auditResult.issues.map((issue) => escapeHtml(issue.rule)).join(', ');

  return htmlPage('Ariada Framer scan evidence', `
    <header class="hero">
      <p class="eyebrow">Ariada distribution channel evidence</p>
      <h1>Ariada Framer scan evidence</h1>
      <p>Local known-bad Framer frame fixture scanned through the same audit core used by the plugin adapter.</p>
    </header>

    <section class="metrics" aria-label="Run summary">
      <article><span>Fixture</span><strong>${escapeHtml(fixtureData.name)}</strong></article>
      <article><span>Generated</span><strong>${escapeHtml(timestamp)}</strong></article>
      <article><span>Scanned nodes</span><strong>${auditResult.scannedNodes}</strong></article>
      <article><span>Issues</span><strong>${auditResult.issues.length}</strong></article>
    </section>

    <section class="panel">
      <h2>What is Framer?</h2>
      <p>Framer is a visual website builder and design canvas with a plugin system for small apps that interact with the editor. In this channel, Ariada treats Framer as a pre-publication design surface where accessibility issues can be found before a page is published.</p>
    </section>

    <section class="panel">
      <h2>Why this is a separate Ariada channel</h2>
      <p>Framer combines design and no-code site publishing, so the useful handoff point is earlier than a production crawler. This channel checks the current frame or page for design-mappable problems: contrast, target size, and missing text alternative or description markers.</p>
    </section>

    <section class="panel">
      <h2>Roles: who pays / what value they buy</h2>
      <p>Designers and agencies buy earlier feedback inside their Framer workflow. Product and marketing teams buy lower rework before legal, QA, or launch review. EU site owners buy EAA and WCAG risk reduction before public customer journeys go live.</p>
    </section>

    <section class="panel">
      <h2>Implemented vs not implemented</h2>
      <div class="columns">
        <div>
          <h3>Implemented</h3>
          <ul>
            <li>Framer canvas-mode scaffold with plugin panel source.</li>
            <li>Design-node adapter for selection, current page, or canvas root.</li>
            <li>Contrast, target-size, and text-alternative checks.</li>
            <li>Known-bad local fixture with HTML and PNG evidence.</li>
          </ul>
        </div>
        <div>
          <h3>Not implemented</h3>
          <ul>
            <li>Live Framer dev-mode verification in this terminal session.</li>
            <li>Marketplace submission and paid listing configuration.</li>
            <li>Deep Framer node coverage beyond the defensive adapter scaffold.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="panel">
      <h2>Competitors</h2>
      <p>Adjacent tools include Framer Marketplace plugins, Figma and Sketch design checks, Webflow and Wix publishing checks, and production accessibility scanners from Deque, Siteimprove, Evinced, AudioEye, and accessiBe.</p>
    </section>

    <section class="panel">
      <h2>Domains</h2>
      <p>Primary domains are Framer design canvases, no-code marketing sites, agency landing pages, EU digital-service journeys, and pre-publication accessibility review.</p>
    </section>

    <section class="panel">
      <h2>Technical connectors</h2>
      <p>Technical connectors are <code>framer.json</code>, canvas mode, the Framer runtime object, <code>src/framer-adapter.cjs</code>, <code>src/audit.cjs</code>, and the local frame fixture.</p>
    </section>

    <section class="panel">
      <h2>Evidence</h2>
      <p><strong>Expected result:</strong> contrast, target-size, and text-alternative issues are present.</p>
      <p><strong>Observed result:</strong> ${observedRules}.</p>
      <table>
        <thead><tr><th>Path</th><th>Rule</th><th>Severity</th><th>Remediation</th></tr></thead>
        <tbody>${auditResult.issues.map((issue) => `
          <tr>
            <td>${escapeHtml(issue.path)}</td>
            <td>${escapeHtml(issue.rule)}</td>
            <td>${escapeHtml(issue.severity)}</td>
            <td>${escapeHtml(issue.remediation)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Screenshot</h2>
      <p><a href="./result-screenshot.png">Direct screenshot evidence PNG</a></p>
      <img src="./result-screenshot.png" alt="Ariada Framer scan evidence screenshot showing three issue rows." />
    </section>

    <section class="panel">
      <h2>Blockers</h2>
      <p>Live Framer dev-mode loading is explicitly blocked until a human signs in to Framer, enables Developer Tools in the plugin menu, runs <code>npm run dev</code>, and opens the development plugin from a Framer project canvas. The local fixture proves the audit path without using a hosted Framer account.</p>
    </section>

    <section class="panel">
      <h2>Distribution</h2>
      <p>Short term distribution is local development plugin loading for internal design review. After human Framer verification, the next distribution options are private workspace distribution and Framer Marketplace submission.</p>
    </section>

    <section class="panel">
      <h2>Monetization</h2>
      <p>The likely paid lane is an agency or team add-on: scan current Framer pages before publishing, export Ariada evidence, and map results into designer-owned fixes. Paid Ariada plans can add team evidence history, CLI parity, and compliance reporting.</p>
    </section>

    <section class="panel">
      <h2>Sources</h2>
      <ul>
        <li>Framer Developers, Welcome to Plugins, accessed 2026-07-01, primary/high: https://www.framer.com/developers/plugins-introduction</li>
        <li>Framer Developers, Quick Start, accessed 2026-07-01, primary/high: https://www.framer.com/developers/plugins-quick-start</li>
        <li>Framer Marketplace Plugins, accessed 2026-07-01, primary/high: https://www.framer.com/community/marketplace/plugins/</li>
      </ul>
      <p>This report covers competitors, domains, technical connectors, evidence, screenshot, blockers, distribution, monetization, sources.</p>
    </section>
  `);
}

function renderIssueRow(issue) {
  return `
    <tr>
      <td>${escapeHtml(issue.rule)}</td>
      <td>${escapeHtml(issue.severity)}</td>
      <td>${escapeHtml(issue.nodeName)}</td>
      <td>${escapeHtml(issue.message)}</td>
    </tr>
  `;
}

function htmlPage(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body { background: #f7f8fb; color: #111827; font-family: Arial, sans-serif; line-height: 1.45; margin: 0; }
    body > * { box-sizing: border-box; margin-left: auto; margin-right: auto; max-width: 1080px; width: calc(100% - 32px); }
    .hero { background: #111827; color: #f9fafb; max-width: none; padding: 32px max(24px, calc((100% - 1080px) / 2)); width: 100%; }
    .hero h1 { font-size: 30px; margin: 0 0 10px; }
    .hero p { max-width: 760px; }
    .eyebrow { color: #bfdbfe; font-size: 13px; font-weight: 700; letter-spacing: 0; margin: 0 0 8px; text-transform: uppercase; }
    .metrics { display: grid; gap: 12px; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 24px 0 12px; }
    .metrics article, .panel { background: #fff; border: 1px solid #d1d5db; border-radius: 6px; }
    .metrics article { padding: 14px; }
    .metrics span { color: #4b5563; display: block; font-size: 12px; margin-bottom: 6px; text-transform: uppercase; }
    .metrics strong { display: block; font-size: 18px; }
    .panel { margin-bottom: 14px; padding: 18px; }
    h2 { font-size: 20px; margin: 0 0 10px; }
    h3 { font-size: 16px; margin: 0 0 8px; }
    p { margin: 0 0 10px; }
    .columns { display: grid; gap: 18px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    table { border-collapse: collapse; margin-top: 14px; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    img { border: 1px solid #d1d5db; display: block; height: auto; margin-top: 12px; max-width: 100%; }
    a { color: #1d4ed8; }
    @media (max-width: 720px) {
      .metrics, .columns { grid-template-columns: 1fr; }
      .hero h1 { font-size: 24px; }
    }
  </style>
</head>
<body>${body}</body>
</html>
`;
}

function renderPngSummary(auditResult) {
  const width = 960;
  const height = 540;
  const pixels = Buffer.alloc(width * height * 4);
  fillRect(pixels, width, 0, 0, width, height, [249, 250, 251, 255]);
  fillRect(pixels, width, 0, 0, width, 92, [17, 24, 39, 255]);
  fillRect(pixels, width, 32, 132, 896, 316, [255, 255, 255, 255]);
  strokeRect(pixels, width, 32, 132, 896, 316, [209, 213, 219, 255]);

  auditResult.issues.forEach((issue, index) => {
    const y = 164 + index * 86;
    const color = issue.rule === 'contrast' ? [185, 28, 28, 255] : issue.rule === 'target-size' ? [146, 64, 14, 255] : [30, 64, 175, 255];
    fillRect(pixels, width, 58, y, 28, 28, color);
    fillRect(pixels, width, 104, y + 4, 520, 10, [31, 41, 55, 255]);
    fillRect(pixels, width, 104, y + 24, 680, 8, [107, 114, 128, 255]);
  });

  fillRect(pixels, width, 36, 32, 410, 18, [255, 255, 255, 255]);
  fillRect(pixels, width, 36, 60, 260, 10, [209, 213, 219, 255]);
  fillRect(pixels, width, 744, 32, 156, 36, [220, 38, 38, 255]);

  return encodePng(width, height, pixels);
}

function fillRect(pixels, width, x, y, rectWidth, rectHeight, color) {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let column = x; column < x + rectWidth; column += 1) {
      const offset = (row * width + column) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
}

function strokeRect(pixels, width, x, y, rectWidth, rectHeight, color) {
  fillRect(pixels, width, x, y, rectWidth, 1, color);
  fillRect(pixels, width, x, y + rectHeight - 1, rectWidth, 1, color);
  fillRect(pixels, width, x, y, 1, rectHeight, color);
  fillRect(pixels, width, x + rectWidth - 1, y, 1, rectHeight, color);
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * width * 4;
    const targetStart = y * (width * 4 + 1);
    scanlines[targetStart] = 0;
    rgba.copy(scanlines, targetStart + 1, sourceStart, sourceStart + width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND')
  ]);
}

function pngChunk(type, ...parts) {
  const typeBuffer = Buffer.from(type);
  const data = Buffer.concat(parts);
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
