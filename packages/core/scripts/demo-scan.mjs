// Demo: scan example.com + emit SSE-style event stream.
// Run:  node packages/core/scripts/demo-scan.mjs [URL]

import { scan, createEventEmitter, scoreFromCounts } from '../dist/index.js';

const url = process.argv[2] ?? 'https://example.com';

const emitter = createEventEmitter();
emitter.on((ev) => {
  const stamp = new Date().toISOString().slice(11, 23);
  let short;
  if (ev.kind === 'element_scan') {
    const seq = String(ev.seq).padStart(3);
    const violations = ev.violations ? `  \u2192 ${ev.violations.length} violations` : '';
    short = `  [${stamp}] ${ev.status.padEnd(9)} seq=${seq} ${ev.selector}${violations}`;
  } else {
    short = `  [${stamp}] ${ev.kind}  ${JSON.stringify(ev).slice(0, 160)}`;
  }
  console.log(short);
});

console.log(`\n\u2192 scanning ${url}\n`);
const t0 = Date.now();

try {
  const { report, events } = await scan(url, {
    elementIter: true,
    emitter,
    playwright: { browser: 'chromium', headless: true },
    timeoutMs: 45_000,
  });

  const ms = Date.now() - t0;
  const findings = report.findings['a11y'] ?? [];
  const counts = findings.reduce(
    (a, f) => { a[f.severity] = (a[f.severity] ?? 0) + 1; return a; },
    { critical: 0, serious: 0, moderate: 0, minor: 0 },
  );

  console.log(`\n== SUMMARY ==`);
  console.log(`scan_id:       ${report.scanId}`);
  console.log(`url:           ${report.url}`);
  console.log(`duration:      ${ms}ms`);
  console.log(`elements:      ${report.stats.elementsScanned}`);
  console.log(`events total:  ${events?.length ?? 0}`);
  console.log(`findings:      ${findings.length}  (critical=${counts.critical}, serious=${counts.serious}, moderate=${counts.moderate}, minor=${counts.minor})`);
  console.log(`score:         ${scoreFromCounts(counts)} / 100`);
  if (findings.length > 0) {
    console.log(`\n== TOP 5 FINDINGS ==`);
    for (const f of findings.slice(0, 5)) {
      console.log(`  [${f.severity}] ${f.ruleId}  \u2014 ${f.element.selector}`);
      console.log(`    ${f.message}`);
    }
  }
} catch (err) {
  console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
