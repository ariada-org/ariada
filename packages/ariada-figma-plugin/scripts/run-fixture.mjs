import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDesignNode, scanDesignSelection } from '../dist/scanner.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = resolve(packageRoot, 'tests/fixtures/known-bad-frame.json');
const evidenceDir = resolve(packageRoot, 'scan-evidence');
const testReportDir = resolve(packageRoot, 'test-report');
const resultJsonPath = resolve(evidenceDir, 'result.json');
const rawLogPath = resolve(evidenceDir, 'run-output.txt');
const testJsonPath = resolve(testReportDir, 'result.json');

mkdirSync(evidenceDir, { recursive: true });
mkdirSync(testReportDir, { recursive: true });

const fixture = parseDesignNode(JSON.parse(readFileSync(fixturePath, 'utf8')));
const result = scanDesignSelection([fixture], '2026-07-01T00:00:00.000Z');
const passed = result.summary.errors >= 3 && result.summary.findings >= 4;

writeJson(resultJsonPath, result);
writeJson(testJsonPath, {
  status: passed ? 'pass' : 'fail',
  fixture: 'tests/fixtures/known-bad-frame.json',
  expected: 'known-bad fixture must produce at least 3 errors and 4 findings',
  result,
});

const log = [
  'ariada-figma-plugin fixture harness',
  `fixture=${fixturePath}`,
  `selected=${result.selectedNodeCount}`,
  `visited=${result.visitedNodeCount}`,
  `errors=${result.summary.errors}`,
  `warnings=${result.summary.warnings}`,
  `findings=${result.summary.findings}`,
  `status=${passed ? 'PASS' : 'FAIL'}`,
].join('\n');

writeFileSync(rawLogPath, `${log}\n`, 'utf8');
writeFileSync(resolve(testReportDir, 'result.html'), renderTestReport(result, passed), 'utf8');
writeFileSync(resolve(evidenceDir, 'result.html'), renderEvidenceReport(result, passed), 'utf8');

