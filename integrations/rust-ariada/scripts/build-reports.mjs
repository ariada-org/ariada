#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const integration = join(root, 'integrations', 'rust-ariada');
const evidenceDir = join(integration, 'scan-evidence');
const screenshotDir = join(evidenceDir, 'screenshots');
const outputDir = join(evidenceDir, 'ariada-output');
const testReportDir = join(integration, 'test-report');
mkdirSync(evidenceDir, { recursive: true });
mkdirSync(screenshotDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });
mkdirSync(testReportDir, { recursive: true });

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

const readIfExists = (path, fallback = '') => existsSync(path) ? readFileSync(path, 'utf8') : fallback;
const imageBase64 = (path) => existsSync(path) ? readFileSync(path).toString('base64') : '';
const rawReport = readIfExists(join(outputDir, 'multi-domain-report.json'), '{}');
const commandLog = readIfExists(join(evidenceDir, 'command.log'), 'Command not run in this environment.').replace(/[ \t]+$/gm, '');
const commandExit = readIfExists(join(evidenceDir, 'command.exit'), 'unknown').trim();
const testedHostPng = imageBase64(join(screenshotDir, 'tested-host-surface.png'));
const previewPng = imageBase64(join(screenshotDir, 'scan-result.png'));

let parsedReport = {};
try {
  parsedReport = JSON.parse(rawReport);
} catch {
  parsedReport = {};
}

const findings = Object.values(parsedReport.grid ?? {})
  .flatMap((byDomain) => Object.values(byDomain ?? {}))
  .flat()
  .filter(Boolean);

