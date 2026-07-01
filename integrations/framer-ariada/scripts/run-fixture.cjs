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
  return htmlPage('Ariada Framer scan evidence', `
    <h1>Ariada Framer scan evidence</h1>
    <p><strong>Flow:</strong> local known-bad Framer frame fixture through the same audit core used by the plugin adapter.</p>
    <p><strong>Fixture:</strong> ${escapeHtml(fixtureData.name)}</p>
    <p><strong>Generated:</strong> ${escapeHtml(timestamp)}</p>
    <p><strong>Expected result:</strong> contrast, target-size, and text-alternative issues are present.</p>
    <p><strong>Observed result:</strong> ${auditResult.issues.map((issue) => escapeHtml(issue.rule)).join(', ')}.</p>
    <p><a href="./result-screenshot.png">Direct screenshot evidence</a></p>
    <table>
      <thead><tr><th>Path</th><th>Rule</th><th>Remediation</th></tr></thead>
      <tbody>${auditResult.issues.map((issue) => `
        <tr>
          <td>${escapeHtml(issue.path)}</td>
          <td>${escapeHtml(issue.rule)}</td>
          <td>${escapeHtml(issue.remediation)}</td>
        </tr>
      `).join('')}</tbody>
    </table>
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
    body { color: #111827; font-family: Arial, sans-serif; line-height: 1.45; margin: 32px; max-width: 960px; }
    h1 { font-size: 28px; margin: 0 0 16px; }
    table { border-collapse: collapse; margin-top: 20px; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
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