if (!passed) {
  throw new Error('Known-bad fixture did not produce the required findings.');
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderTestReport(result, passed) {
  return pageShell(
    'ariada-figma-plugin fixture test report',
    `
      <section class="hero">
        <p class="eyebrow">Figma plugin fixture harness</p>
        <h1>Known-bad frame scan ${passed ? 'passed' : 'failed'}</h1>
        <p>The harness loads <code>tests/fixtures/known-bad-frame.json</code>, runs the same scanner used by the plugin adapter, and asserts that accessibility findings are emitted.</p>
      </section>
      ${summaryCards(result)}
      <section>
        <h2>Findings</h2>
        ${findingTable(result.findings)}
      </section>
      <section>
        <h2>Raw Outputs</h2>
        <ul>
          <li><a href="../scan-evidence/result.json">Normalized scan JSON</a></li>
          <li><a href="../scan-evidence/run-output.txt">Harness log</a></li>
        </ul>
      </section>
    `,
  );
}

function renderEvidenceReport(result, passed) {
  return pageShell(
    'ariada-figma-plugin scan evidence',
    `
      <section class="hero">
        <p class="eyebrow">S5 Ariada distribution channel</p>
        <h1>Figma plugin for design-time accessibility checks</h1>
        <p>The channel brings Ariada checks into the designer workflow before implementation. It runs locally inside a Figma plugin, inspects selected frames/components, and reports design-mappable findings for contrast, target size, text alternatives, and semantic naming metadata.</p>
      </section>
      ${summaryCards(result)}
      <section>
        <h2>What is Figma?</h2>
        <p>Figma is a collaborative product-design tool where teams create interface mockups, design-system components, prototypes, and handoff specifications before frontend implementation. For accessibility work, this makes Figma a design-tool channel rather than a code, browser, CI, or runtime channel: the available evidence is layer structure, text, fills, sizes, component names, and designer-authored metadata.</p>
      </section>
      <section>
        <h2>Why this is a separate Ariada channel</h2>
        <p>Figma deserves a separate Ariada channel because design defects appear before code exists. A normal Ariada web scan can validate real DOM, CSS, ARIA, and browser behavior, but it cannot warn a designer while the problem is still a frame, component, color token, or unnamed image layer. This plugin gives shift-left feedback inside the design surface and leaves runtime proof to downstream Ariada scanners.</p>
      </section>
      <section>
        <h2>Roles: who pays / what value they buy</h2>
        <table>
          <thead><tr><th>Role</th><th>Value bought</th><th>Likely budget owner</th></tr></thead>
          <tbody>
            <tr><td>Designer</td><td>Immediate layer-level feedback on contrast, touch target size, and missing image descriptions before handoff.</td><td>Design team tooling or individual plugin budget</td></tr>
            <tr><td>Design-system owner</td><td>Reusable checks for components and tokens so inaccessible patterns do not spread through the system.</td><td>Design systems, platform, or enablement team</td></tr>
            <tr><td>Frontend engineer</td><td>Cleaner handoff with fewer accessibility defects arriving as implementation rework or CI failures.</td><td>Frontend platform or engineering productivity budget</td></tr>
            <tr><td>Accessibility/compliance owner</td><td>Earlier evidence that EAA/WCAG risks were considered before implementation and QA.</td><td>Accessibility, legal/compliance, or risk budget</td></tr>
            <tr><td>Agency/product owner</td><td>A visible design-review artifact that reduces late remediation cost and supports client acceptance.</td><td>Project delivery, product, or client-billable QA budget</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Channel User Preferences</h2>
        <ul>
          <li>Fast local feedback on the current selection.</li>
          <li>No account token and no network disclosure for design files.</li>
          <li>Layer-level findings that designers can fix without reading CI logs.</li>
          <li>Clear limitation boundary between design evidence and DOM/runtime evidence.</li>
        </ul>
      </section>
      <section>
        <h2>Competitors And Narrow Evidence Competitors</h2>
        <p>Narrow competitors are Figma accessibility plugins such as Stark and Able, plus design-system linting tools that focus on contrast and annotations. Ariada differs by mapping each finding to the same product compliance vocabulary used by the broader Ariada scanner family and by keeping this build offline.</p>
      </section>
      <section>
        <h2>Research Sources</h2>
        <ul>
          <li><a href="https://developers.figma.com/docs/plugins/manifest/">Figma plugin manifest documentation</a> — primary source, current developer reference, high reliability.</li>
          <li><a href="https://developers.figma.com/docs/plugins/api/properties/PageNode-selection/">Figma PageNode selection API documentation</a> — primary source, current developer reference, high reliability.</li>
          <li><a href="https://www.getstark.co/figma/">Stark for Figma</a> — vendor source for a narrow design-accessibility competitor, medium reliability for competitor positioning.</li>
          <li><a href="https://www.figma.com/blog/design-for-everyone-with-these-accessibility-focused-plugins/">Figma accessibility plugin roundup</a> — Figma source naming Able and contrast-checking plugins, medium reliability because it is older but still useful as channel evidence.</li>
        </ul>
      </section>
      <section>
        <h2>Implemented vs not implemented</h2>
        <table>
          <thead><tr><th>Area</th><th>Status</th><th>Evidence</th></tr></thead>
          <tbody>
            <tr><td>Manifest and local plugin entry</td><td>implemented</td><td><code>manifest.json</code>, <code>src/code.ts</code>, <code>src/ui.html</code></td></tr>
            <tr><td>Contrast checks</td><td>implemented</td><td>Known-bad text emits <code>ariada.design.contrast.minimum</code></td></tr>
            <tr><td>Target size checks</td><td>implemented</td><td>20x20 button emits minimum error; 32x32 link emits recommended warning</td></tr>
            <tr><td>Missing alt/description checks</td><td>implemented</td><td>Image rectangle emits <code>ariada.design.text-alternative.missing</code></td></tr>
            <tr><td>Figma Community publication</td><td>blocked</td><td>Requires founder-owned Figma account and marketplace review</td></tr>
            <tr><td>Runtime DOM validation</td><td>missing by design</td><td>Handled by downstream Ariada web scanners after implementation</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Domains Roadmap</h2>
        <table>
          <thead><tr><th>Domain</th><th>Status</th><th>Next step</th></tr></thead>
          <tbody>
            <tr><td>WCAG accessibility</td><td>implemented</td><td>Expand design-mappable rules beyond contrast, targets, and text alternatives</td></tr>
            <tr><td>EAA product evidence</td><td>planned</td><td>Export design evidence into Ariada evidence packs</td></tr>
            <tr><td>Brand/design governance</td><td>planned</td><td>Add token naming and component annotation checks</td></tr>
            <tr><td>Data provenance</td><td>planned</td><td>Record source frame metadata when a user exports a report</td></tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Technical Connectors</h2>
        <p>The plugin uses Figma <code>figma.currentPage.selection</code>, local layer properties, and plugin data keys <code>role</code>, <code>alt</code>, <code>aria-label</code>, <code>description</code>, <code>decorative</code>, and <code>headingLevel</code>. The manifest declares <code>networkAccess.allowedDomains: ["none"]</code>.</p>
      </section>
      <section>
        <h2>E2E Test Adequacy</h2>
        <p>The harness scans a representative nested Figma node fixture with known low contrast, undersized interactive controls, and missing image metadata. It proves scanner behavior and report generation. Desktop Figma manual loading remains a human-gated check because this shell cannot automate the Figma desktop app or Figma Community submission.</p>
      </section>
      <section>
        <h2>Raw JSON And Logs</h2>
        <ul>
          <li><a href="./result.json">Normalized scan JSON</a></li>
          <li><a href="./run-output.txt">Fixture harness log</a></li>
          <li><a href="../test-report/result.html">Fixture test report</a></li>
        </ul>
      </section>
      <section>
        <h2>Embedded Screenshot</h2>
        <p><a href="./screenshot.png">Open screenshot directly</a></p>
        <a href="./screenshot.png"><img src="./screenshot.png" alt="Rendered scan-evidence report for ariada-figma-plugin"></a>
      </section>
      <section>
        <h2>Blockers</h2>
        <ul>
          <li>Figma Community publishing requires founder account ownership and marketplace review.</li>
          <li>Live Figma desktop loading must be verified manually after local build.</li>
          <li>Export into shared Ariada evidence packs is not implemented in this channel build.</li>
        </ul>
      </section>
      <section>
        <h2>Distribution And Monetization Next Steps</h2>
        <ul>
          <li>Founder loads <code>manifest.json</code> in Figma desktop development mode.</li>
          <li>After manual smoke test, prepare Figma Community listing screenshots and privacy copy emphasizing no network access.</li>
          <li>Bundle the plugin as a free lead channel for design teams, with paid value in evidence export, team policy packs, and downstream CI gating.</li>
        </ul>
      </section>
      <section>
        <h2>Raw Normalized Report</h2>
        <pre><code>${escapeHtml(JSON.stringify(result, null, 2))}</code></pre>
      </section>
    `,
  );
}

function summaryCards(result) {
  return `
    <section class="summary" aria-label="Scan summary">
      <div><strong>${result.summary.errors}</strong><span>Errors</span></div>
      <div><strong>${result.summary.warnings}</strong><span>Warnings</span></div>
      <div><strong>${result.visitedNodeCount}</strong><span>Nodes visited</span></div>
      <div><strong>${result.summary.findings}</strong><span>Findings</span></div>
    </section>
  `;
}

function findingTable(findings) {
  const rows = findings
    .map(
      (finding) => `
        <tr>
          <td>${escapeHtml(finding.severity)}</td>
          <td>${escapeHtml(finding.nodeName)}</td>
          <td><code>${escapeHtml(finding.ruleId)}</code></td>
          <td>${escapeHtml(finding.message)}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table>
      <thead><tr><th>Severity</th><th>Node</th><th>Rule</th><th>Message</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function pageShell(title, body) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #16201d; background: #f6f4ef; }
    body { margin: 0; }
    main { max-width: 1080px; margin: 0 auto; padding: 28px 22px 56px; }
    section { margin-top: 20px; }
    .hero { margin-top: 0; padding-bottom: 18px; border-bottom: 1px solid #cfc8bb; }
    .eyebrow { margin: 0 0 8px; color: #56635e; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0; }
    h1 { margin: 0; font-size: 34px; line-height: 1.12; letter-spacing: 0; }
    h2 { margin: 0 0 10px; font-size: 18px; letter-spacing: 0; }
    p, li { line-height: 1.55; }
    a { color: #075b7a; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .summary div, table, pre { border: 1px solid #cfc8bb; border-radius: 8px; background: #fffdfa; }
    .summary div { padding: 14px; }
    .summary strong { display: block; font-size: 28px; }
    .summary span { color: #56635e; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #ded8ce; text-align: left; vertical-align: top; }
    th { background: #ece7dc; }
    code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.92em; }
    pre { overflow: auto; padding: 14px; }
    img { display: block; max-width: 100%; min-height: 120px; border: 1px solid #cfc8bb; border-radius: 8px; background: #fff; }
    @media (max-width: 720px) { .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } h1 { font-size: 26px; } }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>
`;

  // Trailing blanks come off line by line rather than by a pattern.
  //
  // Both patterns tried before this were reported as backtracking: anchoring a
  // run of spaces to the end of its line retries from every position inside the
  // run, and looking ahead for the newline keeps the same shape because the
  // end-of-input alternative can still match empty. Walking the lines has no
  // such reading — one pass, one trim each — and it is easier to be sure of
  // than either regular expression was.
  return html
    .split('\n')
    .map((line) => {
      let end = line.length;
      while (end > 0 && (line[end - 1] === ' ' || line[end - 1] === '\t')) end -= 1;
      return line.slice(0, end);
    })
    .join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