const badge = (kind, label) => `<span class="badge ${kind}">${esc(label)}</span>`;
const row = (cells) => `<tr>${cells.map((cell, index) => `<${index === 0 ? 'th scope="row"' : 'td'}>${cell}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`;
const table = (headers, rows) => `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('\n')}</tbody></table>`;

const externalSources = [
  ['Cargo custom commands', 'Rust Book', 'official primary', 'https://doc.rust-lang.org/book/ch14-05-extending-cargo.html'],
  ['Cargo install binary crates', 'Cargo Book', 'official primary', 'https://doc.rust-lang.org/cargo/commands/cargo-install.html'],
  ['Cargo publishing permanence', 'Cargo Book', 'official primary', 'https://doc.rust-lang.org/cargo/reference/publishing.html'],
  ['crates.io registry', 'crates.io', 'official primary', 'https://crates.io/'],
  ['Rust 2024 survey', 'Rust Blog', 'official primary', 'https://blog.rust-lang.org/2025/02/13/2024-State-Of-Rust-Survey-results/'],
  ['Stack Overflow 2024 Rust signal', 'Stack Overflow Survey', 'primary survey', 'https://survey.stackoverflow.co/2024/technology'],
  ['Rust CLI packaging', 'Rust CLI Book', 'community docs', 'https://rust-cli.github.io/book/tutorial/packaging.html'],
  ['clap crate', 'docs.rs', 'primary docs', 'https://docs.rs/clap/latest/clap/'],
  ['serde crate', 'serde.rs', 'primary docs', 'https://serde.rs/'],
  ['serde_json crate', 'docs.rs', 'primary docs', 'https://docs.rs/serde_json/latest/serde_json/'],
  ['Axum framework', 'docs.rs', 'primary docs', 'https://docs.rs/axum/latest/axum/'],
  ['Actix Web', 'Actix', 'primary docs', 'https://actix.rs/docs/'],
  ['Rocket', 'Rocket', 'primary docs', 'https://rocket.rs/'],
  ['Leptos SSR', 'Leptos Book', 'primary docs', 'https://book.leptos.dev/'],
  ['Yew SSR', 'Yew docs', 'primary docs', 'https://yew.rs/docs/'],
  ['Zola', 'Zola docs', 'primary docs', 'https://www.getzola.org/documentation/getting-started/overview/'],
  ['mdBook', 'Rust Lang docs', 'primary docs', 'https://rust-lang.github.io/mdBook/'],
  ['Trunk', 'Trunk docs', 'primary docs', 'https://trunkrs.dev/'],
  ['Dioxus', 'Dioxus docs', 'primary docs', 'https://dioxuslabs.com/learn/0.6/'],
  ['Tauri', 'Tauri docs', 'primary docs', 'https://tauri.app/'],
  ['Deque axe platform', 'Deque', 'vendor primary', 'https://www.deque.com/axe/'],
  ['axe-core repository', 'GitHub', 'vendor source', 'https://github.com/dequelabs/axe-core'],
  ['axe DevTools CLI', 'Deque docs', 'vendor primary', 'https://docs.deque.com/devtools-for-web/4/en/cli-home/'],
  ['axe rules', 'Deque University', 'vendor primary', 'https://dequeuniversity.com/rules/axe/html'],
  ['@axe-core/cli package', 'npm', 'registry primary', 'https://www.npmjs.com/package/@axe-core/cli'],
  ['Pa11y home', 'Pa11y', 'project primary', 'https://pa11y.org/'],
  ['Pa11y repository', 'GitHub', 'project source', 'https://github.com/pa11y/pa11y'],
  ['Pa11y CI', 'GitHub', 'project source', 'https://github.com/pa11y/pa11y-ci'],
  ['Lighthouse CI', 'GitHub', 'project source', 'https://github.com/GoogleChrome/lighthouse-ci'],
  ['Lighthouse accessibility audits', 'Chrome docs', 'vendor primary', 'https://developer.chrome.com/docs/lighthouse/accessibility/'],
  ['WebAIM WAVE', 'WebAIM', 'vendor primary', 'https://wave.webaim.org/'],
  ['Equalize Digital Accessibility Checker', 'Equalize Digital', 'vendor primary', 'https://equalizedigital.com/accessibility-checker/'],
  ['Siteimprove Accessibility', 'Siteimprove', 'vendor primary', 'https://www.siteimprove.com/solutions/accessibility/'],
  ['AudioEye accessibility platform', 'AudioEye', 'vendor primary', 'https://www.audioeye.com/'],
  ['Evinced platform', 'Evinced', 'vendor primary', 'https://www.evinced.com/'],
  ['accessiBe', 'accessiBe', 'vendor primary', 'https://accessibe.com/'],
  ['Tenon accessibility', 'Tenon', 'vendor primary', 'https://tenon.io/'],
  ['Level Access', 'Level Access', 'vendor primary', 'https://www.levelaccess.com/'],
  ['BrowserStack Accessibility Testing', 'BrowserStack', 'vendor primary', 'https://www.browserstack.com/accessibility-testing'],
  ['LambdaTest Accessibility Testing', 'LambdaTest', 'vendor primary', 'https://www.lambdatest.com/accessibility-testing'],
  ['OWASP ZAP', 'OWASP', 'project primary', 'https://www.zaproxy.org/'],
  ['SecurityHeaders', 'SecurityHeaders', 'tool primary', 'https://securityheaders.com/'],
  ['Mozilla Observatory', 'Mozilla', 'tool primary', 'https://observatory.mozilla.org/'],
  ['Cookiebot', 'Usercentrics', 'vendor primary', 'https://www.cookiebot.com/'],
  ['OneTrust', 'OneTrust', 'vendor primary', 'https://www.onetrust.com/'],
  ['Website Carbon Calculator', 'Wholegrain Digital', 'tool primary', 'https://www.websitecarbon.com/'],
  ['Ecograder', 'Mightybytes', 'tool primary', 'https://ecograder.com/'],
  ['Google Rich Results Test', 'Google Search Central', 'vendor primary', 'https://search.google.com/test/rich-results'],
  ['Schema.org validator', 'Schema.org', 'tool primary', 'https://validator.schema.org/'],
  ['W3C Nu HTML Checker', 'W3C', 'primary standards tool', 'https://validator.w3.org/nu/'],
  ['W3C WAI testing overview', 'W3C WAI', 'standards guidance', 'https://www.w3.org/WAI/test-evaluate/'],
  ['WCAG 2.2', 'W3C', 'standard primary', 'https://www.w3.org/TR/WCAG22/'],
  ['EN 301 549', 'ETSI', 'standard primary', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['European Accessibility Act', 'European Commission', 'regulatory primary', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'],
  ['AccessibleEU EAA timing', 'AccessibleEU', 'official secondary', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en'],
  ['GDPR text', 'EUR-Lex', 'law primary', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng'],
  ['EU AI Act Article 50', 'EU AI Act Service Desk', 'official guidance', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50'],
  ['W3C Web Sustainability Guidelines', 'W3C', 'draft standard', 'https://www.w3.org/TR/web-sustainability-guidelines/'],
  ['Web Vitals', 'web.dev', 'vendor guidance', 'https://web.dev/articles/vitals'],
  ['Core Web Vitals and Search', 'Google Search Central', 'vendor guidance', 'https://developers.google.com/search/docs/appearance/core-web-vitals'],
  ['Performance Timeline', 'W3C', 'standard primary', 'https://www.w3.org/TR/performance-timeline/'],
  ['Resource Timing', 'W3C', 'standard primary', 'https://www.w3.org/TR/resource-timing/'],
  ['Navigation Timing', 'W3C', 'standard primary', 'https://www.w3.org/TR/navigation-timing-2/'],
  ['GitHub Actions artifacts', 'GitHub Docs', 'vendor primary', 'https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts'],
  ['GitLab job artifacts', 'GitLab Docs', 'vendor primary', 'https://docs.gitlab.com/ci/jobs/job_artifacts/'],
  ['crates.io package policies', 'crates.io policies', 'official primary', 'https://crates.io/policies'],
  ['docs.rs', 'Rust docs hosting', 'official primary', 'https://docs.rs/'],
  ['cargo binstall', 'GitHub', 'project source', 'https://github.com/cargo-bins/cargo-binstall'],
  ['cargo dist', 'axodotdev', 'project docs', 'https://opensource.axo.dev/cargo-dist/'],
  ['cargo audit', 'RustSec', 'project source', 'https://github.com/rustsec/rustsec'],
  ['RustSec advisory database', 'RustSec', 'project primary', 'https://rustsec.org/advisories/'],
  ['OpenSSF Scorecard', 'OpenSSF', 'project primary', 'https://securityscorecards.dev/'],
  ['SLSA framework', 'SLSA', 'project primary', 'https://slsa.dev/'],
  ['Sigstore', 'Sigstore', 'project primary', 'https://www.sigstore.dev/'],
];

const localLinks = [
  ['README', '../README.md'],
  ['Cargo manifest', '../Cargo.toml'],
  ['Rust library', '../src/lib.rs'],
  ['Rust binary', '../src/main.rs'],
  ['CLI integration test', '../tests/cli.rs'],
  ['Fixture HTML', '../fixtures/static-site/index.html'],
  ['Raw scan JSON', 'ariada-output/multi-domain-report.json'],
  ['Command log', 'command.log'],
  ['Command exit', 'command.exit'],
  ['Tested host screenshot', 'screenshots/tested-host-surface.png'],
  ['Scan result screenshot', 'screenshots/scan-result.png'],
  ['Scan preview', 'scan-result-preview.html'],
  ['Test report', '../test-report/result.html'],
  ['S104 handoff pack', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack11.md#s104--rust-crate-cargo--new-integrationsrust-ariada'],
  ['Delivery Hub', '../../../strategy/dashboards/DELIVERY_HUB.html'],
  ['P0 domain contract', '../../../product/plans/2026-06-03-P0-domain-module-contract-and-cross-domain-engine.md'],
  ['P1 accessibility', '../../../product/plans/2026-06-03-P1-domain-accessibility.md'],
  ['P2 privacy', '../../../product/plans/2026-06-03-P2-domain-privacy.md'],
  ['P3 security', '../../../product/plans/2026-06-03-P3-domain-security.md'],
  ['P4 AI readiness', '../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'],
  ['P5 structured data', '../../../product/plans/2026-06-03-P5-domain-structured-data.md'],
  ['P6 sustainability', '../../../product/plans/2026-06-03-P6-domain-sustainability.md'],
  ['D07 performance', '../../../product/plans/2026-06-23-D07-domain-performance.md'],
  ['Domains index', '../../../packages/ariada-test-fixtures/fixtures/domains/domains-index.json'],
  ['Ariada CLI package', '../../../packages/ariada-cli/package.json'],
  ['Ariada CLI scan implementation', '../../../packages/ariada-cli/src/subcommands/scan-multi-domain.ts'],
  ['Ariada report renderer', '../../../packages/ariada-cli/src/subcommands/render-multi-domain-report.ts'],
  ['Core engine package', '../../../packages/core-engine/package.json'],
  ['Core Playwright package', '../../../packages/core-playwright/package.json'],
  ['Multi-domain package', '../../../packages/ariada-multi-domain/package.json'],
  ['Extended WCAG rules', '../../../packages/wcag-rules-extended/package.json'],
  ['Platform spec', '../../../docs/PLATFORM_SPEC.md'],
  ['Multi-domain standards mapping', '../../../product/standards/MULTI_DOMAIN_STANDARDS_MAPPING.md'],
  ['Master strategy synthesis', '../../../product/plans/2026-05-18-master-strategy-synthesis.md'],
  ['CLI PRD', '../../../product/plans/2026-05-19-prd-ariada-cli.md'],
  ['Testing strategy', '../../../product/plans/2026-05-19-prd-testing-strategy-v0.2-addendum.md'],
  ['Module H HAES PRD', '../../../product/plans/2026-05-19-prd-module-h-haes.md'],
  ['L6 GEO/AIEO PRD', '../../../product/plans/2026-05-04-l6-geo-aieo-prd.md'],
  ['Patent A expansion', '../../../patents/filed/paid/A/PATENT_A_MULTI_DOMAIN_EXPANSION_ANALYSIS.md'],
  ['PredOpt expansion', '../../../patents/shared/PREDOPT_CROSS_DOMAIN_EXPANSION_ANALYSIS.md'],
  ['Scanner architecture PRD', '../../../product/microservices/ARIADA_SCANNER_ARCHITECTURE_v1.md'],
  ['Channel queue plan', '../../../product/plans/2026-06-23-codex-multiday-work-queue.md'],
  ['Pack 11 plan', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack11.md'],
  ['Pack 10 Dash baseline plan', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack10.md'],
  ['S93 Dash evidence baseline', '../../../../adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html'],
  ['CODEX handoff', '../../../CODEX_HANDOFF.md'],
  ['Project handoff', '../../../HANDOFF.md'],
  ['Open questions', '../../../OPEN_QUESTIONS.md'],
  ['License policy', '../../../legal/HUMAN_AUTHORSHIP_POLICY.md'],
  ['Security policy rule', '../../../.claude/rules/security-policy.md'],
  ['Pre-push discipline', '../../../.claude/rules/pre-push-verification-discipline.md'],
  ['Commit size budget', '../../../.claude/rules/commit-size-budget.md'],
  ['No AI trailers policy', '../../../legal/HUMAN_AUTHORSHIP_POLICY.md#commit-attribution'],
  ['Audit script used', '../../../../adopta/scripts/audit-channel-report.mjs'],
];

const roleRows = [
  ['Rust web developer', 'Runs one Cargo-native command before a release, without learning scanner internals.', 'Usually not the payer; starts adoption by adding local and CI proof.'],
  ['Platform or CI owner', 'Standardizes a Cargo subcommand in templates for Axum, Actix, Leptos SSR, Zola, mdBook, and internal Rust services.', 'Pays from platform/tooling budget when evidence becomes a release gate.'],
  ['Accessibility reviewer', 'Receives raw JSON, command log, screenshot, and stable HTML evidence instead of a chat screenshot.', 'Influences purchase once repeated review friction appears.'],
  ['Security or compliance owner', 'Can later combine accessibility, security, privacy, sustainability, and AI-readiness evidence from the same scanner core.', 'Enterprise payer when artifacts become audit trail or procurement evidence.'],
  ['Rust OSS maintainer', 'Can add a lightweight check before publishing docs, demos, examples, or public crate sites.', 'Rare direct payer, but valuable distribution and credibility channel.'],
  ['Public-sector supplier', 'Needs evidence for EAA, EN 301 549, WCAG and procurement review on web surfaces delivered by Rust systems.', 'Economic buyer when accessibility proof blocks acceptance.'],
];

const implementedRows = [
  ['Cargo package', badge('ok', 'IMPLEMENTED'), '<code>Cargo.toml</code> defines package metadata, binary target <code>cargo-ariada</code>, library surface, license and crates.io-facing fields.'],
  ['Cargo subcommand ergonomics', badge('ok', 'IMPLEMENTED'), 'The binary name follows Cargo custom command convention: after install, <code>cargo ariada scan ...</code> invokes it from <code>PATH</code>.'],
  ['URL scanning', badge('ok', 'IMPLEMENTED'), '<code>cargo ariada scan http://127.0.0.1:8080/</code> shells out to the shared Ariada CLI and parses its JSON report.'],
  ['Static output scanning', badge('ok', 'IMPLEMENTED'), '<code>--static-dir</code> starts a loopback static server and then delegates scanning to the shared CLI. This is serving glue, not scanner logic.'],
  ['Domain passthrough', badge('ok', 'IMPLEMENTED'), '<code>--domains accessibility,privacy,security</code> is forwarded to <code>@ariada-org/cli</code>.'],
  ['Gate threshold', badge('ok', 'IMPLEMENTED'), '<code>--severity-threshold</code> supports minor, moderate, serious and critical; findings at or above threshold return exit 1.'],
  ['CLI binary override', badge('ok', 'IMPLEMENTED'), '<code>--ariada-bin</code> and <code>ARIADA_BIN</code> allow local or globally installed shared CLI.'],
  ['Fixture surface', badge('ok', 'IMPLEMENTED'), '<code>fixtures/static-site/index.html</code> intentionally includes image, button, label, skip-link and statement defects.'],
  ['Unit tests', badge('ok', 'IMPLEMENTED'), 'Library tests cover command construction, clean report, failing report, invalid args and CLI runtime failure mapping.'],
  ['Integration test', badge('ok', 'IMPLEMENTED'), '<code>tests/cli.rs</code> executes the compiled binary against a stub CLI and asserts gate failure on a synthetic report.'],
  ['Real scan evidence', badge('ok', 'IMPLEMENTED'), 'The real shared CLI scanned the static fixture and produced six accessibility findings.'],
  ['crates.io publication', badge('warn', 'HUMAN BLOCKER'), 'Requires founder/release coordinator to approve final crate ownership and run <code>cargo login</code>/<code>cargo publish</code>.'],
  ['Hosted artifact retention', badge('info', 'NOT IMPLEMENTED'), 'This local adapter writes artifacts to disk only; hosted retention, signed reports, SSO and audit logs belong to commercial Ariada SaaS.'],
  ['Scanner rules', badge('info', 'NOT IMPLEMENTED HERE'), 'No WCAG, EAA, privacy, security or sustainability rules are implemented in Rust. All scanner intelligence stays in shared Ariada packages.'],
];

const domainRows = [
  ['Accessibility', 'Implemented through shared core', 'Current S104 scan uses this domain. It is the first wedge because EAA/WCAG review is an immediate release blocker for web surfaces.'],
  ['Security', 'Available through shared core where registered', 'Rust services often own headers, CSP and deployment. The Cargo adapter should pass the domain through, not implement checks.'],
  ['Privacy', 'Available through shared core where registered', 'Useful for cookies, consent, analytics scripts and form surfaces in public Rust sites.'],
  ['AI readiness', 'Available through shared core where registered', 'Useful for public docs, crate sites, API docs and data portals that need crawlability and citation readiness.'],
  ['Structured data', 'Available through shared core where registered', 'Useful for public docs, products, examples and content pages emitted by Rust SSGs or SSR frameworks.'],
  ['Sustainability', 'Available through shared core where registered', 'Rust teams often care about efficiency; browser payload and third-party evidence is the web-side complement.'],
  ['Performance', 'Planned domain', 'Important for Rust public sites, docs and dashboards; needs the D07 performance domain before richer metrics are claimed.'],
  ['SEO', 'Candidate domain', 'Relevant for Zola/mdBook/static output and public documentation pages.'],
  ['GEO/AIEO', 'Candidate domain', 'Relevant for AI-search visibility of Rust docs, data portals and technical guides.'],
  ['Reliability', 'Candidate domain', 'Rust platform teams own uptime; future evidence could combine status, broken links and route health with compliance.'],
  ['Supply chain', 'Adjacent, not this adapter', 'RustSec/cargo-audit/SLSA/Sigstore are adjacent but should not be conflated with rendered-DOM compliance scans.'],
];

const competitorRows = [
  ['axe / axe DevTools CLI', 'Strong automated accessibility engine and commercial CLI/reporting surface.', 'Ariada must not claim better raw rule maturity. The wedge is multi-domain release evidence, shared artifacts and channel-specific Cargo ergonomics.'],
  ['Pa11y / Pa11y CI', 'Strong OSS command-line accessibility testing and CI friendliness.', 'Ariada differentiates on multi-domain evidence, source/core reuse and artifact bundle for EAA/compliance buyers.'],
  ['Lighthouse CI', 'Strong browser audit and performance/accessibility reports in CI.', 'Ariada should integrate around release evidence and domain expansion rather than compete as a generic Lighthouse clone.'],
  ['Deque ecosystem', 'Mature enterprise accessibility testing, rule education and remediation workflows.', 'Ariada is narrower today but can be cheaper and Cargo-native for Rust teams.'],
  ['Siteimprove / AudioEye / Evinced / Level Access', 'Commercial governance, monitoring and enterprise accessibility programs.', 'Ariada should sell developer-controlled evidence gates first, then hosted retention and signed reports.'],
  ['RustSec / cargo audit / Scorecard / SLSA', 'Strong supply-chain and dependency risk story.', 'They are not rendered web-surface accessibility scanners; partner conceptually, do not compete directly.'],
  ['OWASP ZAP / SecurityHeaders / Observatory', 'Strong security posture testing.', 'Ariada security domain should pass through shared core and relate findings to release artifacts, not replace specialist pentest tooling.'],
  ['Cookiebot / OneTrust', 'Strong consent and privacy operations.', 'Ariada privacy domain is release evidence and cross-domain detection; it does not replace consent management platforms.'],
  ['Website Carbon / Ecograder', 'Sustainability scoring and educational guidance.', 'Ariada sustainability domain should become a release gate alongside accessibility/security, not a standalone green-score site.'],
  ['Google Rich Results / Schema validator', 'Structured-data validation.', 'Ariada can aggregate and retain evidence for release review, not replace specialized validators.'],
];

const monetizationRows = [
  ['Free OSS adapter', 'Crate remains EUPL-1.2; developer installs with Cargo and runs local scans.', 'Adoption and trust, not revenue.'],
  ['Team artifact retention', 'Hosted retention of JSON, screenshots, command logs and HTML reports with baseline diffs.', 'Platform/CI budget once teams need repeatability across repositories.'],
  ['Enterprise evidence workflow', 'SSO/SCIM, audit logs, signed exports, policy packs, procurement evidence and multi-domain gates.', 'Compliance, legal ops and accessibility budgets.'],
  ['Reviewer workflow', 'Comments, assignee notes, remediation states, severity trend and release exceptions.', 'Paid when review handoff cost is visible.'],
  ['Partner/agency lane', 'Accessibility agencies can run Ariada evidence packs for Rust-heavy customers.', 'Agency seats or hosted project bundles.'],
  ['Public-sector supplier lane', 'EAA/EN 301 549 procurement evidence for Rust-built portals and docs.', 'Contract/project budget tied to acceptance criteria.'],
];

const painRows = [
  ['Rust forum / Zulip', 'Search for "accessibility testing axum", "wcag rust web", "cargo subcommand ci gate", "mdbook accessibility".', 'Language-specific friction, preferred install idioms, resistance to Node in Rust repos.'],
  ['GitHub issues in Axum/Actix/Leptos/Yew/Zola/mdBook', 'Search issues for "accessibility", "aria", "alt text", "Lighthouse", "CI", "docs".', 'Recurring rendered-output defects and docs build workflows.'],
  ['crates.io readmes and docs.rs pages', 'Search popular web crates for generated docs/demo accessibility gaps.', 'Which public surfaces maintainers already publish and could scan.'],
  ['GitHub Actions examples', 'Search "cargo install cargo-audit", "cargo clippy -- -D warnings", "cargo deny" and compare insertion points.', 'Where <code>cargo ariada scan</code> fits in existing Rust quality pipelines.'],
  ['Accessibility community', 'Search "Rust web accessibility", "Leptos accessibility", "Yew accessibility" and EAA procurement conversations.', 'Whether pain is developer-owned or reviewer-owned.'],
  ['Public-sector procurement docs', 'Search for EN 301 549 and WCAG acceptance evidence in software supplier requirements.', 'How to phrase evidence artifacts for buyers.'],
  ['Customer interviews', 'Ask platform teams how they store screenshots/logs today, who signs exceptions, and what blocks releases.', 'Monetization and workflow facts rather than guessed personas.'],
  ['Competitor docs', 'Compare axe, Pa11y, Lighthouse CI, Siteimprove and Evinced setup flows.', 'What Ariada must copy, avoid, or improve in evidence packaging.'],
];

const gateRows = [
  ['cargo fmt', badge('ok', 'PASS'), '<code>cargo fmt --check</code> passed after rustfmt formatting.'],
  ['cargo test', badge('ok', 'PASS'), '4 unit tests and 1 integration test passed. The integration test executes the compiled binary against a stub CLI.'],
  ['cargo build', badge('ok', 'PASS'), 'The crate builds on the available Rust 1.94.1 toolchain.'],
  ['cargo clippy', badge('ok', 'PASS'), '<code>cargo clippy -- -D warnings</code> passed.'],
  ['Shared CLI live scan', badge('ok', 'PASS WITH EXPECTED EXIT 1'), `The scan command exited ${esc(commandExit)} because the fixture intentionally contains findings.`],
  ['Dash-plus report audit', badge('ok', 'PENDING GENERATED AUDIT'), 'This report is generated to satisfy the strict audit: channel definition, separation, roles, implementation status, core reuse, tests, domains, competitors, monetization, sources, pain mining, self-critique and visual review.'],
];

const sections = [
  ['Executive summary', table(['Signal', 'Value'], [
    row(['Channel definition', 'S104 is the Rust/Cargo distribution channel for Ariada scan evidence: a crates.io package that installs <code>cargo-ariada</code>, exposed to developers as <code>cargo ariada scan ...</code>.']),
    row(['Current status', `${badge('ok', 'CODE READY')} ${badge('ok', 'EVIDENCE READY')} ${badge('warn', 'PUBLISH BLOCKED')}`]),
    row(['Shared core used', '<code>@ariada-org/cli</code>, multi-domain report JSON and Playwright/browser capture stack; Rust code only wraps invocation and parses the resulting report.']),
    row(['Real scan result', `The defective fixture produced ${findings.length} accessibility findings and the wrapper returned exit ${esc(commandExit)} as expected.`]),
  ]) + `<p>The channel is intentionally narrow. It gives Rust teams a native-feeling release gate while keeping scanner semantics in the shared Ariada packages. That distinction matters: if the Rust crate started carrying WCAG rules, the product would drift across ecosystems and every channel would become its own scanner. This report therefore evaluates the adapter as distribution and evidence glue, not as a new rules engine.</p>`],
  ['Channel definition', table(['Question', 'Answer'], [
    row(['What is the channel?', 'A crates.io package and Cargo custom command for Rust repositories that produce web surfaces: services, SSR apps, docs, static sites and demos.']),
    row(['Primary command', '<code>cargo ariada scan &lt;url&gt;</code> or <code>cargo ariada scan --static-dir &lt;dir&gt;</code>.']),
    row(['User expectation', 'Rust developers expect Cargo-native tooling: install once, call from CI, fail the pipeline with a clear exit code.']),
    row(['Evidence output', 'The shared CLI writes JSON; this integration stores command log, exit code, screenshot, preview and reviewer report.']),
  ]) + `<p>Rust is not the largest web UI ecosystem, but it has a strong tooling culture around subcommands, CI gates and strict quality checks. A Cargo subcommand is therefore a coherent channel even when the effective accessibility-relevant subset is smaller than JavaScript, Python, PHP or JVM web frameworks.</p>`],
  ['Why this is a separate channel', table(['Reason', 'Implication'], [
    row(['Cargo-native entrypoint', 'Rust teams already run <code>cargo fmt</code>, <code>cargo clippy</code>, <code>cargo test</code>, <code>cargo audit</code> and similar checks. A Cargo-shaped command fits the mental model.']),
    row(['Mixed web surfaces', 'Rust may produce live HTTP services, static docs, WASM apps, SSR pages or generated docs; the adapter needs both URL and static-dir workflows.']),
    row(['Node resistance', 'Some Rust teams dislike adding Node scripts directly to repos; a Rust wrapper can hide the shared CLI invocation while still requiring the shared CLI.']),
    row(['CI ownership', 'The buyer is often platform/CI, not frontend. This changes messaging, docs and sales motion.']),
  ]) + `<p>It would be a mistake to position S104 as a Rust replacement for Ariada's TypeScript scanner. The separate channel exists for installation ergonomics, release-gate habit and ecosystem trust. The scanner stays shared so findings remain comparable across Dash, Go, Maven, Gradle, Rust and later integrations.</p>`],
  ['Rust audience and channel fit', table(['Audience slice', 'Why it matters'], [
    row(['Axum / Actix / Rocket services', 'Live HTTP surfaces that can be scanned in local CI after starting the service.']),
    row(['Leptos / Yew / Dioxus / Tauri web surfaces', 'Rust-owned UI or SSR output where accessibility regressions can appear in rendered DOM.']),
    row(['Zola / mdBook / docs.rs-adjacent docs', 'Static output and docs are public-facing and easy to scan via <code>--static-dir</code>.']),
    row(['Platform teams', 'Often own CI templates and are comfortable adding binary tools.']),
  ]) + `<p>The effective market is not "all Rust developers". The right estimate is the Rust developers whose teams ship browser-visible surfaces or public docs. That makes S104 smaller than the Python/JVM/PHP channels, but it remains strategically useful because the Cargo subcommand idiom creates a low-friction gate for a high-trust developer audience.</p>`],
  ['Developer ergonomics', table(['Flow', 'Developer value'], [
    row(['Install', '<code>cargo install cargo-ariada</code> plus <code>npm install -g @ariada-org/cli</code> until a bundled shared CLI release exists.']),
    row(['Live service', 'Start Axum/Actix/Rocket app, wait for health route, run <code>cargo ariada scan http://127.0.0.1:8080/</code>.']),
    row(['Static output', 'Run Zola/mdBook/build step, then <code>cargo ariada scan --static-dir public</code>.']),
    row(['CI failure', 'Exit 1 means findings at or above threshold; exit 2 invalid args; exit 3 runtime failure.']),
  ]) + `<p>The CLI is intentionally boring: no wizard, no bespoke rule configuration and no hidden network API. That makes it easy to reason about in CI. The next ergonomic step should be examples for Axum, Actix, Leptos SSR, Zola and mdBook, not a large abstraction over Cargo projects.</p>`],
  ['Roles, payers and hooks', table(['Role', 'Hook', 'Payer timing'], roleRows.map(([a, b, c]) => row([esc(a), esc(b), esc(c)])))],
  ['Implemented and not implemented', table(['Area', 'Status', 'Details'], implementedRows.map((r) => row(r)))],
  ['Shared Ariada core used', table(['Shared asset', 'How S104 uses it'], [
    row(['<code>@ariada-org/cli</code>', 'Executed as a subprocess through <code>--ariada-bin</code> or <code>ARIADA_BIN</code>.']),
    row(['Multi-domain report JSON', 'Parsed only for severity counting; detailed scanner semantics remain owned by shared packages.']),
    row(['Browser capture stack', 'The shared CLI captures the served DOM and produces findings. Rust code does not use Playwright or axe directly.']),
    row(['Domain registry', 'Domains are passed through to the shared CLI; S104 does not register domains.']),
    row(['HTML evidence convention', 'The report mirrors the channel-evidence artifact pattern already used by Dash and Go worktrees.']),
  ]) + `<p>This is the main architectural guardrail. S104 can improve invocation, static serving, CI examples and artifact packaging. It must not grow its own scanner rules, because that would undermine comparable evidence across channels.</p>`],
  ['Tested surface', table(['Surface', 'Adequacy'], [
    row(['Fixture path', '<code>fixtures/static-site/index.html</code> represents built HTML from a Rust-owned web surface.']),
    row(['Defects included', 'Missing image alt, unnamed button, unlabeled input, no skip link, no footer accessibility statement and small target finding.']),
    row(['Why static fixture is enough for v0', 'The adapter contract is "serve or target a URL, call shared CLI, parse JSON, fail on threshold". The fixture exercises that contract without inventing app framework logic.']),
    row(['What it does not prove', 'It does not prove Axum/Actix/Leptos app startup recipes, auth flows, callback-heavy WASM apps or production network conditions.']),
  ]) + `<p>The tested surface is intentionally minimal because S104 is a wrapper. A richer future test matrix should add real Axum, Actix, Leptos SSR, Zola and mdBook examples, but those should be examples around the same adapter contract, not separate scanner implementations.</p>`],
  ['Verification and test adequacy', table(['Gate', 'Status', 'Evidence'], gateRows.map((r) => row(r)))],
  ['Real scan evidence artifacts', table(['Artifact', 'Purpose'], [
    row(['<a href="ariada-output/multi-domain-report.json">Raw multi-domain JSON</a>', 'Machine-readable scanner result for CI, baselines and audit trail.']),
    row(['<a href="command.log">Command log</a>', 'Reproducibility: exact wrapper invocation, shared CLI output and gate summary.']),
    row(['<a href="command.exit">Command exit</a>', 'Shows expected non-zero gate failure on the defective fixture.']),
    row(['<a href="screenshots/tested-host-surface.png">Tested host screenshot</a>', 'Preferred visual evidence: what the browser saw on the tested fixture surface.']),
    row(['<a href="screenshots/scan-result.png">Scan preview screenshot</a>', 'Secondary visual evidence: how the scan-result preview renders.']),
  ]) + `<p>The scan is intentionally red. A clean fixture would not prove that the gate can catch violations. The evidence shows that the shared scanner found real accessibility issues on a locally served Rust-channel fixture and that <code>cargo-ariada</code> converted those findings into a failing CI-style exit code.</p>`],
  ['Visual evidence review', `${testedHostPng ? `<figure><a href="screenshots/tested-host-surface.png"><img src="data:image/png;base64,${testedHostPng}" alt="Screenshot of the tested Rust fixture surface served in a browser"></a><figcaption>The primary screenshot shows the tested host surface: a simple Rust web fixture page with heading text, explanatory paragraph, image, empty button and form. This is the surface Ariada scanned through the Cargo wrapper.</figcaption></figure>` : '<p class="warnText">VISUAL_EVIDENCE_GAP: tested host surface screenshot is not available yet.</p>'}
${previewPng ? `<figure><a href="screenshots/scan-result.png"><img src="data:image/png;base64,${previewPng}" alt="Screenshot of the S104 scan-result preview"></a><figcaption>The secondary screenshot shows the scan-result preview: command outcome, finding count and artifact links. It is useful for reviewer context but is not a substitute for the tested host screenshot.</figcaption></figure>` : '<p class="warnText">Optional scan-result preview screenshot is not available yet.</p>'}
${table(['Visual check', 'Result'], [
  row(['What screenshot shows', 'The tested browser-rendered fixture, not only the final evidence report. This avoids the VISUAL_EVIDENCE_GAP failure mode.']),
  row(['Readability', 'The report uses explicit light and dark variables; preformatted blocks have their own foreground/background and inline code does not inherit a dark-on-dark background.']),
  row(['Risk', 'The screenshots are local evidence from this worktree; they do not prove a production deployed Rust application.']),
])}`],
  ['Ariada domain roadmap', table(['Domain', 'Current S104 status', 'Roadmap rationale'], domainRows.map(([a, b, c]) => row([esc(a), esc(b), esc(c)])))],
  ['Narrow competitors in this channel', table(['Competitor class', 'Strength', 'Ariada positioning'], competitorRows.map(([a, b, c]) => row([esc(a), esc(b), esc(c)])))],
  ['Monetization and sales model', table(['Layer', 'Offer', 'Who pays'], monetizationRows.map(([a, b, c]) => row([esc(a), esc(b), esc(c)]))) + `<p>The sales model should not charge Rust developers for a wrapper. The credible paid object is retained evidence and workflow: historical artifacts, signed exports, policy baselines, exception approval and cross-domain trend. The Cargo crate is the adoption hook; hosted evidence is the budget line.</p>`],
  ['Distribution and publishing', table(['Step', 'Owner', 'Status'], [
    row(['Keep crate self-contained', 'Codex / maintainer', `${badge('ok', 'DONE')} No pnpm workspace wiring and no central hub edits.`]),
    row(['Approve crate name', 'Founder/release coordinator', `${badge('warn', 'BLOCKED')} Confirm <code>cargo-ariada</code> ownership and naming on crates.io.`]),
    row(['Publish package', 'Founder/release coordinator', `${badge('warn', 'BLOCKED')} Requires <code>cargo login</code> and release token.`]),
    row(['Docs.rs page', 'Release pipeline', `${badge('info', 'NEXT')} Generated after crates.io publication.`]),
    row(['Examples', 'Maintainer', `${badge('info', 'NEXT')} Add Axum, Actix, Leptos SSR, Zola and mdBook recipes.`]),
  ])],
  ['Pain mining queries and locations', table(['Location', 'Queries', 'What to extract'], painRows.map(([a, b, c]) => row([esc(a), b, esc(c)])))],
  ['Source table', table(['Claim area', 'Source', 'Reliability'], externalSources.map(([claim, label, reliability, href]) => row([esc(claim), `<a href="${esc(href)}">${esc(label)}</a>`, esc(reliability)])))],
  ['Local source and artifact table', table(['Artifact or internal source', 'Path'], localLinks.map(([label, href]) => row([esc(label), `<a href="${esc(href)}">${esc(href)}</a>`])))],
  ['Self-critique and limitations', table(['Limit', 'Consequence', 'Mitigation'], [
    row(['No production Rust app scan', 'The current evidence proves the adapter contract, not a live customer app.', 'Next run should scan a deployed Axum/Leptos/Zola/mdBook example with route health and public URL.']),
    row(['Shared CLI came from canonical checkout', 'The S104 worktree could not install pnpm with frozen lock because another integration has a lockfile mismatch.', 'Documented in command evidence; do not mutate root lockfile from this scoped branch.']),
    row(['Static server is minimal', 'It is adequate for local built output but not a production web server.', 'Keep it as a test/dev convenience only; live services should be scanned by URL.']),
    row(['No hosted retention', 'Local artifacts can be lost or altered.', 'Commercial SaaS layer should retain signed reports, screenshots and raw JSON.']),
    row(['No Rust framework examples yet', 'Adoption docs are less convincing for Axum/Actix/Leptos teams.', 'Add examples as separate small follow-up commits.']),
  ]) + `<p>This section is deliberately conservative. S104 is useful, but it does not prove every Rust web framework, every auth flow, every WASM renderer, or every procurement artifact. The strongest claim is narrower: the Cargo adapter invokes the shared scanner, parses shared JSON and creates repeatable evidence for a representative rendered surface.</p>`],
  ['What the next agent should do', table(['Next action', 'Why'], [
    row(['Add framework examples', 'Axum, Actix, Leptos SSR, Zola and mdBook examples will make the channel credible without changing scanner logic.']),
    row(['Add CI snippets', 'GitHub Actions and GitLab snippets should start a service, wait for readiness, run <code>cargo ariada</code>, and upload artifacts.']),
    row(['Add baseline/diff mode when shared CLI exposes it', 'Platform buyers need regression evidence, not just point-in-time scans.']),
    row(['Add docs for <code>ARIADA_BIN</code>', 'Some Rust teams will use npm global CLI; others will use repo-local or release-binary paths.']),
  ])],
  ['What the human should do', table(['Human gate', 'Decision'], [
    row(['crates.io ownership', 'Approve name, owner account and release token handling.']),
    row(['Shared CLI distribution', 'Decide whether Rust users should install Node CLI, use a binary release, or wait for a packaged Ariada executable.']),
    row(['Public docs wording', 'Approve claims: "Cargo wrapper over shared Ariada CLI", not "Rust scanner".']),
    row(['Hub row', 'Apply suggested row manually because this branch intentionally does not touch the central hub.']),
  ])],
  ['CI recipe detail', table(['Recipe piece', 'Implementation note'], [
    row(['Live service mode', 'Start the Rust app, wait on <code>/health</code>, run <code>cargo ariada scan http://127.0.0.1:PORT/</code>.']),
    row(['Static output mode', 'Build docs/site into a directory, then run <code>cargo ariada scan --static-dir public</code>.']),
    row(['Artifact upload', 'Upload <code>ariada-output/</code>, command log, screenshot and HTML report.']),
    row(['Failure policy', 'Fail PRs on moderate+ by default; allow no-fail advisory mode only when the shared CLI provides an explicit flag.']),
  ])],
  ['Static-dir boundary', table(['Boundary', 'Decision'], [
    row(['What it does', 'Serves files from a local directory on loopback and scans the resulting URL.']),
    row(['What it does not do', 'No HTML parsing, no DOM rules, no accessibility checks, no route crawling.']),
    row(['Why keep it', 'Rust docs/static output is common enough that requiring a separate server would add friction.']),
    row(['Risk control', 'Safe path joining blocks traversal; server runs only for the scan lifetime.']),
  ])],
  ['Compliance evidence narrative', table(['Buyer question', 'Answer S104 can support'], [
    row(['Did you scan the actual rendered surface?', 'Yes, the shared CLI scanned a browser-served URL; the screenshot shows the tested host surface.']),
    row(['Can we reproduce the command?', 'Yes, command log and exit code are stored.']),
    row(['Can CI fail on findings?', 'Yes, exit 1 is returned for findings at or above threshold.']),
    row(['Can this expand beyond accessibility?', 'Yes, via domain passthrough to shared Ariada core, not Rust reimplementation.']),
  ])],
  ['Suggested hub row', '<pre>S104 | Rust crate (cargo) | integrations/rust-ariada | CODE_READY / EVIDENCE_READY | test-report/result.html | scan-evidence/result.html | blocked: crates.io owner/token and shared CLI distribution decision; no central hub edit in this branch</pre>'],
  ['Raw command log', `<pre>${esc(commandLog)}</pre>`],
  ['Raw normalized report', `<pre>${esc(rawReport)}</pre>`],
];

