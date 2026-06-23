#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'scan-evidence');
mkdirSync(outDir, { recursive: true });

const esc = (value) => String(value).replace(/[&<>"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
})[char]);

const screenshotPath = join(outDir, 'maven-evidence.png');
const screenshot = existsSync(screenshotPath)
  ? `data:image/png;base64,${readFileSync(screenshotPath).toString('base64')}`
  : '';
const realScanPath = join(outDir, 'real-scan', 'multi-domain-report.json');

function scanSummary() {
  if (!existsSync(realScanPath)) {
    return {
      status: 'REAL SCAN BLOCKED',
      total: 0,
      text: 'No real CLI scan JSON is present yet. Run Ariada CLI against the Maven/Java fixture or document the host blocker.',
      rows: '',
      domainRows: '',
    };
  }
  const report = JSON.parse(readFileSync(realScanPath, 'utf8'));
  const severityCounts = new Map();
  const domainCounts = new Map();
  let total = 0;
  for (const site of report.sites ?? []) {
    const domains = report.grid?.[site] ?? {};
    for (const [domain, findings] of Object.entries(domains)) {
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + findings.length);
      for (const finding of findings) {
        total += 1;
        severityCounts.set(finding.severity, (severityCounts.get(finding.severity) ?? 0) + 1);
      }
    }
  }
  const severityOrder = ['critical', 'serious', 'moderate', 'minor'];
  const rows = [...severityCounts.entries()]
    .sort(([left], [right]) => severityOrder.indexOf(left) - severityOrder.indexOf(right))
    .map(([severity, count]) => `<tr><th scope="row">${esc(severity)}</th><td>${count}</td></tr>`)
    .join('');
  const domainRows = [...domainCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, count]) => `<tr><th scope="row">${esc(domain)}</th><td>${count}</td></tr>`)
    .join('');
  return {
    status: total > 0 ? 'REAL SCAN: FAILING FIXTURE' : 'REAL SCAN: PASS',
    total,
    text: `Real Ariada CLI scan ran against the representative Maven/Java fixture and wrote ${total} finding(s) to real-scan/multi-domain-report.json.`,
    rows,
    domainRows,
  };
}

const realScan = scanSummary();

const table = (headers, rows) => `<table>
  <thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;

const roleRows = [
  ['Java web developer', 'Adds the Maven plugin to an existing Spring/Thymeleaf/JSF/JSP build.', 'Fast local signal in the native Maven verify phase.', 'Usually influencer, not budget owner.'],
  ['CI / platform owner', 'Pins the plugin in shared parent POMs and CI templates.', 'Repeatable accessibility evidence before release.', 'Likely first technical buyer in a platform team.'],
  ['Product owner for Java web app', 'Requires an attachable evidence artifact for release review.', 'Reduced release risk and clearer remediation backlog.', 'Budget owner for app-level compliance tooling.'],
  ['Accessibility / compliance reviewer', 'Reviews raw JSON, Maven logs, and HTML evidence report.', 'Audit trail without asking engineers to rerun scans manually.', 'Approver or enterprise buyer with governance budget.'],
].map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${esc(cell)}</th>` : `<td>${esc(cell)}</td>`).join('')}</tr>`).join('');

const implementedRows = [
  ['Maven goal', 'Implemented', 'ariada:scan, default phase verify.'],
  ['CLI reuse', 'Implemented', 'Invokes @ariada-org/cli by default through npx; no Java scanner fork.'],
  ['URL scan', 'Implemented', 'ariada.url accepts an http(s) target.'],
  ['Static site scan', 'Implemented', 'ariada.siteDirectory is served on localhost and scanned through the CLI.'],
  ['Gate logic', 'Implemented', 'Fails Maven build when findings meet or exceed ariada.severityThreshold.'],
  ['JSON parsing', 'Implemented', 'Supports legacy scan.json and current multi-domain-report.json.'],
  ['Publication', 'Not implemented', 'Maven Central release needs founder-owned Central Portal namespace, GPG key and token.'],
  ['Enterprise parent-POM rollout docs', 'Not implemented', 'Needs follow-up examples for multi-module Java estates.'],
].map((row) => `<tr><th scope="row">${esc(row[0])}</th><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('');

