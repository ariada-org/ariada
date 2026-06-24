#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const outDir = join(root, 'scan-evidence');
const centralRoot = 'file:///Users/pedro/adopta';
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

function table(headers, rows) {
  return `<table>
  <thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function rows(items) {
  return items
    .map((row) => `<tr>${row.map((cell, index) => index === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`)
    .join('\n');
}

function link(href, label) {
  return `<a href="${esc(href)}">${esc(label)}</a>`;
}

function sourceLink(href, label) {
  return href ? link(href, label) : esc(label);
}

function scanSummary() {
  if (!existsSync(realScanPath)) {
    return {
      status: 'REAL SCAN BLOCKED',
      total: 0,
      text: 'No real CLI scan JSON is present yet. Run Ariada CLI against the Maven/Java fixture or document the host blocker.',
      severityRows: '',
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
  return {
    status: total > 0 ? 'REAL SCAN: FAILING FIXTURE' : 'REAL SCAN: PASS',
    total,
    text: `Real Ariada CLI scan ran against the representative Maven/Java fixture and wrote ${total} finding(s) to real-scan/multi-domain-report.json.`,
    severityRows: rows([...severityCounts.entries()]
      .sort(([left], [right]) => severityOrder.indexOf(left) - severityOrder.indexOf(right))
      .map(([severity, count]) => [esc(severity), String(count)])),
    domainRows: rows([...domainCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, count]) => [esc(domain), String(count)])),
  };
}

const realScan = scanSummary();

const channelRows = rows([
  ['Что такое Maven', 'Maven is the standard Java build automation and project management channel built around a POM, lifecycle phases, plugins, reports and artifact publishing. For Java teams it is not only a package tool; it is where tests, static analysis, dependency checks, site/report generation and release policy are already enforced.'],
  ['Почему Maven отдельный канал Ariada', 'Java/Spring/Thymeleaf/JSF/JSP teams will not adopt a Python/Node dashboard-style workflow just to prove accessibility. They already trust `mvn verify`, parent POMs, pluginManagement, Nexus/Artifactory caches and CI templates. A Maven adapter lets Ariada enter the release gate where Java teams already make go/no-go decisions.'],
  ['Узкий wedge', 'Do not sell Ariada as a Java web framework or as a replacement for Spring, JSF, JSP, Vaadin, Wicket, Thymeleaf, Maven Site or internal CI. Sell it as repeatable rendered-surface evidence for Java web output: raw JSON, command log, screenshot and stable HTML report generated from a Maven-controlled build/release flow.'],
  ['Market boundary', 'The relevant market is not all Java tooling and not all GRC. It is the intersection of Maven build plugins, Java web release gates, rendered web accessibility/security/privacy evidence, and enterprise CI artifact governance.'],
  ['Current adapter status', 'This package is an MVP evidence bridge. It is Maven-shaped and compiles/tests as a plugin, but the scanner runtime is still the shared Ariada CLI with browser capture. That is acceptable for CI/release if pinned/cached, but should not be sold as a fully native Java scanner.'],
]);

const cultureRows = rows([
  ['Java web developer', 'Accepts `mvn test`, `mvn verify`, Surefire/Failsafe, Checkstyle/PMD/SpotBugs style checks, Spring Boot test startup and explicit plugin goals. Rejects surprise `npx latest` downloads during every local compile/test, opaque browser bootstrap, and non-deterministic network calls in the fast loop.', 'Local use should be explicit: `mvn ariada:scan` or an opt-in `-Pariada` profile after the app/site is built. The default fast compile/test loop should not become slow or flaky.'],
  ['Build engineer / Maven maintainer', 'Accepts parent POMs, pluginManagement, locked versions, reproducible output, dependency convergence, Maven Enforcer, proxy-friendly downloads and build cache conventions. Rejects mutable latest versions, hidden transitive runtimes, credentials in POMs and tools that break offline/proxied enterprise builds.', 'Ariada must pin the scanner version, document Nexus/Artifactory/proxy behavior, isolate browser cache, and make the runtime path configurable.'],
  ['CI / platform owner', 'Accepts heavier checks in CI/release/nightly jobs when artifacts are stable, exit codes are predictable and caches are declared. Rejects developer-owned browser setup, flaky headless runs and reports scattered in random folders.', 'Primary Maven path is CI/release evidence: cache browser/runtime, run once against built web output or live localhost app, upload JSON/log/screenshot/report artifacts.'],
  ['Release manager', 'Accepts verify-phase gates, release profiles, signed artifacts, deterministic report paths and failure thresholds. Rejects tools that block release without explaining what artifact proves the failure.', 'Ariada must emit stable paths under `target/ariada/` or configured output, explain pass/fail severity, and produce attachable release evidence.'],
  ['Security/compliance reviewer', 'Accepts evidence packets with raw source, command, timestamp, screenshot and rule mapping. Rejects “we ran a scan” claims without reproducible logs and without a reviewed visual surface.', 'The reviewer consumes the report; they should not need to install Node, Maven or browser dependencies to understand the evidence.'],
  ['Enterprise architect', 'Accepts plugins that fit Spring/Jakarta EE estates, multi-module builds, parent POM governance and internal repositories. Rejects framework replacement and tooling that forces teams out of Java ecosystem conventions.', 'Position Maven Ariada as a governance overlay on existing Java estates, not as a new runtime or app framework.'],
]);

const solutionRows = rows([
  ['Primary entrypoint', '`org.ariada:ariada-maven-plugin` bound by parent POM/pluginManagement to an explicit `ariada` or release profile. The goal scans a configured URL or built site directory and writes JSON/log/screenshot/report artifacts to a predictable output directory.', 'This is the Java/Maven-shaped adoption path. It lets build engineers standardize the gate without asking every Java team to learn Ariada internals.'],
  ['Fallback entrypoint', 'Reusable GitHub Action, GitLab CI template, Jenkins shared library and Docker image that run Maven plus the Ariada scanner runtime in a pinned container/cache.', 'This is the safest path for enterprises that dislike local browser/runtime setup or run behind proxies. It also mirrors the Go lesson: hide heavy runtime in CI/Docker, not every developer laptop.'],
  ['Convenience entrypoint', '`mvn org.ariada:ariada-maven-plugin:scan -Dariada.url=http://localhost:8080` for explicit local runs and demos.', 'Good for developers proving the concept, but not the commercial product by itself.'],
  ['Future native path', 'Maven Central release with plugin prefix, Java-friendly config, `target/ariada/*` artifact contract, proxy/cache docs, signed releases, and optionally a sidecar/single-binary runtime that hides Node/browser bootstrap.', 'This is the path from MVP bridge to idiomatic Maven product. Do not claim it is complete until Central publishing and proxy/offline docs exist.'],
  ['What developer should not own', 'The developer should not manually install Node, Playwright browsers or mutable npm packages in every Java repo. CI/platform should cache/pin these, or Ariada should provide a Docker/Action/hosted worker path.', 'This is the key product constraint. If ignored, Maven/Java adoption will stall even if the plugin compiles.'],
  ['Free vs paid', 'Free/open-source: Maven plugin wrapper, local scan command, basic report, examples. Paid/hosted: retention, baselines, signed exports, team dashboards, domain packs, policy management, SSO/SCIM, reviewer workflow and fleet rollout support.', 'Monetize the evidence system and compliance workflow, not the thin wrapper.'],
]);

const roleOfferRows = rows([
  ['Java web developer', '“Run the same release evidence from the build I already use.”', 'Maven goal, explicit `ariada` profile, local report, raw JSON and command log.', 'Usually not the economic buyer; adoption user and technical influencer.', 'Start here only for proof: developer can add the plugin and show one report.', '<span class="status pass">partly ready</span>: goal, parser, threshold, local fixture and report. <span class="status block">blocker</span>: runtime caching/proxy docs and Central release.'],
  ['Build engineer / Maven maintainer', '“Standardize this once in parent POM/pluginManagement.”', 'Pinned plugin version, deterministic output, multi-module docs, proxy/cache/offline guidance, Enforcer-compatible config examples.', 'Can own platform budget or approve enterprise build-tool adoption.', 'Second entry point: after one team proves evidence, build engineering makes it policy.', '<span class="status warn">not complete</span>: plugin exists; parent POM/multi-module/proxy docs are missing.'],
  ['CI / platform owner', '“Make it a reliable release gate with artifacts.”', 'CI templates, Docker image, browser/runtime cache, artifact upload, stable exit codes, baseline/regression mode.', 'Likely first technical budget owner for team/department plan.', 'Enter when a dashboard/app team needs repeatable pre-release proof.', '<span class="status warn">started</span>: CLI artifacts exist. <span class="status block">missing</span>: reusable CI templates and managed artifact upload.'],
  ['Release manager', '“I need a go/no-go package attached to release approval.”', 'Severity threshold, release profile, signed report path, summary table and remediation backlog.', 'Influences product/platform spend; may not hold tooling budget directly.', 'Enter at release gates, especially before customer/public-sector delivery.', '<span class="status warn">partial</span>: threshold works; signed exports and release approval workflow missing.'],
  ['Accessibility reviewer / auditor', '“Show me reproducible proof, not screenshots from chat.”', 'HTML report, raw JSON, command log, screenshot, source/docs links and rule/domain mapping.', 'Can be buyer in audit firms; usually approver/influencer inside enterprise.', 'Enter after the first CI run: reviewer validates evidence and asks for retention/export.', '<span class="status pass">local report ready</span>; <span class="status block">missing</span>: deeper WCAG mapping and production app evidence.'],
  ['Compliance officer / legal / DPO', '“Keep audit trail across accessibility/privacy/security releases.”', 'Hosted retention, signed exports, policy thresholds, domain packs, access control and evidence history.', 'Main economic buyer for enterprise plan.', 'Enter once developer/CI workflow is recurring and artifacts need governance.', '<span class="status block">not built</span>: hosted governance layer, SSO, retention and signed exports.'],
  ['Product owner for Java portal', '“Release without last-minute compliance blockers.”', 'Risk summary, trend over releases, clear owner/action list and reviewer-ready packet.', 'Pays through product or platform budget when site/app is customer-facing or regulated.', 'Enter when release delay or procurement requires evidence.', '<span class="status warn">positioning exists</span>; hosted trend/dashboard missing.'],
]);

const implementedRows = rows([
  ['Maven goal', 'Implemented', '`ariada:scan`, default phase `verify`, Maven-shaped configuration.'],
  ['CLI reuse', 'Implemented', 'Invokes the shared `@ariada-org/cli`; no Java scanner fork. This is deliberate but must be described as MVP bridge.'],
  ['URL scan', 'Implemented', '`ariada.url` accepts an HTTP(S) target.'],
  ['Static site scan', 'Implemented', '`ariada.siteDirectory` is served on localhost and scanned through the CLI.'],
  ['Gate logic', 'Implemented', 'Fails Maven build when findings meet/exceed `ariada.severityThreshold`.'],
  ['JSON parsing', 'Implemented', 'Supports legacy `scan.json` and current `multi-domain-report.json`.'],
  ['Evidence report', 'Implemented locally', '`scan-evidence/result.html`, `real-scan/multi-domain-report.json`, command log and screenshot path.'],
  ['Maven Central publication', 'Not implemented', 'Needs founder-owned Sonatype Central Portal namespace, GPG key, token and release approval.'],
  ['Enterprise parent-POM rollout docs', 'Not implemented', 'Needs multi-module Java estate examples, parent POM snippets and pluginManagement guidance.'],
  ['Proxy/offline/repository-manager docs', 'Not implemented', 'Needs Nexus/Artifactory, `settings.xml`, browser/runtime cache and no-network policy guidance.'],
  ['Production Java web fixture', 'Partly implemented', 'Current fixture is static Java-web output; not yet Spring Boot/Thymeleaf/JSF runtime with auth/callbacks/forms.'],
  ['Hosted evidence retention', 'Not implemented', 'Commercial layer missing: signed exports, retention, SSO, team dashboards and domain packs.'],
]);

const coreRows = rows([
  ['Scanner runtime', 'Shared `@ariada-org/cli` and core engine. Maven Java code only shells out and interprets findings.'],
  ['Browser capture', 'Still owned by Ariada CLI/Playwright/browser stack. Maven plugin must cache/pin this rather than reinvent it.'],
  ['Report contract', 'Reads `multi-domain-report.json` and older `scan.json` so it remains compatible with scanner evolution.'],
  ['Build gate', 'Maps scanner findings to Maven pass/fail through Mojo exceptions and threshold configuration.'],
  ['Urgent gap', 'No Java-native scanner runtime, no Central release, no enterprise proxy docs, no CI/Docker wrapper, no hosted evidence API.'],
]);

const surfaceRows = rows([
  ['Fixture', '`fixtures/java-webapp/index.html`: static HTML standing in for Maven-built Java web output from Spring MVC, Thymeleaf, JSF, JSP or Maven Site.'],
  ['Known defects', 'Fixture intentionally contains missing image alternative text and an unlabeled filter input so the real scan has meaningful findings.'],
  ['Deterministic plugin test', 'Maven Invoker uses a CLI stub to prove plugin config, threshold and build-fail behavior without depending on browser runtime.'],
  ['Real scan evidence', 'Ariada CLI browser scan ran against the Java fixture served on localhost and wrote raw JSON to `scan-evidence/real-scan/multi-domain-report.json`.'],
  ['Visual evidence gap', 'The committed screenshot currently shows the generated report page, not the tested Java fixture or scan preview. It is layout evidence, not host-surface evidence. Next capture must show fixture/preview.'],
]);

const domainRows = rows([
  ['Accessibility', 'implemented', 'High', 'Primary wedge for Maven web builds: fail release on WCAG/EAA evidence gaps through the shared Ariada core.', 'Use now in Maven gate.'],
  ['Security headers', 'implemented', 'Medium-high', 'Java portals care about CSP/HSTS/referrer/cookie headers; platform/security owners already accept security gates.', 'Expose as `--domains accessibility,security` once passthrough examples exist.'],
  ['Privacy / GDPR', 'implemented', 'High for public/customer portals', 'Cookies, forms, analytics, consent and tracker evidence connect to DPO/legal buyer; Maven-specific examples still need richer fixtures.', 'Add cookie/consent Java fixture and DPO-facing report mapping.'],
  ['AI readiness', 'implemented', 'Medium for public data portals', 'Robots/llms/crawlability matter when Java sites publish public reports or knowledge pages; current scope is narrow.', 'Pair with SEO/GEO later; do not oversell AI Act compliance.'],
  ['Structured data', 'implemented', 'Medium', 'Useful for public Java sites, Maven Site docs, data portals and SEO/AI-readiness; current shared-core coverage is partial.', 'Add schema.org examples for Java report pages.'],
  ['Sustainability', 'implemented', 'Low-medium', 'Useful for heavy server-rendered Java pages, but weaker release blocker than accessibility/security/privacy.', 'Ship after primary compliance gates.'],
  ['Performance / Core Web Vitals', 'planned', 'High for Java portals', 'Java teams already care about slow pages and heavy bundles, but performance needs separate PRD/package/fixtures.', 'Build D07 before claiming performance gate.'],
  ['SEO', 'planned', 'Medium for public sites', 'Maven Site and public Java portals need canonical/meta/sitemap/robots/OG checks.', 'Create Java/Maven SEO fixture and report rows.'],
  ['GEO / AIEO', 'planned', 'Medium for public knowledge/data portals', 'AI-search visibility is relevant for public Java docs/data, not every enterprise app.', 'After SEO and structured-data foundation.'],
  ['Localization / i18n', 'planned', 'High for EU public sector', 'Java estates often serve multilingual public portals; accessibility and language metadata interact.', 'Build multilingual fixture with lang/dir/date/currency rules.'],
  ['Reliability / availability', 'blocked', 'Medium-high', 'CI owner wants proof app/site came up before scan; release manager wants route health evidence.', 'Candidate domain needs PRD, route coverage and health-check artifact before implementation.'],
  ['Legal / policy notices', 'blocked', 'Medium-high', 'Accessibility statement, privacy policy, cookie notice and contact path matter in procurement/public release.', 'Candidate domain needs PRD and policy-notice fixture before implementation.'],
  ['Data quality / provenance', 'blocked', 'Medium', 'Java portals often publish regulated tables, public datasets or financial statements.', 'Candidate domain needs PRD plus dataset freshness/source metadata contract.'],
  ['Procurement / vendor-risk evidence', 'blocked', 'Medium enterprise', 'Aggregates privacy/security/accessibility docs into buyer-facing packet.', 'Candidate domain needs hosted evidence store before implementation.'],
]);

const competitorRows = rows([
  ['Maven build plugins', 'SpotBugs, Checkstyle, PMD, OWASP Dependency-Check, CycloneDX Maven Plugin, Maven Enforcer', 'Strong for code quality, dependency security, SBOM and build policy; weak for browser-rendered accessibility/privacy evidence.', 'Ariada should fit their Maven lifecycle pattern and artifact discipline.'],
  ['Accessibility scanners', 'axe, Pa11y, Lighthouse CI, Accessibility Insights, WAVE, Siteimprove, Deque, Evinced, Level Access', 'Strong scan engines; Maven-native release evidence and multi-domain artifact packet is not their primary Java build surface.', 'Ariada wedge is Maven-controlled evidence, not a new rules engine.'],
  ['Security/release scanners', 'OWASP ZAP, Snyk, Semgrep, CodeQL, SecurityHeaders, Mozilla Observatory', 'Strong security gates, but not unified accessibility/privacy/sustainability/AI-readiness evidence for rendered Java web pages.', 'Security domain can become expansion once accessibility gate is trusted.'],
  ['Privacy/CMP tools', 'OneTrust, Cookiebot, Usercentrics, Didomi, Osano', 'Strong consent management and privacy workflows; less developer-owned Maven release evidence.', 'Ariada can provide rendered-page proof that consent/tracking posture did not regress.'],
  ['Java/Spring ecosystem', 'Spring Boot Actuator, Spring Security, Vaadin, Wicket, JSF, Thymeleaf, Maven Site', 'Strong runtime/framework ecosystem; Ariada must not compete as framework.', 'Attach after build/runtime exists, scan the output, preserve evidence.'],
  ['Compliance/GRC workflows', 'Jira, ServiceNow, Archer, AuditBoard, spreadsheets/manual audit packets', 'Strong approval systems; weak source-of-truth generation from Maven build.', 'Ariada should export/attach evidence into these systems.'],
]);

const monetizationRows = rows([
  ['Java developer', 'Not primary payer; adoption/influence role.', 'Free Maven plugin, docs, examples, local report.', 'Less manual evidence prep and fewer review surprises.'],
  ['Build/CI platform owner', 'Likely first technical budget.', 'Hosted artifact retention, baselines, PR comments, team policy, CI templates, Docker image support.', 'Repeatable release gate across many Java apps without every team reinventing scans.'],
  ['Product owner', 'Pays via product/platform budget when site is customer-facing or regulated.', 'Release scorecard, risk trends, remediation backlog and reviewer-ready evidence pack.', 'Fewer compliance delays and clearer release risk.'],
  ['Accessibility/compliance reviewer', 'Buyer in agencies; influencer in enterprise.', 'Signed evidence bundles, rule mapping, VPAT/ACR support, export formats and review workflow.', 'Defensible audit trail instead of ad hoc screenshots.'],
  ['Legal/DPO/compliance officer', 'Main enterprise economic buyer after workflow proves recurring value.', 'Retention, SSO, access control, signed exports, privacy/security/accessibility domain packs.', 'Governance and audit readiness across releases.'],
  ['Sales motion', 'Land free plugin in one Java repo, expand to parent POM/CI standard, sell hosted governance.', 'Do not charge for the thin wrapper first; charge for evidence operations and risk workflow.', 'Avoids competing with Maven/Java tools and monetizes compliance pain.'],
]);

const salesRows = rows([
  ['OWASP Dependency-Check', 'Free/open-source plugin plus broader ecosystem integrations; value is dependency vulnerability evidence.', 'Ariada should mimic the Maven plugin trust pattern but focus on rendered web/compliance evidence.', link('https://owasp.org/www-project-dependency-check/', 'OWASP Dependency-Check')],
  ['SpotBugs / PMD / Checkstyle', 'Open-source build-time quality gates; widely configured in Maven/CI.', 'Ariada should feel like a quality gate with clear reports and fail thresholds, not a foreign SaaS-only scanner.', `${link('https://spotbugs.github.io/', 'SpotBugs')} ${link('https://pmd.github.io/', 'PMD')} ${link('https://checkstyle.sourceforge.io/', 'Checkstyle')}`],
  ['CycloneDX Maven Plugin', 'Open-source SBOM generation, enterprise compliance value around supply chain.', 'Ariada can learn artifact discipline: deterministic output, CI upload, policy consumption.', link('https://github.com/CycloneDX/cyclonedx-maven-plugin', 'CycloneDX Maven Plugin')],
  ['Deque / Evinced / Level Access / Siteimprove', 'Enterprise accessibility SaaS and services; often sold to compliance/accessibility leaders.', 'Ariada should start smaller: developer/CI evidence overlay with cheaper adoption, then sell hosted retention and reviewer workflow.', `${link('https://www.deque.com/axe/', 'axe')} ${link('https://www.evinced.com/', 'Evinced')} ${link('https://www.levelaccess.com/', 'Level Access')} ${link('https://www.siteimprove.com/', 'Siteimprove')}`],
  ['Snyk / Semgrep / CodeQL', 'Developer-first security scans with CI gates and enterprise policy.', 'Good model for expansion: free/OSS entry, CI integration, paid policy/dashboard/enterprise governance.', `${link('https://snyk.io/plans/', 'Snyk pricing')} ${link('https://semgrep.dev/pricing/', 'Semgrep pricing')} ${link('https://github.com/features/security', 'GitHub security')}`],
  ['Sonatype / Maven Central ecosystem', 'Repository governance, publishing, dependency intelligence and enterprise repository management.', 'Maven Central publishing and proxy/repository-manager docs are credibility requirements for Java buyers.', `${link('https://central.sonatype.org/publish/publish-portal-maven/', 'Central publishing plugin')} ${link('https://central.sonatype.org/register/central-portal/', 'Central portal registration')}`],
]);

const sources = [
  ['Maven official', 'Maven overview', 'https://maven.apache.org/', 'Used to define Maven as build/project/documentation channel.'],
  ['Maven official', 'Build lifecycle', 'https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html', 'Supports verify-phase positioning.'],
  ['Maven official', 'Introduction to plugins', 'https://maven.apache.org/guides/introduction/introduction-to-plugins.html', 'Supports plugin-as-reusable-build-action framing.'],
  ['Maven official', 'Java plugin development guide', 'https://maven.apache.org/guides/plugin/guide-java-plugin-development.html', 'Supports Mojo/plugin implementation expectations.'],
  ['Maven official', 'Configuring plugins', 'https://maven.apache.org/guides/mini/guide-configuring-plugins.html', 'Supports POM/plugin configuration approach.'],
  ['Maven official', 'Maven Site Plugin', 'https://maven.apache.org/plugins/maven-site-plugin/', 'Public Java docs/site surface for future Ariada scan fixtures.'],
  ['Maven official', 'Maven Invoker Plugin', 'https://maven.apache.org/plugins/maven-invoker-plugin/', 'Supports integration-test style for Maven plugins.'],
  ['Maven official', 'Maven Surefire Plugin', 'https://maven.apache.org/surefire/maven-surefire-plugin/', 'Java test gate precedent.'],
  ['Maven official', 'Maven Failsafe Plugin', 'https://maven.apache.org/surefire/maven-failsafe-plugin/', 'Integration-test gate precedent.'],
  ['Maven official', 'Maven Enforcer Plugin', 'https://maven.apache.org/enforcer/maven-enforcer-plugin/', 'Build policy gate precedent.'],
  ['Maven official', 'Maven Wrapper', 'https://maven.apache.org/wrapper/', 'Developer environment reproducibility.'],
  ['Maven official', 'Maven Resolver', 'https://maven.apache.org/resolver/', 'Repository/proxy dependency behavior context.'],
  ['Central', 'Central Portal publish with Maven', 'https://central.sonatype.org/publish/publish-portal-maven/', 'Publication blocker and future path.'],
  ['Central', 'Register to publish via Central Portal', 'https://central.sonatype.org/register/central-portal/', 'Human account gate.'],
  ['Central', 'Maven Central search', 'https://central.sonatype.com/', 'Distribution surface.'],
  ['Build quality', 'SpotBugs Maven Plugin', 'https://spotbugs.github.io/spotbugs-maven-plugin/', 'Maven plugin competitor/convention.'],
  ['Build quality', 'PMD Maven Plugin', 'https://pmd.github.io/pmd/pmd_userdocs_tools_maven.html', 'Maven static analysis convention.'],
  ['Build quality', 'Checkstyle Maven Plugin', 'https://maven.apache.org/plugins/maven-checkstyle-plugin/', 'Maven static analysis convention.'],
  ['Security', 'OWASP Dependency-Check', 'https://owasp.org/www-project-dependency-check/', 'Dependency security plugin precedent.'],
  ['Security', 'Dependency-Check Maven usage', 'https://jeremylong.github.io/DependencyCheck/dependency-check-maven/', 'Heavy first-run/caching lesson.'],
  ['Security', 'OWASP ZAP', 'https://www.zaproxy.org/', 'Web security scanner competitor.'],
  ['Security', 'Snyk plans', 'https://snyk.io/plans/', 'Developer-first scanner sales model.'],
  ['Security', 'Semgrep pricing', 'https://semgrep.dev/pricing/', 'Developer-first scanner sales model.'],
  ['Security', 'GitHub CodeQL', 'https://codeql.github.com/', 'CI security gate precedent.'],
  ['SBOM', 'CycloneDX Maven Plugin', 'https://github.com/CycloneDX/cyclonedx-maven-plugin', 'Artifact/report discipline.'],
  ['Accessibility', 'axe-core', 'https://github.com/dequelabs/axe-core', 'Accessibility engine benchmark.'],
  ['Accessibility', 'axe DevTools', 'https://www.deque.com/axe/devtools/', 'Enterprise accessibility tooling model.'],
  ['Accessibility', 'Pa11y', 'https://pa11y.org/', 'CLI accessibility scanner competitor.'],
  ['Accessibility', 'Lighthouse CI', 'https://github.com/GoogleChrome/lighthouse-ci', 'CI web quality gate.'],
  ['Accessibility', 'Accessibility Insights', 'https://accessibilityinsights.io/', 'Manual/automated accessibility evidence competitor.'],
  ['Accessibility', 'WAVE', 'https://wave.webaim.org/', 'Reviewer-facing accessibility checker.'],
  ['Accessibility', 'Siteimprove', 'https://www.siteimprove.com/', 'Enterprise web governance competitor.'],
  ['Accessibility', 'Level Access', 'https://www.levelaccess.com/', 'Enterprise accessibility services/software.'],
  ['Accessibility', 'Evinced', 'https://www.evinced.com/', 'Developer accessibility scanner competitor.'],
  ['Standards', 'WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'Accessibility regulatory anchor.'],
  ['Standards', 'EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'EU accessibility standard anchor.'],
  ['Standards', 'European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', 'Accessibility buyer pain anchor.'],
  ['Privacy', 'GDPR text', 'https://gdpr.eu/tag/gdpr/', 'Privacy domain anchor.'],
  ['Privacy', 'Cookiebot', 'https://www.cookiebot.com/', 'CMP competitor.'],
  ['Privacy', 'OneTrust', 'https://www.onetrust.com/', 'Privacy/GRC competitor.'],
  ['Privacy', 'Usercentrics', 'https://usercentrics.com/', 'CMP competitor.'],
  ['Performance', 'Core Web Vitals', 'https://web.dev/vitals/', 'Planned performance domain anchor.'],
  ['Performance', 'PageSpeed Insights', 'https://pagespeed.web.dev/', 'Performance/SEO competitor.'],
  ['Sustainability', 'Website Carbon Calculator', 'https://www.websitecarbon.com/', 'Sustainability competitor.'],
  ['Sustainability', 'Ecograder', 'https://ecograder.com/', 'Sustainability competitor.'],
  ['SEO', 'Google Search Central SEO starter guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'SEO planned-domain anchor.'],
  ['SEO', 'Rich Results Test', 'https://search.google.com/test/rich-results', 'Structured-data competitor.'],
  ['Structured data', 'Schema.org', 'https://schema.org/', 'Structured-data domain anchor.'],
  ['AI readiness', 'llms.txt', 'https://llmstxt.org/', 'AI-search/readability convention.'],
  ['Java web', 'Spring Boot Maven Plugin', 'https://docs.spring.io/spring-boot/docs/current/maven-plugin/reference/htmlsingle/', 'Spring/Maven distribution convention.'],
  ['Java web', 'Spring MVC', 'https://docs.spring.io/spring-framework/reference/web/webmvc.html', 'Representative Java web framework.'],
  ['Java web', 'Thymeleaf', 'https://www.thymeleaf.org/documentation.html', 'Representative server-rendered Java web surface.'],
  ['Java web', 'Vaadin', 'https://vaadin.com/docs', 'Java web UI competitor/surface.'],
  ['Java web', 'Jakarta Faces', 'https://jakarta.ee/specifications/faces/', 'Representative Java web surface.'],
  ['CI', 'GitHub Actions cache', 'https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows', 'Browser/runtime cache requirement.'],
  ['CI', 'GitLab CI cache', 'https://docs.gitlab.com/ci/caching/', 'CI cache requirement.'],
  ['CI', 'Jenkins Pipeline', 'https://www.jenkins.io/doc/book/pipeline/', 'Enterprise CI connector.'],
  ['Registry/proxy', 'Sonatype Nexus Repository', 'https://www.sonatype.com/products/sonatype-nexus-repository', 'Enterprise repository-manager context.'],
  ['Registry/proxy', 'JFrog Artifactory', 'https://jfrog.com/artifactory/', 'Enterprise repository-manager context.'],
  ['Internal PRD', 'Ariada channel evidence PRD', `${centralRoot}/product/plans/2026-06-23-channel-evidence-research-prd.md`, 'Report template and audit gate.'],
  ['Internal PRD', 'Expanded domain catalog (not present in this checkout)', '', 'Domain roadmap reference named by the skill; keep unlinked until the central file exists.'],
  ['Internal PRD', 'D07 performance domain (not present in this checkout)', '', 'Planned performance-domain reference named by the skill; keep unlinked until the central file exists.'],
  ['Internal Hub', 'Delivery Hub', `${centralRoot}/strategy/dashboards/DELIVERY_HUB.html`, 'Status row and report links.'],
];

const sourceRows = rows(sources.map(([group, label, href, use]) => [esc(group), sourceLink(href, label), esc(use)]));

const painRows = rows([
  ['Maven plugin adoption pain', 'Search `maven plugin proxy npx blocked`, `maven plugin downloads during build`, `maven plugin offline build`, `maven browser tests flaky ci`.', 'Find objections around hidden downloads, proxies, cache, reproducibility and CI time.'],
  ['Java web accessibility pain', 'Search GitHub issues and Stack Overflow for `Spring Boot accessibility WCAG`, `Thymeleaf accessibility`, `JSF accessibility aria`, `Maven Site accessibility`.', 'Find real surfaces and vocabulary used by Java teams.'],
  ['Enterprise build governance', 'Search `parent POM pluginManagement quality gate`, `maven enforcer enterprise`, `Nexus Artifactory Maven plugin proxy`.', 'Find how platform teams standardize tools and what they reject.'],
  ['Release evidence pain', 'Search `Maven verify compliance report`, `Java release audit evidence`, `attach HTML report CI artifact Maven`.', 'Find release-manager and auditor language.'],
  ['Comparator pain', 'Read OWASP Dependency-Check issues around NVD download/caching and Maven plugin setup.', 'Use as warning: heavy data/runtime downloads are acceptable only when documented/cached.'],
  ['Accessibility competitor gaps', 'Search `axe maven plugin`, `pa11y maven plugin`, `lighthouse ci maven`, `accessibility evidence maven`.', 'Validate whether Maven-native accessibility release evidence is underserved.'],
  ['Buyer discovery', 'Interview Java platform owners, public-sector web leads, accessibility auditors and CI owners.', 'Ask who owns budget, what artifact they attach to release tickets, and what would make evidence defensible.'],
]);

const communityReviewRows = rows([
  ['Source families', 'Signal count target: 7 Maven/Java-specific source families searched: Reddit Java/build-tool communities, Stack Overflow Maven/Spring tags, Apache Maven issue/discussion surfaces, GitHub issues for adjacent Maven plugins, OWASP Dependency-Check issue history, CI community surfaces, Hacker News/search surfaces.', 'These are channel-specific because Maven buyers discuss build determinism, parent POMs, repository managers and CI gates in Java/build communities, not Python dashboard forums.'],
  ['Reddit r/java build-tool pain', `${link('https://www.reddit.com/r/java/comments/1ixwmda/new_build_tool_in_java/', 'new build tool in Java discussion')}, ${link('https://www.reddit.com/r/java/comments/1gjg7v4/java_without_build_system/', 'Java without build system')}, ${link('https://www.reddit.com/r/java/comments/1kjc9vb/java_build_tooling_could_be_so_much_better/', 'Java build tooling could be better')}.`, 'Role signals: Java developer, senior engineer, build-tool evaluator. Repeated patterns: network effect, Maven/Gradle dominance, build-tool tribal knowledge, dislike of unnecessary new build conventions.'],
  ['Stack Overflow Maven implementation pain', `${link('https://stackoverflow.com/questions/tagged/maven', 'maven tag')}, ${link('https://stackoverflow.com/questions/tagged/maven-plugin', 'maven-plugin tag')}, ${link('https://stackoverflow.com/search?q=%5Bmaven%5D+proxy+offline+plugin', 'proxy/offline/plugin search')}, ${link('https://stackoverflow.com/search?q=%5Bmaven%5D+spring+boot+accessibility', 'Spring/accessibility search')}.`, 'Role signals: implementation developer and build engineer. Strong for concrete setup errors, proxy/offline pain and plugin configuration confusion; weak for buyer willingness-to-pay.'],
  ['Apache Maven public project surfaces', `${link('https://github.com/apache/maven/issues', 'apache/maven issues')}, ${link('https://github.com/apache/maven-mvnd/issues', 'maven-mvnd issues')}, ${link('https://maven.apache.org/mailing-lists.html', 'Maven mailing lists')}.`, 'Role signals: Maven maintainers and build-tool power users. Product impact: respect Maven lifecycle, plugin conventions, repository behavior and performance expectations.'],
  ['Adjacent Maven plugin issue surfaces', `${link('https://github.com/jeremylong/DependencyCheck/issues?q=maven', 'Dependency-Check Maven issues')}, ${link('https://github.com/CycloneDX/cyclonedx-maven-plugin/issues', 'CycloneDX Maven plugin issues')}, ${link('https://github.com/spotbugs/spotbugs-maven-plugin/issues', 'SpotBugs Maven plugin issues')}, ${link('https://github.com/apache/maven-checkstyle-plugin/issues', 'Checkstyle Maven plugin issues')}.`, 'Role signals: build engineer, security engineer, maintainer. Repeated pattern: heavy data/runtime downloads and plugin configuration must be cacheable and explicit.'],
  ['Java web framework communities', `${link('https://github.com/spring-projects/spring-boot/issues?q=accessibility', 'Spring Boot accessibility issues')}, ${link('https://github.com/thymeleaf/thymeleaf/issues?q=accessibility', 'Thymeleaf accessibility issues')}, ${link('https://github.com/vaadin/platform/issues?q=accessibility', 'Vaadin accessibility issues')}, ${link('https://github.com/eclipse-ee4j/mojarra/issues?q=accessibility', 'Jakarta Faces/Mojarra accessibility issues')}.`, 'Role signals: Java web developer and component maintainer. Product impact: Maven Ariada must scan rendered web output because accessibility pain often appears in templates/components, not only Java source.'],
  ['CI / repository manager communities', `${link('https://community.jenkins.io/search?q=maven%20artifact%20accessibility%20plugin', 'Jenkins community Maven search')}, ${link('https://forum.gitlab.com/search?q=maven%20cache%20plugin', 'GitLab forum Maven cache search')}, ${link('https://community.sonatype.com/search?q=maven%20plugin%20central%20portal', 'Sonatype community Maven search')}, ${link('https://github.com/actions/setup-java/issues?q=maven', 'setup-java Maven issues')}.`, 'Role signals: CI/platform owner and release engineer. Product impact: runtime cache, artifact upload and Maven Central publication are adoption requirements.'],
  ['Hacker News / broader technical evaluation', `${link('https://hn.algolia.com/?q=Maven%20Gradle%20build%20tool', 'HN Maven Gradle build tool search')}, ${link('https://hn.algolia.com/?q=Maven%20plugin%20Java', 'HN Maven plugin Java search')}, ${link('https://hn.algolia.com/?q=Java%20build%20tools', 'HN Java build tools search')}.`, 'Role signals: technical evaluators/founders. Use as weak signal unless themes repeat across Reddit, Stack Overflow and plugin issue trackers.'],
  ['Repeated patterns', 'Pattern 1: Maven/Gradle network effect is strong; Pattern 2: build tools are accepted when they fit lifecycle/parent-POM conventions; Pattern 3: hidden network/runtime downloads are rejected; Pattern 4: enterprise proxy/cache/offline requirements shape adoption; Pattern 5: reviewer evidence must be stable and attachable.', 'Product impact: sell Maven Ariada as explicit CI/release evidence bridge with cache/proxy docs, not as a Java-native scanner or default fast-loop dependency.'],
  ['No-signal searches', 'Marketplace-style reviews are weak for Maven plugins because Maven Central has metadata/downloads, not review threads. Private Slack/Discord communities were not used because the report requires public evidence. G2/Capterra are weak for Maven plugin adoption but useful later for hosted evidence/enterprise governance competitors.', 'Do not silently omit missing surfaces. Mark weak/no-signal surfaces and keep the strongest Maven evidence in Reddit/Stack Overflow/GitHub issues/Maven community/CI forums.'],
]);

const artifactRows = rows([
  ['Plugin jar', '`target/ariada-maven-plugin-0.1.0-SNAPSHOT.jar`', 'Generated locally by `mvn -B package`; not committed.'],
  ['Unit test report', '`target/surefire-reports/`', 'Generated locally by Maven; not committed.'],
  ['Invoker report', '`target/invoker-reports/`', 'Generated locally by `mvn -B verify`; not committed.'],
  ['Raw scan JSON', link('real-scan/multi-domain-report.json', 'scan-evidence/real-scan/multi-domain-report.json'), 'Committed evidence from real Ariada CLI scan against the Java fixture.'],
  ['HTML evidence', link('result.html', 'scan-evidence/result.html'), 'Self-contained reviewer-ready channel report.'],
  ['Standalone screenshot', link('maven-evidence.png', 'scan-evidence/maven-evidence.png'), 'Committed PNG and embedded in the HTML report; open link for full-size review.'],
]);

const adequacyRows = rows([
  ['Proves', 'Java compilation, plugin descriptor generation, parser behavior, gate threshold logic, static-site serving, Maven Invoker integration and real Ariada browser scan against a representative Java web fixture.'],
  ['Does not prove', 'Maven Central publication, enterprise proxy/offline operation, multi-module parent-POM rollout, Spring Boot runtime/auth coverage, production Java portal evidence, hosted retention or signed exports.'],
  ['Visual limitation', 'Current PNG is evidence-report layout, not host surface. It is useful to verify report readability; a stronger run must screenshot the fixture or scan-result preview.'],
  ['Next strongest test', 'Run a Spring Boot/Thymeleaf fixture, serve it during Maven verify, scan the live URL, screenshot both the app surface and scan preview, then attach all artifacts.'],
]);

const handoffRows = rows([
  ['Agent next', 'Regenerate this report after every template change, capture fixture/scan-preview screenshot, add CI/Docker examples, add parent POM docs, update Delivery Hub row and rerun `audit-channel-report.mjs --strict`.'],
  ['Agent next', 'Build Maven-specific fixtures for Spring Boot, Thymeleaf, Maven Site and a multi-module project; add expected findings per domain.'],
  ['Agent next', 'Add domain passthrough examples and tests for accessibility/security/privacy once shared CLI contract is stable.'],
  ['Human next', 'Choose Maven Central namespace owner, provide Sonatype Central Portal credentials, GPG signing key/token decision and public release approval.'],
  ['Human next', 'Decide whether hosted Ariada evidence retention is in-scope before selling enterprise Java teams on audit history.'],
  ['Reviewer next', 'Check whether this positioning is acceptable: MVP bridge now, Maven-native product path later; no claim of Java-native scanner yet.'],
]);

const distributionRows = rows([
  ['Free distribution', 'Maven Central plugin once credentials exist, README quick start, Spring Boot/Thymeleaf/Maven Site examples, Delivery Hub row, docs site page.'],
  ['CI distribution', 'GitHub Action, GitLab CI include, Jenkins shared library, Docker image with pinned browser/runtime.'],
  ['Enterprise distribution', 'Parent POM snippets, pluginManagement docs, Nexus/Artifactory/proxy/offline setup, SSO/hosted retention if paid layer exists.'],
  ['Promotion search terms', '`maven accessibility plugin`, `java wcag ci`, `spring boot accessibility scan`, `maven compliance report`, `wcag release gate`, `maven site accessibility`, `java web evidence`.'],
  ['Where to promote', 'Maven Central, GitHub README/topics, Java/Spring blogs, accessibility engineering communities, public-sector digital-service examples, CI templates and docs site.'],
  ['What not to promote', 'Do not promote “Java-native scanner” yet; current adapter is a Maven bridge over Ariada CLI.'],
]);

const reviewRows = rows([
  ['Pre-release skill audit', 'Run `node scripts/audit-channel-report.mjs --baseline /Users/pedro/adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html --report integrations/maven-ariada/scan-evidence/result.html --strict` before opening/emailing/committing the report.'],
  ['Mandatory role table', 'This report contains `Кому что продаем: роли, hooks, кто платит и что уже готово`; if it disappears, status is REGENERATE.'],
  ['Screenshot review', 'Open the standalone PNG and classify artifacts. If it shows only the report page, keep `VISUAL_EVIDENCE_GAP` and schedule fixture/preview capture.'],
  ['Link check', 'Verify local links resolve from `scan-evidence/result.html`: screenshot, raw JSON, README, hub and PRDs.'],
  ['No approval misuse', 'Research/report-only updates are FYI/review-link wording. Human approval packets are for code behavior, public push/sync, release/package/store submission or attributed provenance commits.'],
]);

const objectionRows = rows([
  ['“Почему Maven plugin дергает Node/npm?”', 'Valid objection. The current bridge reuses Ariada CLI instead of reimplementing browser scanning in Java. Product answer: pin versions, cache runtime in CI, provide Docker/Action path, and make local runs explicit. Do not hide `npx` behind normal compile/test.'],
  ['“У нас offline/proxied enterprise builds.”', 'Valid objection. Product answer: document `settings.xml`, Nexus/Artifactory, cache directories, deterministic runtime artifacts and a container path. Until this exists, enterprise rollout is blocked.'],
  ['“Мы не хотим browser tests в every developer build.”', 'Correct. Product answer: use explicit profile, CI release gate or nightly fleet scan. Local developer command is for proof/debug, not default fast loop.'],
  ['“Accessibility scanner already exists.”', 'Partly true. Product answer: Ariada is not winning by having another rule engine; it wins by producing Maven-release evidence across domains with raw JSON, command log, screenshot, policy mapping and reviewer workflow.'],
  ['“Why not Lighthouse CI?”', 'Lighthouse CI is a strong web-quality gate. Ariada must differentiate through Maven-specific packaging, multi-domain compliance evidence, role/payer report, domain roadmap and hosted evidence retention.'],
  ['“Will this break release because one alt text is missing?”', 'The plugin must support thresholds, baseline mode, report-only mode and policy profiles. Compliance buyers need gates, but product owners need controlled rollout.'],
  ['“Who owns remediation?”', 'The report must map finding -> role. Java developer fixes templates/components, platform owner fixes CI policy/runtime, product owner accepts/rejects release risk, compliance reviewer approves evidence sufficiency.'],
  ['“Is this Java-native?”', 'No. It is Maven-native packaging around shared Ariada browser scanner. The report must say MVP bridge until Central release, sidecar/binary/runtime hiding and enterprise proxy story are complete.'],
]);

const connectorRows = rows([
  ['Maven goal', '`mvn ariada:scan -Dariada.url=http://localhost:8080`', 'Explicit developer/local run and CI release gate.'],
  ['Maven profile', '`mvn verify -Pariada`', 'Keeps fast local loop clean; turns evidence on for pre-merge/release/nightly jobs.'],
  ['Parent POM', '`pluginManagement` with pinned plugin/runtime versions', 'Platform owner standardizes adoption across many Java repos.'],
  ['Static site output', '`-Dariada.siteDirectory=target/site`', 'Maven Site and static output scans without requiring app server.'],
  ['Spring Boot app output', 'Start app with Failsafe/pre-integration-test, scan localhost route, stop app in post-integration-test', 'Production-like web fixture for Spring teams.'],
  ['Jenkins shared library', '`ariadaMavenScan(url: ..., artifacts: ...)`', 'Enterprise CI path without every repo owning scanner bootstrap.'],
  ['GitHub Action', '`uses: ariada-org/maven-ariada-action@v1`', 'Hosted/reusable CI wrapper with browser/runtime cache.'],
  ['GitLab include', '`include: ariada/maven-scan.yml`', 'GitLab estates need central CI template rather than POM-only instructions.'],
  ['Docker image', '`ghcr.io/ariada-org/maven-ariada:<version>`', 'Pinned runtime for CI systems with strict local environment controls.'],
  ['Hosted evidence API', 'Upload JSON/log/screenshot/report to Ariada evidence store', 'Paid layer: retention, signed export, reviewer comments and policy history.'],
]);

const docsBacklogRows = rows([
  ['Quick start', `${link('https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html', 'Maven lifecycle')} based setup: add plugin, run explicit goal, inspect target artifacts.`, 'Developer adoption.'],
  ['Parent POM rollout', `${link('https://maven.apache.org/guides/mini/guide-configuring-plugins.html', 'Configuring plugins')} plus pluginManagement examples.`, 'Build/platform owner adoption.'],
  ['Spring Boot fixture', `${link('https://docs.spring.io/spring-boot/docs/current/maven-plugin/reference/htmlsingle/', 'Spring Boot Maven Plugin')} start/stop lifecycle example.`, 'Realistic Java web scan.'],
  ['Maven Site fixture', `${link('https://maven.apache.org/plugins/maven-site-plugin/', 'Maven Site Plugin')} output scan example.`, 'Docs/public-site use case.'],
  ['Proxy/offline setup', `${link('https://maven.apache.org/settings.html', 'Maven settings')} with Nexus/Artifactory notes.`, 'Enterprise blocker removal.'],
  ['CI artifacts', `${link('https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts', 'GitHub artifacts')} and ${link('https://docs.gitlab.com/ci/jobs/job_artifacts/', 'GitLab artifacts')}.`, 'Reviewer can find outputs.'],
  ['Threshold policy', 'Examples for report-only, moderate-fail, serious-fail and baseline mode.', 'Controlled rollout.'],
  ['Reviewer guide', `${link('https://www.w3.org/TR/WCAG22/', 'WCAG')} and ${link('https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'EN 301 549')} mapping.`, 'Compliance reviewer.'],
  ['Central publish', `${link('https://central.sonatype.org/publish/publish-portal-maven/', 'Central Portal publishing')} and signing checklist.`, 'Human release gate.'],
  ['Commercial docs', 'Hosted retention, signed exports, SSO, policy packs and domain packs.', 'Enterprise buyer.'],
]);

const interviewRows = rows([
  ['Java developer', '“Would you run this in your default `mvn test`, only in `mvn verify`, only under a profile, or only in CI? What would make you remove it?”', 'Workflow placement and adoption blocker.'],
  ['Build engineer', '“How do you approve a new Maven plugin across parent POMs? What must be true for proxy/offline builds?”', 'Governance and enterprise rollout constraints.'],
  ['CI owner', '“Where should browser/runtime dependencies be cached? How should artifacts be named and retained?”', 'Runtime packaging and artifact contract.'],
  ['Release manager', '“What evidence do you attach to release tickets now? What failure threshold is acceptable during rollout?”', 'Gate policy and report shape.'],
  ['Accessibility auditor', '“What makes automated evidence defensible enough to review? Which rule mapping or screenshots do you need?”', 'Reviewer-facing report depth.'],
  ['DPO/legal/compliance', '“Which domains make this budget-worthy: accessibility only, privacy/security too, signed exports, retention, or audit log?”', 'Monetization and domain order.'],
  ['Enterprise architect', '“Would you prefer Maven plugin, Docker image, hosted scan, Jenkins shared library or all of them?”', 'Packaging solution priority.'],
  ['Public-sector buyer', '“Which standards and statements must be linked: WCAG, EN 301 549, EAA, accessibility statement, procurement docs?”', 'Regulatory source coverage.'],
]);

const extendedSources = [
  ['Maven settings reference', 'https://maven.apache.org/settings.html'],
  ['Maven POM reference', 'https://maven.apache.org/pom.html'],
  ['Maven repositories guide', 'https://maven.apache.org/guides/mini/guide-multiple-repositories.html'],
  ['Maven deployment guide', 'https://maven.apache.org/guides/mini/guide-deployment-security-settings.html'],
  ['Maven release plugin', 'https://maven.apache.org/maven-release/maven-release-plugin/'],
  ['Maven deploy plugin', 'https://maven.apache.org/plugins/maven-deploy-plugin/'],
  ['Maven install plugin', 'https://maven.apache.org/plugins/maven-install-plugin/'],
  ['Maven compiler plugin', 'https://maven.apache.org/plugins/maven-compiler-plugin/'],
  ['Maven resources plugin', 'https://maven.apache.org/plugins/maven-resources-plugin/'],
  ['Maven dependency plugin', 'https://maven.apache.org/plugins/maven-dependency-plugin/'],
  ['Spring Boot testing', 'https://docs.spring.io/spring-boot/reference/testing/index.html'],
  ['Spring Web MVC testing', 'https://docs.spring.io/spring-framework/reference/testing/spring-mvc-test-framework.html'],
  ['Thymeleaf Spring integration', 'https://www.thymeleaf.org/doc/tutorials/3.1/thymeleafspring.html'],
  ['Vaadin accessibility docs', 'https://vaadin.com/docs/latest/styling/accessibility'],
  ['Jakarta EE', 'https://jakarta.ee/'],
  ['Jenkins Maven jobs', 'https://www.jenkins.io/doc/tutorials/build-a-java-app-with-maven/'],
  ['GitHub setup Java action', 'https://github.com/actions/setup-java'],
  ['GitLab Java with Maven', 'https://docs.gitlab.com/user/packages/maven_repository/'],
  ['Nexus Maven repository docs', 'https://help.sonatype.com/en/maven-repositories.html'],
  ['JFrog Maven repository docs', 'https://jfrog.com/help/r/jfrog-artifactory-documentation/maven-repository'],
  ['OWASP ASVS', 'https://owasp.org/www-project-application-security-verification-standard/'],
  ['Mozilla Observatory', 'https://observatory.mozilla.org/'],
  ['SecurityHeaders', 'https://securityheaders.com/'],
  ['Google Lighthouse', 'https://developer.chrome.com/docs/lighthouse/overview'],
  ['WebAIM Million', 'https://webaim.org/projects/million/'],
  ['WAI forms tutorial', 'https://www.w3.org/WAI/tutorials/forms/'],
  ['WAI images tutorial', 'https://www.w3.org/WAI/tutorials/images/'],
  ['WAI aria practices', 'https://www.w3.org/WAI/ARIA/apg/'],
  ['EU Web Accessibility Directive', 'https://digital-strategy.ec.europa.eu/en/policies/web-accessibility'],
  ['Accessibility statement model', 'https://digital-strategy.ec.europa.eu/en/library/model-accessibility-statement'],
  ['Google robots.txt docs', 'https://developers.google.com/search/docs/crawling-indexing/robots/intro'],
  ['Google structured data intro', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'],
];
const extendedSourceRows = rows(extendedSources.map(([label, href]) => [link(href, label), 'Additional source for Maven/Java/CI/compliance docs expansion.']));

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
  pre { background: #101828; color: #f4f7fb; padding: 14px; border-radius: 8px; overflow: auto; white-space: pre-wrap; }
  pre code { background: transparent; color: inherit; padding: 0; border-radius: 0; }
  .badge { display: inline-block; font-weight: 700; border: 2px solid #0a6b33; color: #0a6b33; background: #e8f7ee; padding: 4px 10px; border-radius: 999px; margin: 0 4px 4px 0; }
  .warn { border-color: #9a5b00; color: #7a4300; background: #fff3d8; }
  .block { border-color: #9b1c1c; color: #8a1111; background: #ffe8e8; }
  .status { display: inline-block; border-radius: 999px; padding: 2px 8px; font-weight: 700; }
  .pass { background: #e8f7ee; color: #0a6b33; }
  figure { margin: 0; background: #fff; border: 1px solid #d8dde6; border-radius: 8px; overflow: hidden; }
  img { display: block; width: 100%; height: auto; }
  figcaption { padding: 10px 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .box { background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 14px; }
  .note { background: #fff; border: 1px solid #d8dde6; border-radius: 8px; padding: 14px; }
</style>
</head>
<body>
<header>
  <h1>S100 Maven plugin channel evidence</h1>
  <p><span class="badge">BUILT LOCALLY</span><span class="badge">${esc(realScan.status)}</span><span class="badge warn">MVP BRIDGE</span><span class="badge block">NOT PUBLISHED</span></p>
  <p class="note">This is the reviewer-ready evidence dossier for <code>integrations/maven-ariada/</code>. It follows the channel evidence skill: channel context, channel culture fit, recommended product solution, the mandatory role/payer/hook table, implementation status, Ariada core reuse, domains, competitors, monetization, sources, pain-mining, screenshots, test adequacy and handoff.</p>
</header>
<main>
  <h2>1. What The Maven Channel Is</h2>
  ${table(['Question', 'Answer'], channelRows)}

  <h2>2. Channel Culture Fit: What Maven/Java Users Accept And Reject</h2>
  <p>This is the gate that prevents the Go mistake from repeating in Java: do not sell a slow foreign runtime as if it were idiomatic local developer workflow. Maven users accept plugins and CI gates, but they expect pinned versions, repeatable output, proxy/cache compatibility and explicit profiles for heavy checks.</p>
  ${table(['Audience', 'What They Accept / Reject', 'Ariada Placement'], cultureRows)}

  <h2>3. Recommended Product Solution / Проект решения</h2>
  ${table(['Path', 'Concrete Solution', 'Product Reason'], solutionRows)}

  <h2>4. Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
  <p>The commercial path starts with a free Maven-shaped adapter, then expands to CI/platform policy and finally paid evidence operations. The role table is mandatory because “the user gets JSON/log/report” is not a value proposition by itself; each artifact exists so a specific role can release, approve, govern or buy with less risk.</p>
  ${table(['Role', 'What we promise', 'What we offer', 'Who pays', 'When we enter', 'Implemented / blockers'], roleOfferRows)}

  <h2>5. What Is Implemented And Not Implemented</h2>
  ${table(['Capability', 'Status', 'Detail'], implementedRows)}

  <h2>6. Ariada Core Used And Urgent Gaps</h2>
  ${table(['Area', 'Detail'], coreRows)}

  <h2>7. Tested Surface</h2>
  ${table(['Evidence Area', 'Detail'], surfaceRows)}
  <p>${esc(realScan.text)} Raw JSON: <a href="real-scan/multi-domain-report.json">real-scan/multi-domain-report.json</a>.</p>
  ${realScan.severityRows ? table(['Severity', 'Findings'], realScan.severityRows) : ''}
  ${realScan.domainRows ? table(['Domain', 'Findings'], realScan.domainRows) : ''}

  <h2>8. Domain Roadmap And Applicability</h2>
  ${table(['Domain', 'Implementation Status', 'Maven Applicability', 'Buyer / Product Reason', 'Next Action'], domainRows)}

  <h2>9. Narrow Competitors In This Channel</h2>
  ${table(['Competitive Set', 'Examples', 'Implication For Ariada', 'Maven Decision'], competitorRows)}

  <h2>10. Monetization And Buyer Value</h2>
  ${table(['Role', 'Who Pays / Influences', 'What We Sell', 'Value Bought'], monetizationRows)}

  <h2>11. Competitor Sales Models</h2>
  ${table(['Player / Category', 'How They Sell', 'What Ariada Learns', 'Sources'], salesRows)}

  <h2>12. Sources And Documents</h2>
  <p>These are the sources used to ground the Maven packaging and market assumptions. Official Maven/Central docs anchor the channel shape; competitor docs anchor the expected report/gate conventions; standards docs anchor compliance buyer pain; internal PRDs anchor Ariada scope.</p>
  ${table(['Group', 'Source', 'How Used'], sourceRows)}

  <h2>13. Pain Mining: Where To Find Roles, Objections And Buying Language</h2>
  ${table(['Research Direction', 'Queries / Places', 'Signals To Collect'], painRows)}

  <h2>14. Community Review Sources</h2>
  <p>This section is required before report release. It is not a vendor-doc source list; it is the public discussion layer where Maven/Java users expose adoption objections, workflow pain and role language. One thread is not enough. Use source families, signal count, repeated patterns and no-signal searches before making product claims.</p>
  ${table(['Source / signal', 'Channel-specific evidence', 'How it changes product decisions'], communityReviewRows)}

  <h2>15. Evidence Artifacts</h2>
  ${table(['Artifact', 'Path', 'Review Note'], artifactRows)}
  <p>Standalone screenshot link: <a href="maven-evidence.png">maven-evidence.png</a>. Raw scan JSON link: <a href="real-scan/multi-domain-report.json">real-scan/multi-domain-report.json</a>.</p>
  ${screenshot ? `<figure><a href="maven-evidence.png"><img src="${screenshot}" alt="Screenshot of the S100 Maven plugin evidence report with Maven channel context, role table, implementation status, real scan summary and handoff row." /></a><figcaption>Embedded screenshot captured from the local evidence report. Open full-size PNG: <a href="maven-evidence.png">maven-evidence.png</a>.</figcaption></figure>` : '<p>No screenshot captured yet. Run the screenshot command after generating this report.</p>'}

  <h2>16. Verification Commands</h2>
  <pre>${esc(`mvn -B -f integrations/maven-ariada/pom.xml package
mvn -B -f integrations/maven-ariada/pom.xml verify
node packages/ariada-cli/dist/bin.js scan http://127.0.0.1:48817/ --format json --output-dir integrations/maven-ariada/scan-evidence/real-scan --severity-threshold moderate
node integrations/maven-ariada/scripts/build-evidence-report.mjs
Google Chrome headless screenshot of integrations/maven-ariada/scan-evidence/result.html
node scripts/audit-channel-report.mjs --baseline /Users/pedro/adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html --report integrations/maven-ariada/scan-evidence/result.html --strict`)}</pre>

  <h2>17. Verification And Test Adequacy</h2>
  ${table(['Conclusion', 'Detail'], adequacyRows)}

  <h2>18. Visual Evidence Review</h2>
  <p><strong>VISUAL_EVIDENCE_GAP:</strong> the committed PNG currently shows the generated evidence report page, not the scanned Java fixture or a scan-result preview. It is useful for layout review only. The earlier white-strip artifact visible in command blocks was a report-rendering defect caused by light inline <code>code</code> styling inside a dark <code>pre</code> block; this generator renders command logs as plain <code>pre</code> text and overrides <code>pre code</code> styling.</p>
  <p>Next required capture: generate a screenshot of either the tested Maven Java fixture or a dedicated scan-result preview page, then keep the report screenshot only as optional layout evidence.</p>

  <h2>19. Self-Critique And Limits</h2>
  <table><tbody>
    <tr><th scope="row">Strong</th><td>The report now explains why Maven is a separate channel, who buys, what the Java/Maven audience rejects, why the adapter is an MVP bridge, and what product packaging would make it acceptable.</td></tr>
    <tr><th scope="row">Weak</th><td>The current evidence is still fixture-based and not a real Spring/Thymeleaf production app. It also does not prove Central publication or enterprise proxy/offline operation.</td></tr>
    <tr><th scope="row">Risk</th><td>If the plugin keeps using <code>npx</code> without pin/cache/proxy docs, Java teams may reject it as foreign even if the scan value is real.</td></tr>
    <tr><th scope="row">Decision</th><td>Keep this as review-ready MVP bridge evidence, not final Java-native product evidence.</td></tr>
  </tbody></table>

  <h2>20. Agent And Human Handoff</h2>
  ${table(['Owner', 'Next Step'], handoffRows)}

  <h2>21. Distribution And Promotion</h2>
  ${table(['Area', 'Plan'], distributionRows)}

  <h2>22. Skill Compliance Pre-Release Gate</h2>
  ${table(['Check', 'Required Result'], reviewRows)}

  <h2>23. Coordinator Hub Row</h2>
  <p>Update S100 from <code>PLANNED</code> to <code>BUILT</code> only after this evidence lands in the central tree and the delivery hub links to the current report. Code path: <code>integrations/maven-ariada/</code>. Evidence report: <code>integrations/maven-ariada/scan-evidence/result.html</code>. Human blocker: <code>Maven Central namespace/signing/token</code>. Do not mark published until Central Portal release is visible.</p>

  <h2>24. Recommended Maven Docs Page Outline</h2>
  <table><tbody>
    <tr><th scope="row">Quick start</th><td>Install/configure plugin, run explicit local goal, explain output paths.</td></tr>
    <tr><th scope="row">CI recipe</th><td>GitHub Actions/GitLab/Jenkins examples with cache, browser/runtime setup and artifact upload.</td></tr>
    <tr><th scope="row">Enterprise setup</th><td>Parent POM/pluginManagement, Nexus/Artifactory, proxy/offline, pinned versions.</td></tr>
    <tr><th scope="row">Evidence explanation</th><td>What raw JSON/log/screenshot/report each prove and which role consumes them.</td></tr>
  </tbody></table>

  <h2>25. Maven-Specific Version Roadmap</h2>
  <table><tbody>
    <tr><th scope="row">v0.1</th><td>MVP bridge: plugin goal, URL/static site scan, parser, threshold, local fixture evidence.</td></tr>
    <tr><th scope="row">v0.2</th><td>CI templates, Docker image, parent POM docs, pluginManagement examples, screenshot of fixture/preview.</td></tr>
    <tr><th scope="row">v0.3</th><td>Central release, signed artifacts, plugin prefix, proxy/offline docs, Spring/Thymeleaf fixtures.</td></tr>
    <tr><th scope="row">v1.0</th><td>Hosted evidence retention, signed exports, domain packs, multi-module enterprise rollout.</td></tr>
  </tbody></table>

  <h2>26. Domain Implementation Order For Maven</h2>
  <table><tbody>
    <tr><th scope="row">First</th><td>Accessibility, because WCAG/EAA release review is the clearest Java web evidence pain and current Ariada core already supports it.</td></tr>
    <tr><th scope="row">Second</th><td>Security headers, because Java CI/platform owners already understand security gates and can accept heavier release checks.</td></tr>
    <tr><th scope="row">Third</th><td>Privacy/GDPR, because DPO/legal budget appears when rendered pages set cookies, collect forms or run analytics.</td></tr>
    <tr><th scope="row">Fourth</th><td>Performance/reliability, but only after D07/reliability PRDs and fixtures exist.</td></tr>
    <tr><th scope="row">Later</th><td>SEO/GEO/structured data/i18n for public Java portals and Maven Site output.</td></tr>
  </tbody></table>

  <h2>27. What This Report Changes From The Old Report</h2>
  <table><tbody>
    <tr><th scope="row">Before</th><td>Thin evidence report with implementation table and screenshot, but weak market/user reasoning.</td></tr>
    <tr><th scope="row">Now</th><td>Full research dossier: Maven culture fit, project solution, mandatory role/payer table, monetization, sources, pain mining, handoff and pre-release skill audit.</td></tr>
    <tr><th scope="row">Still missing</th><td>Real host-surface screenshot and Spring/Thymeleaf production-like fixture.</td></tr>
  </tbody></table>

  <h2>28. Why The Artifacts Exist</h2>
  <table><tbody>
    <tr><th scope="row">Raw JSON</th><td>For CI automation, baselines, domain packs and machine-readable upload to hosted evidence store.</td></tr>
    <tr><th scope="row">Command log</th><td>For reproducibility: reviewer sees what command ran, with what path/URL and output.</td></tr>
    <tr><th scope="row">HTML report</th><td>For humans in release tickets, PRs and compliance review.</td></tr>
    <tr><th scope="row">Screenshot</th><td>For quick visual proof and review. Stronger evidence requires host surface/preview screenshot, not only report screenshot.</td></tr>
  </tbody></table>

  <h2>29. Local Link Map</h2>
  <table><tbody>
    <tr><th scope="row">README</th><td><a href="../README.md">../README.md</a></td></tr>
    <tr><th scope="row">Raw JSON</th><td><a href="real-scan/multi-domain-report.json">real-scan/multi-domain-report.json</a></td></tr>
    <tr><th scope="row">Screenshot</th><td><a href="maven-evidence.png">maven-evidence.png</a></td></tr>
    <tr><th scope="row">Delivery Hub</th><td><a href="${centralRoot}/strategy/dashboards/DELIVERY_HUB.html">/Users/pedro/adopta/strategy/dashboards/DELIVERY_HUB.html</a></td></tr>
    <tr><th scope="row">Skill PRD</th><td><a href="${centralRoot}/product/plans/2026-06-23-channel-evidence-research-prd.md">/Users/pedro/adopta/product/plans/2026-06-23-channel-evidence-research-prd.md</a></td></tr>
  </tbody></table>

  <h2>30. Final Reviewer Summary</h2>
  <p>Maven Ariada is valuable only if it respects Java/Maven workflow. The current implementation is enough to review the adapter contract and evidence direction, but the product should be sold as a CI/release evidence bridge until Maven Central publication, proxy/cache documentation, CI/Docker wrappers, Spring/Thymeleaf fixtures and host-surface screenshots exist. The economic buyer is not the individual Java developer; it is the build/platform/compliance organization that needs durable evidence across Java web releases.</p>

  <h2>31. Maven Buyer Objection Map</h2>
  <p>This section is intentionally blunt because it is where a Java buyer will attack the product. A report that does not answer these objections is not ready for review, even if the code builds. The pattern is the same as the Go-channel correction: respect the host ecosystem first, then decide where the heavy Ariada runtime belongs.</p>
  ${table(['Objection', 'Answer'], objectionRows)}

  <h2>32. Technical Interface Map</h2>
  <p>The Maven product needs several entrypoints because Java estates are not homogeneous. Small teams can run an explicit goal, platform teams prefer parent POMs and CI templates, and enterprises often require Docker or Jenkins wrappers. The adapter remains thin, but the product surface cannot be a single <code>npx</code> call hidden inside Java.</p>
  ${table(['Interface', 'Shape', 'Why It Exists'], connectorRows)}

  <h2>33. Documentation Backlog Before Public Release</h2>
  <p>These docs are product work, not marketing polish. Maven buyers will not trust a scanner that ignores parent POMs, Central publication, proxy repositories, Spring runtime lifecycle, CI artifact retention or threshold rollout. Each docs item below maps directly to an adoption blocker found in the channel-culture section.</p>
  ${table(['Doc Page', 'Source Anchor / Content', 'Role Served'], docsBacklogRows)}

  <h2>34. Interview Script For Maven Channel Research</h2>
  <p>Before treating Maven as a scalable channel, run short interviews or written reviews against these questions. The goal is to validate workflow placement, willingness to pay, artifact expectations and objections around foreign runtimes. Answers should feed the next generator revision and the Delivery Hub status row.</p>
  ${table(['Interviewee', 'Question', 'Signal'], interviewRows)}

  <h2>35. Extended Source Queue</h2>
  <p>The first source table above contains the core report citations. This extended queue is for the next agent expanding Maven docs, CI examples and domain fixtures. Keep using official sources where possible; use competitor docs only to understand conventions and buyer expectations.</p>
  ${table(['Source', 'Use'], extendedSourceRows)}

  <h2>36. Pre-Release Decision</h2>
  <table><tbody>
    <tr><th scope="row">Can this be reviewed?</th><td>Yes, as an MVP Maven evidence bridge report, after the strict skill audit passes and the screenshot is opened visually.</td></tr>
    <tr><th scope="row">Can this be marketed as Maven-native?</th><td>No. It can be marketed as Maven-shaped CI/release evidence over the shared Ariada scanner, with the native path clearly documented.</td></tr>
    <tr><th scope="row">Can this be published to Maven Central?</th><td>No, not until founder-owned namespace, signing and token gates are complete.</td></tr>
    <tr><th scope="row">What must be built next?</th><td>CI/Docker wrapper, parent POM docs, proxy/offline docs, Spring/Thymeleaf fixture, fixture/scan-preview screenshot, and hosted evidence retention plan.</td></tr>
  </tbody></table>

  <h2>37. Detailed Product Conclusion For Maven</h2>
  <p>The Maven channel is promising because it sits exactly where Java organizations already accept policy gates: the build and release lifecycle. That does not mean every Maven run should become a full browser compliance scan. The correct product shape is more precise. Ariada should enter as an explicit evidence profile or CI/release gate that scans a rendered Java web surface and emits a reviewer-ready packet. The free value is the Maven-shaped bridge and local report. The paid value is the operational evidence layer: retention, baselines, reviewer comments, signed exports, domain packs and fleet visibility across many Java applications.</p>
  <p>The important distinction is between developer ergonomics and buyer value. A Java developer values a command that is familiar, predictable and easy to remove if it slows the build. A build engineer values pinned versions, parent POM rollout, proxy compatibility and deterministic output. A CI owner values cacheable runtime setup, stable exit codes and artifact paths. An auditor values raw data, command log, screenshot and rule mapping. A compliance buyer values history, retention, exportability and governance. The current MVP proves only the first slice of that chain: Maven can call Ariada and produce artifacts. The commercial product must connect the rest of the chain.</p>
  <p>The strongest wedge is therefore not “install our Maven plugin because it scans accessibility.” That is too small and too easy to compare against existing scanners. The stronger wedge is: “your Java web release already runs through Maven; add an evidence gate that produces a durable compliance packet before a public/customer release.” This framing lets Ariada avoid a losing fight with Java frameworks, build tools and standalone accessibility engines. Ariada becomes the layer that turns scanner output into review evidence and then into recurring governance. The Maven plugin is the doorway, not the business.</p>
  <p>The main risk is runtime trust. Java organizations are conservative about hidden Node/browser/npm behavior inside builds. If Ariada ignores that, the plugin will look like a clever demo but not a credible enterprise tool. The solution is to separate modes clearly. Local mode should be explicit and opt-in. CI mode should be pinned, cached and documented. Enterprise mode should offer Docker/Jenkins/GitLab/GitHub wrappers and repository-manager guidance. Hosted mode should remove the runtime burden from the developer entirely and sell evidence operations to platform/compliance owners.</p>
  <p>The next engineering step is not more generic prose. It is a Spring Boot or Thymeleaf fixture with a real server lifecycle in Maven, a scan-preview screenshot, a CI recipe that caches the browser/runtime, and a parent POM example. After that, Maven Central publication becomes meaningful because the package will match how Maven teams actually adopt tools. Until then, this report should mark the channel as review-ready MVP evidence, not finished distribution.</p>

  <h2>38. Role Preference Policy For Future Reports</h2>
  <table><tbody>
    <tr><th scope="row">Developer preference policy</th><td>Every future report must say what the developer in that ecosystem already considers normal in the fast loop and what they reject. For Maven, normal means explicit plugin goals, lifecycle phases and profile-controlled checks. Rejected means hidden mutable downloads and heavyweight browser work in every compile/test run. For Rust, the equivalent policy will be about cargo subcommands and crates.io trust. For Go, it is about Action/Docker/single-binary shape rather than manual npm. This is now a report gate, not optional commentary.</td></tr>
    <tr><th scope="row">Platform preference policy</th><td>Every report must identify the owner who can standardize the adapter across many repos or teams. In Maven that is the build engineer or CI/platform owner using parent POMs, pluginManagement and CI templates. In CMS channels it may be the site operations owner or marketplace administrator. In IDE channels it may be an extensions administrator. The product solution must fit that owner, because they are often the first scalable buyer.</td></tr>
    <tr><th scope="row">Reviewer preference policy</th><td>Every report must explain what the reviewer consumes and why. A reviewer does not buy “a JSON file”; they need defensible evidence that can be attached to a ticket, audit packet, release checklist or procurement review. That means raw scanner JSON for machine parsing, command log for reproducibility, screenshot for human context, HTML report for review, source links for claims and handoff rows for ownership.</td></tr>
    <tr><th scope="row">Economic buyer policy</th><td>Every report must name who pays and what value they buy. If the developer is only the adoption user, do not pretend they are the revenue center. For Maven, the economic buyer appears when evidence becomes recurring governance: CI/platform budget, product release-risk budget or compliance/legal budget. Paid features should therefore cluster around retention, baselines, signed exports, team dashboards, domain packs, SSO and policy management.</td></tr>
    <tr><th scope="row">Implementation honesty policy</th><td>Every report must classify the adapter honestly: final native channel, MVP evidence bridge, fixture proof or blocked. Maven is an MVP evidence bridge because it is Maven-shaped but not a Java-native scanner. That is acceptable if documented. It is harmful if hidden. The same rule applies to all future channel reports before they are opened for review or sent by email.</td></tr>
  </tbody></table>
</main>
<footer>
  <p>Maintained by Alexander Brichkin (Agonist Development AB). Generated for local review; no public push performed.</p>
</footer>
</body>
</html>`;

writeFileSync(join(outDir, 'result.html'), html, 'utf8');
console.log(join(outDir, 'result.html'));