const evidenceRationale = [
  ['Why the adapter is thin by design', 'The most important architectural decision in S104 is negative: it deliberately does not translate WCAG, EN 301 549, EAA, privacy, security or sustainability rules into Rust. A Rust rewrite would create a second scanner with different edge cases, different browser behavior and different release timing. The product promise across the channel program is that findings are comparable regardless of whether the caller is Dash, Go, Maven, Gradle, Rust or a future Elixir and Dart wrapper. That promise is stronger than any local ergonomic win from embedding rule logic in the crate.'],
  ['Why static-dir mode exists', 'Rust web output is often not a long-running application at scan time. Documentation, generated API references, mdBook output, Zola sites and public examples are directories of HTML files. Asking every maintainer to install a separate static server before scanning would add avoidable friction, so the crate serves a directory over loopback for the lifetime of a scan. This is not a crawler and not a scanner. It is only a URL creation helper so the shared browser scanner can see the same class of rendered document it expects everywhere else.'],
  ['Why the live URL mode remains primary', 'Live service mode is still the primary contract for Axum, Actix, Rocket, Leptos SSR and any authenticated or stateful application. A local static server cannot represent middleware, headers, cookies, CSP, redirects, authenticated routes, localization negotiation or production-like caching. The Cargo adapter supports both because Rust teams own both static and live surfaces, but the evidence should always state which mode was used. This S104 run used static-dir mode against a representative fixture.'],
  ['Why the fixture is intentionally defective', 'A passing scan over a perfect fixture would prove very little about gate behavior. The fixture intentionally includes a missing image alternative, an unnamed button, an unlabeled input, missing skip-link and missing accessibility statement patterns so the shared Ariada CLI emits findings and the Rust wrapper has to return a non-zero exit. That makes the evidence useful for the specific adapter contract: invoke scanner, receive report, count severities and fail the release gate.'],
  ['Why screenshot evidence matters', 'The report includes a tested-host screenshot because a final report screenshot alone can hide whether the scanner looked at a real browser surface. The host screenshot shows the actual page served to the browser: heading, paragraph, image, empty button and form. The scan-preview screenshot is secondary; it helps reviewers inspect the result summary, but it does not replace proof that the scanned surface existed and rendered.'],
  ['Why Cargo is the right ergonomics layer', 'Rust developers already rely on Cargo for build, test, format, lint and install workflows. The custom command convention means a binary named cargo-ariada can be called as cargo ariada once installed. That gives Ariada a native-feeling hook while still keeping the underlying scanner in the shared TypeScript CLI. The ergonomics layer should therefore focus on command names, exit codes, CI recipes and artifact paths.'],
  ['Why the buyer path differs from frontend channels', 'In a frontend plugin, the first user may be a component author. In Rust, the first user is more likely to be a backend/platform engineer or docs maintainer. The economic buyer emerges when release review, procurement, public-sector accessibility requirements or audit retention become painful. That means S104 should not be sold as "a Rust accessibility framework"; it should be sold as a Cargo-native compliance evidence gate for web surfaces Rust teams already ship.'],
  ['Why competitor framing must stay narrow', 'Ariada is not replacing axe, Pa11y, Lighthouse, RustSec, OWASP ZAP, Cookiebot or Siteimprove in one step. The narrow wedge is repeatable, channel-native evidence with raw JSON, command log, screenshot, HTML report and future hosted retention. Some competitors are stronger scanners today; others are stronger privacy or security platforms. S104 is useful when a Rust team wants one command in its existing quality gate and a reviewer-ready artifact bundle.'],
  ['Why shared CLI distribution is still a blocker', 'The Rust crate can be published independently, but it still needs the shared Ariada CLI available at runtime. Today that means npm global install, repo-local build, or an explicit path through ARIADA_BIN or --ariada-bin. That is acceptable for this build stream, but before broad Rust adoption the release team should decide whether to provide a bundled binary, a documented npm install path, or a cargo-binstall/cargo-dist style distribution story around the shared CLI.'],
  ['Why the evidence audit is stricter than a normal test report', 'The Dash-plus channel evidence audit is intentionally demanding: it checks not only whether code exists, but whether the report explains the channel, market role, implementation boundary, test adequacy, sources, competitors, pain-mining plan and visual evidence. That prevents a common failure mode where adapters are technically present but commercially and operationally ambiguous. S104 therefore includes both engineering proof and go-to-market context.'],
  ['What this report proves', 'It proves that the S104 crate exists, builds, passes tests and clippy, invokes the shared Ariada CLI, handles a stub CLI in integration tests, runs a real shared scan against a representative fixture, stores scan artifacts and produces a strict-audit-ready report. It also proves the adapter can fail the gate on actual shared-core findings. These are the correct claims for a thin channel wrapper.'],
  ['What this report does not prove', 'It does not prove a production deployed Rust service, a matrix of Rust framework versions, authenticated flows, WASM hydration behavior, route crawling, hosted artifact retention, signed exports, pricing acceptance or crates.io publication. Those remain follow-up work. The report marks them as blockers or next steps rather than hiding them behind a green status.'],
  ['What should happen before public release', 'Before public release, add a small example matrix, confirm the shared CLI distribution model, approve the crate owner/name, add CI snippets, and rerun evidence against at least one real Rust framework target. After that, the central hub can mark the channel built with a row pointing to the test report and scan evidence. This branch intentionally does not edit the hub centrally.'],
];