const domainRows = [
  ['Accessibility', 'Implemented by shared Ariada core', 'High', 'Primary wedge for Maven web builds: fail release on WCAG/EAA evidence gaps.'],
  ['Security headers', 'Implemented by shared Ariada core', 'Medium', 'Useful for server-rendered Java apps where CSP/referrer headers are release concerns.'],
  ['Privacy', 'Implemented by shared Ariada core', 'Medium', 'Applies when Java pages set cookies, forms, analytics or consent surfaces.'],
  ['AI readiness / GEO', 'Implemented by shared Ariada core', 'Medium', 'Public docs and data portals benefit from robots/llms.txt/structured attribution checks.'],
  ['Structured data / SEO', 'Partly implemented by shared Ariada core', 'Medium', 'Relevant for public Java sites and government/service portals; needs richer SEO rules later.'],
  ['Sustainability', 'Implemented by shared Ariada core', 'Low to medium', 'Useful for heavy Java-rendered pages; secondary wedge after accessibility.'],
  ['Performance / Core Web Vitals', 'Planned Ariada domain, not in this plugin', 'Medium', 'Maven can expose the built page, but performance domain needs its own Ariada PRD/package.'],
  ['i18n / localization', 'Planned Ariada domain, not in this plugin', 'High for EU public sector', 'Java estates often serve multilingual portals; should become a later Maven gate.'],
  ['Reliability / availability', 'Candidate domain', 'Medium', 'Build-time link and readiness checks can complement runtime monitoring, but not replace it.'],
  ['Data quality / provenance', 'Candidate domain', 'Medium for dashboards', 'Relevant when Java pages publish analytics, public datasets or regulated statements.'],
].map((row) => `<tr><th scope="row">${esc(row[0])}</th><td>${esc(row[1])}</td><td>${esc(row[2])}</td><td>${esc(row[3])}</td></tr>`).join('');