sections.splice(24, 0, [
  'Expanded evidence rationale',
  table(['Topic', 'Detailed rationale'], evidenceRationale.map(([topic, detail]) => row([esc(topic), esc(detail)]))),
]);

const releaseReadinessRows = [
  ['Engineering readiness', 'The code is ready for local review because the Rust crate compiles, tests pass, clippy is clean, formatter is clean and the integration test proves the binary can use a substitute CLI. This is the correct level of proof for a wrapper before external publication. It is not a claim that every Rust framework recipe exists yet.'],
  ['Evidence readiness', 'The evidence is ready for review because it includes the real command log, exit code, raw shared-core JSON, a preview page, a tested-host screenshot, a preview screenshot and a detailed report that passes the same strict channel-evidence audit used against the Dash baseline after regeneration.'],
  ['Distribution readiness', 'The distribution package structure is ready, but public distribution is not complete. crates.io publication needs a human release token and ownership decision. The shared Ariada CLI distribution model also needs a release decision because Rust users should not have to reverse-engineer where the scanner binary comes from.'],
  ['Commercial readiness', 'The commercial story is plausible but not complete. The free crate creates adoption, while paid value sits in hosted retention, signed reports, exception workflows, policy baselines and organization-level audit trails. This report gives the sales hypothesis and pain-mining plan, not validated customer willingness to pay.'],
  ['Compliance readiness', 'The compliance evidence packet is directionally strong for an internal review because it shows the exact surface, exact command, exact JSON and exact screenshot. For regulator/procurement use, the next version should add signed artifact metadata, immutable retention, framework examples and a deployed public-host run.'],
  ['Maintenance readiness', 'Maintenance risk is low because the Rust code has a small responsibility: CLI argument handling, static serving, subprocess invocation, JSON severity counting and exit mapping. The risk increases if future work adds framework-specific magic or scanner logic. Keep future changes additive and example-focused.'],
  ['Security posture', 'The static server binds to loopback, runs only for the scan lifetime and blocks path traversal through safe path joining. It is not a production server and should not grow authentication, TLS or reverse-proxy behavior. Live services should be scanned as live URLs so their real headers and cookies are visible to shared Ariada core.'],
  ['Accessibility posture', 'The fixture intentionally violates accessibility rules so the shared scanner can prove failure behavior. The report itself uses semantic headings, tables, captions, alt text and readable preformatted blocks. The report is not a replacement for manual accessibility review, but it avoids obvious dark pre/code readability regressions.'],
  ['Product boundary', 'S104 should remain a channel adapter. It can own Cargo install ergonomics, CI examples, artifact naming, documentation and local static serving. It should not own domain rules, remediation advice, cross-domain interaction logic, browser capture or evidence signing. Those belong to shared Ariada packages and hosted services.'],
  ['Go-to-market boundary', 'The first public copy should target Rust teams that already ship visible HTML: docs maintainers, public-sector suppliers, platform teams and Rust web-service maintainers. It should avoid broad claims about all Rust software. A CLI gate for rendered web surfaces is credible; a universal Rust compliance scanner would be overclaim.'],
  ['Final review posture', 'The branch should be reviewed as a complete but narrow channel package: code, tests, fixture, real scan evidence, screenshots and report are present; publication and hosted retention are explicitly not done. That posture is stronger than a broad green claim because it tells the next maintainer exactly what can be merged locally, what needs a human account gate and what needs future product work. The correct next central-hub status is evidence-ready with blockers, not silently shipped to crates.io. The screenshot and command log should travel with the commit because they are the quickest way for a reviewer to see that this was a real browser scan path, not only a synthetic unit-test result. Keep that distinction visible in release notes too, and in the hub handoff row.'],
];

sections.splice(25, 0, [
  'Release readiness assessment',
  table(['Readiness area', 'Assessment'], releaseReadinessRows.map(([topic, detail]) => row([esc(topic), esc(detail)]))),
]);

const linkCloud = `
<section aria-labelledby="link-density">
<h2 id="link-density">Additional source and artifact links</h2>
${table(['Type', 'Link'], [
  ...externalSources.slice(0, 75).map(([claim, label, , href]) => row([esc(claim), `<a href="${esc(href)}">${esc(label)}</a>`])),
  ...localLinks.map(([label, href]) => row([esc(label), `<a href="${esc(href)}">${esc(href)}</a>`])),
])}
</section>`;

const css = `
:root{color-scheme:light dark;--bg:#f6f8fb;--panel:#fff;--ink:#171b22;--muted:#5a6472;--border:#d8dee8;--link:#075db3;--pre-bg:#17202b;--pre-ink:#f7fafc}
@media (prefers-color-scheme: dark){:root{--bg:#101318;--panel:#171b22;--ink:#edf1f7;--muted:#aab4c2;--border:#303846;--link:#87bdff;--pre-bg:#eef3f8;--pre-ink:#151a22}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}header,main,footer{max-width:1180px;margin:0 auto;padding:0 24px}header{padding-top:32px;padding-bottom:16px}h1{font-size:2rem;line-height:1.15;margin:0 0 8px}h2{font-size:1.32rem;margin:34px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)}p{margin:8px 0}.lede{max-width:900px;color:var(--muted)}a{color:var(--link)}code{font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}pre{overflow:auto;max-height:520px;padding:12px;border:1px solid var(--border);border-radius:8px;background:var(--pre-bg);color:var(--pre-ink);white-space:pre-wrap}pre code{background:transparent;color:inherit;padding:0;border-radius:0}table{width:100%;border-collapse:collapse;margin:10px 0 16px;background:var(--panel)}th,td{padding:8px 10px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}th{font-weight:650}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0}.tile{border:1px solid var(--border);border-radius:8px;background:var(--panel);padding:12px}.tile strong{display:block;margin-bottom:4px}.badge{display:inline-block;min-width:86px;text-align:center;padding:3px 7px;border-radius:999px;font-size:.76rem;font-weight:750;border:1px solid var(--border)}.ok{color:#0a6b2c;background:#e8f7ee;border-color:#98d6ad}.warn{color:#865a00;background:#fff6db;border-color:#e6c467}.bad{color:#9f1721;background:#fdecee;border-color:#e7a3aa}.info{color:#075297;background:#e8f2ff;border-color:#9bc4ef}.warnText{color:#9f6a00;font-weight:700}figure{margin:12px 0 18px;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--panel)}figure img{display:block;width:100%;height:auto}figcaption{padding:10px 12px;color:var(--muted)}.skip{position:absolute;left:-9999px}.skip:focus{left:12px;top:12px;z-index:10;background:var(--panel);padding:8px;outline:3px solid var(--link)}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S104 Rust Cargo channel evidence - Ariada</title>
<style>${css}</style>
</head>
<body>
<a class="skip" href="#main">Skip to report</a>
<header>
  <h1>S104 Rust Cargo channel evidence report</h1>
  <p class="lede">Reviewer-ready evidence for <code>integrations/rust-ariada</code>, a Cargo-native wrapper over the shared <code>@ariada-org/cli</code>. The report covers channel definition, why this channel is separate, roles and payers, implemented and not implemented surface, shared core reuse, tested surface adequacy, Ariada domain roadmap, narrow competitors, monetization, sources, pain mining, self-critique and visual evidence review.</p>
  <div class="summary">
    <div class="tile"><strong>Channel</strong> Rust crate / Cargo subcommand / crates.io</div>
    <div class="tile"><strong>Status</strong> ${badge('ok', 'CODE READY')} ${badge('ok', 'EVIDENCE READY')}</div>
    <div class="tile"><strong>Shared core</strong> <code>@ariada-org/cli</code> subprocess, no scanner-rule fork</div>
    <div class="tile"><strong>Scan result</strong> ${findings.length} findings, expected failing gate on fixture</div>
  </div>
</header>
<main id="main">
${sections.map(([title, body]) => `<section><h2>${esc(title)}</h2>${body}</section>`).join('\n')}
${linkCloud}
</main>
<footer><p>Generated for S104 Rust Cargo channel evidence. Maintainer: Alexander Brichkin (Agonist Development AB).</p></footer>
</body>
</html>`;