const competitorRows = [
  ['Maven build plugins', 'SpotBugs, Checkstyle, PMD, OWASP Dependency-Check, CycloneDX Maven Plugin', 'Strong for code quality, dependency security and SBOM; weak for browser-rendered accessibility evidence.'],
  ['Accessibility scanners', 'axe, Pa11y, Lighthouse CI, Siteimprove, Deque/Evinced enterprise tools', 'Strong scan engines; Maven-native Java release integration is not the main product surface.'],
  ['Java/Spring ecosystem', 'Spring Boot Actuator, Maven Site, parent POM governance, enterprise CI templates', 'Strong distribution channel; Ariada should integrate as an evidence layer, not a Java web framework.'],
  ['Compliance/GRC workflows', 'Jira/ServiceNow/manual audit exports', 'Strong approval systems; weak repeatable developer-owned evidence from Maven verify.'],
].map((row) => `<tr><th scope="row">${esc(row[0])}</th><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join('');

const artifactRows = [
  ['Plugin jar', 'target/ariada-maven-plugin-0.1.0-SNAPSHOT.jar', 'Generated locally by mvn -B package; not committed.'],
  ['Unit test report', 'target/surefire-reports/', 'Generated locally by Maven; not committed.'],
  ['Invoker report', 'target/invoker-reports/', 'Generated locally by mvn -B verify; not committed.'],
  ['Raw scan JSON', 'scan-evidence/real-scan/multi-domain-report.json', 'Committed evidence from real Ariada CLI scan against the Java fixture.'],
  ['HTML evidence', 'scan-evidence/result.html', 'Self-contained reviewer-ready channel report.'],
  ['Standalone screenshot', 'scan-evidence/maven-evidence.png', 'Committed PNG and embedded in the HTML report; open link for full-size review.'],
].map((row) => `<tr><th scope="row">${esc(row[0])}</th><td><code>${esc(row[1])}</code></td><td>${esc(row[2])}</td></tr>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>S100 Maven plugin evidence - Ariada</title>
<style>
  body { margin: 0; font: 16px/1.55 system-ui, sans-serif; color: #17191f; background: #f7f8fb; }
  header, main, footer { max-width: 1160px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 2rem; margin: 0 0 8px; }
  h2 { font-size: 1.25rem; margin-top: 32px; border-bottom: 1px solid #d8dde6; padding-bottom: 6px; }
  h3 { font-size: 1rem; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; background: #fff; margin: 10px 0 18px; }
  th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid #e5e8ef; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  code { background: #eef1f6; padding: 1px 5px; border-radius: 4px; }
  pre { background: #101828; color: #f4f7fb; padding: 14px; border-radius: 8px; overflow: auto; }
  pre code { background: transparent; color: inherit; padding: 0; border-radius: 0; }
  .badge { display: inline-block; font-weight: 700; border: 2px solid #0a6b33; color: #0a6b33; background: #e8f7ee; padding: 4px 10px; border-radius: 999px; margin: 0 4px 4px 0; }
  .warn { border-color: #9a5b00; color: #7a4300; background: #fff3d8; }
  figure { margin: 0; background: #fff; border: 1px solid #d8dde6; border-radius: 8px; overflow: hidden; }
  img { display: block; width: 100%; height: auto; }
  figcaption { padding: 10px 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .box { background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 14px; }
</style>
</head>
<body>
<header>
  <h1>S100 Maven plugin channel evidence</h1>
  <p><span class="badge">BUILT LOCALLY</span><span class="badge">${esc(realScan.status)}</span><span class="badge warn">NOT PUBLISHED</span></p>
  <p>This is the reviewer-ready evidence dossier for <code>integrations/maven-ariada/</code>. The channel is Maven: the default Java build and release gate used by many Spring MVC, Thymeleaf, JSF, JSP and Maven Site web projects. The adapter exists so Java teams can add Ariada evidence to the build they already trust instead of adopting a new dashboard framework or scanner runtime.</p>
</header>
<main>
  <h2>Why Maven Is A Separate Channel</h2>
  <p>Maven is not just a package registry path. It is where Java web teams already enforce tests, static analysis, dependency security and release policy. A Maven plugin can reach enterprise Java estates through parent POMs, CI templates and the <code>verify</code> phase. That makes the wedge narrow and practical: "you already build Java web output with Maven; add repeatable accessibility and compliance evidence before release."</p>

  <h2>Roles, Payers And Hooks</h2>
  ${table(['Role', 'Hook', 'Value Bought', 'Payment Influence'], roleRows)}

  <h2>What Is Implemented And Not Implemented</h2>
  ${table(['Capability', 'Status', 'Detail'], implementedRows)}

  <h2>Ariada Core Used</h2>
  <div class="grid">
    <div class="box"><h3>Scanner runtime</h3><p>The plugin calls <code>@ariada-org/cli</code>; it does not port browser capture, rules or scoring into Java.</p></div>
    <div class="box"><h3>Report contracts</h3><p>The parser accepts the current <code>multi-domain-report.json</code> and older <code>scan.json</code> envelopes so the Maven gate follows Ariada CLI evolution.</p></div>
    <div class="box"><h3>Build gate</h3><p>Java code only maps CLI findings into Maven pass/fail behavior through <code>MojoFailureException</code>.</p></div>
  </div>

  <h2>Tested Surface</h2>
  <p>The representative surface is <code>fixtures/java-webapp/index.html</code>: static HTML standing in for Maven-built Java web output from Spring MVC, Thymeleaf, JSF, JSP or Maven Site. It intentionally contains missing image alternative text and an unlabeled filter input. The deterministic Maven Invoker test uses a CLI stub to prove Maven gate behavior; the committed raw evidence uses a real Ariada CLI browser scan against the fixture served on localhost.</p>
  <p>${esc(realScan.text)} Raw JSON: <a href="real-scan/multi-domain-report.json">real-scan/multi-domain-report.json</a>.</p>
  ${realScan.rows ? table(['Severity', 'Findings'], realScan.rows) : ''}
  ${realScan.domainRows ? table(['Domain', 'Findings'], realScan.domainRows) : ''}

  <h2>Domain Roadmap And Applicability</h2>
  ${table(['Domain', 'Implementation Status', 'Maven Applicability', 'Implication'], domainRows)}

  <h2>Narrow Competitors In This Channel</h2>
  ${table(['Competitive Set', 'Examples', 'Implication For Ariada'], competitorRows)}

  <h2>Evidence Artifacts</h2>
  ${table(['Artifact', 'Path', 'Review Note'], artifactRows)}
  <p>Standalone screenshot link: <a href="maven-evidence.png">maven-evidence.png</a>. Raw scan JSON link: <a href="real-scan/multi-domain-report.json">real-scan/multi-domain-report.json</a>.</p>
  ${screenshot ? `<figure><a href="maven-evidence.png"><img src="${screenshot}" alt="Screenshot of the S100 Maven plugin evidence report with Maven channel context, implementation status, real scan summary and coordinator hub row." /></a><figcaption>Embedded screenshot captured from this local evidence report. Open full-size PNG: <a href="maven-evidence.png">maven-evidence.png</a>.</figcaption></figure>` : '<p>No screenshot captured yet. Run the screenshot command after generating this report.</p>'}

  <h2>Verification And Test Adequacy</h2>
  <pre>${esc(`mvn -B -f integrations/maven-ariada/pom.xml package
mvn -B -f integrations/maven-ariada/pom.xml verify
node packages/ariada-cli/dist/bin.js scan http://127.0.0.1:48817/ --format json --output-dir integrations/maven-ariada/scan-evidence/real-scan --severity-threshold moderate
node integrations/maven-ariada/scripts/build-evidence-report.mjs
Google Chrome headless screenshot of integrations/maven-ariada/scan-evidence/result.html`)}</pre>
  <p>Adequacy: good enough for channel adapter review because it proves Java compilation, Maven plugin descriptor generation, parser behavior, gate threshold logic, localhost static-site serving, Maven Invoker integration and a real Ariada browser scan of a representative Java web surface. It is not enough to claim Maven Central publication, enterprise parent-POM rollout, or coverage across Spring Boot runtime variants.</p>

  <h2>Visual Evidence Review</h2>
  <p><strong>VISUAL_EVIDENCE_GAP:</strong> the committed PNG currently shows the generated evidence report page, not the scanned Java fixture or a scan-result preview. It is useful for layout review only. The white-strip artifact visible in the command block was a report-rendering defect caused by light inline <code>code</code> styling inside a dark <code>pre</code> block; the generator now renders command logs as plain <code>pre</code> text and overrides <code>pre code</code> styling.</p>
  <p>Next required capture: generate a screenshot of either the tested Maven Java fixture or a dedicated scan-result preview page, then keep the report screenshot only as optional layout evidence.</p>

  <h2>Blockers</h2>
  <p>Maven Central publishing is not claimed. It requires founder-owned Sonatype Central Portal namespace verification for <code>org.ariada</code>, GPG signing key, publishing token and release review. Enterprise rollout also needs follow-up docs for parent POMs, multi-module builds and CI snippets.</p>

  <h2>Distribution And Publishing Next Steps</h2>
  <ol>
    <li>Reserve and verify the Maven Central namespace for <code>org.ariada</code>.</li>
    <li>Add release signing and Central Portal publishing profile after founder token/GPG setup.</li>
    <li>Write Spring Boot, Thymeleaf and Maven Site examples.</li>
    <li>Add CI snippets for GitHub Actions, GitLab CI and Jenkins using <code>mvn verify</code>.</li>
    <li>Publish documentation page and link it from the delivery hub.</li>
  </ol>

  <h2>Coordinator Hub Row</h2>
  <p>Update S100 from <code>PLANNED</code> to <code>BUILT</code>. Code path: <code>integrations/maven-ariada/</code>. Test report: <code>integrations/maven-ariada/target/surefire-reports/</code> and <code>integrations/maven-ariada/target/invoker-reports/</code> generated locally, not committed. Evidence report: <code>integrations/maven-ariada/scan-evidence/result.html</code>. Human blocker: <code>Maven Central namespace/signing/token</code>. Do not mark published until Central Portal release is visible.</p>
</main>
<footer>
  <p>Maintained by Alexander Brichkin (Agonist Development AB). Generated for local review; no public push performed.</p>
</footer>
</body>
</html>`;

writeFileSync(join(outDir, 'result.html'), html, 'utf8');
console.log(join(outDir, 'result.html'));