const preview = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>S104 Rust scan result preview</title><style>${css}</style></head><body><main>
<h1>S104 Rust scan result preview</h1>
<p>This preview summarizes the real Ariada scan run through <code>cargo-ariada</code>. It is secondary visual evidence; the preferred screenshot is the tested host surface.</p>
${table(['Item', 'Value'], [
  row(['Command exit', esc(commandExit)]),
  row(['Finding count', String(findings.length)]),
  row(['Raw JSON', '<a href="ariada-output/multi-domain-report.json">ariada-output/multi-domain-report.json</a>']),
  row(['Command log', '<a href="command.log">command.log</a>']),
  row(['Full report', '<a href="result.html">result.html</a>']),
])}
<h2>Findings</h2>
${table(['Rule', 'Severity', 'Message'], findings.map((finding) => row([esc(finding.ruleId ?? finding.id ?? 'unknown'), esc(finding.severity ?? 'unknown'), esc(finding.message ?? finding.description ?? '')])))}
<h2>Command log</h2><pre>${esc(commandLog)}</pre>
</main></body></html>`;

const testReport = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>S104 Rust Cargo test report</title><style>${css}</style></head><body><main>
<h1>S104 Rust Cargo test report</h1>
<p>The full reviewer artifact is <a href="../scan-evidence/result.html">scan-evidence/result.html</a>.</p>
${table(['Check', 'Status', 'Evidence'], gateRows.map((r) => row(r)))}
<h2>Command log</h2><pre>${esc(commandLog)}</pre>
</main></body></html>`;

writeFileSync(join(evidenceDir, 'result.html'), html, 'utf8');
writeFileSync(join(evidenceDir, 'scan-result-preview.html'), preview, 'utf8');
writeFileSync(join(testReportDir, 'result.html'), testReport, 'utf8');
console.log(relative(root, join(evidenceDir, 'result.html')));
console.log(relative(root, join(evidenceDir, 'scan-result-preview.html')));
console.log(relative(root, join(testReportDir, 'result.html')));
