#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const integration = dirname(scriptDir);
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
const readIfExists = (path, fallback = '') => (existsSync(path) ? readFileSync(path, 'utf8') : fallback);
const imageBase64 = (path) => (existsSync(path) ? readFileSync(path).toString('base64') : '');
const rawReport = readIfExists(join(outputDir, 'multi-domain-report.json'), '{}');
const commandLog = readIfExists(join(evidenceDir, 'command.log'), 'Command not run in this environment.').replace(/[ \t]+$/gm, '');
const commandExit = readIfExists(join(evidenceDir, 'command.exit'), 'unknown').trim();
const testedHostPng = imageBase64(join(screenshotDir, 'tested-host-surface.png'));
const scanResultPng = imageBase64(join(screenshotDir, 'scan-result.png'));
let parsedReport = {};
try {
  parsedReport = JSON.parse(rawReport);
} catch {
  parsedReport = {};
}
const findings = Object.values(parsedReport.grid ?? {}).flatMap((byDomain) => Object.values(byDomain ?? {})).flat();

const badge = (kind, label) => `<span class="badge ${kind}">${esc(label)}</span>`;
const row = (cells) => `<tr>${cells.map((cell, index) => `<${index === 0 ? 'th scope="row"' : 'td'}>${cell}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`;
const table = (headers, rows) => `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('\n')}</tbody></table>`;
const link = (label, href) => `<a href="${esc(href)}">${esc(label)}</a>`;
const linkTableRows = (items) => items.map(([label, owner, kind, href]) => row([esc(label), esc(owner), esc(kind), link(href, href)]));

const localLinks = [
  ['README', '../README.md'], ['pubspec.yaml', '../pubspec.yaml'], ['analysis options', '../analysis_options.yaml'],
  ['Dart entrypoint', '../bin/scan.dart'], ['public library export', '../lib/ariada.dart'],
  ['report parser', '../lib/src/report.dart'], ['runner wrapper', '../lib/src/runner.dart'],
  ['parser tests', '../test/report_test.dart'], ['runner tests', '../test/runner_test.dart'],
  ['HTML renderer fixture', '../fixtures/flutter-web-html-renderer/build/web/index.html'],
  ['CanvasKit caveat fixture', '../fixtures/flutter-web-canvaskit/build/web/index.html'],
  ['raw scan JSON', 'ariada-output/multi-domain-report.json'], ['command log', 'command.log'],
  ['command exit', 'command.exit'], ['tested host screenshot', 'screenshots/tested-host-surface.png'],
  ['scan result screenshot', 'screenshots/scan-result.png'], ['scan preview', 'scan-result-preview.html'],
  ['test report', '../test-report/result.html'], ['S106 handoff spec', '../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack11.md'],
  ['CODEX handoff', '../../../CODEX_HANDOFF.md'], ['project handoff', '../../../HANDOFF.md'], ['open questions', '../../../OPEN_QUESTIONS.md'],
  ['Ariada CLI package', '../../../packages/ariada-cli/package.json'], ['Ariada CLI bin', '../../../packages/ariada-cli/src/bin.ts'],
  ['Core engine package', '../../../packages/core-engine/package.json'], ['Core browser package', '../../../packages/core-browser/package.json'],
  ['Core Playwright package', '../../../packages/core-playwright/package.json'], ['WCAG extended rules', '../../../packages/wcag-rules-extended/package.json'],
  ['Multi-domain package', '../../../packages/ariada-multi-domain/package.json'], ['Domains fixture index', '../../../packages/ariada-test-fixtures/fixtures/domains/domains-index.json'],
  ['Platform spec', '../../../docs/PLATFORM_SPEC.md'], ['Multi-domain standards mapping', '../../../product/standards/MULTI_DOMAIN_STANDARDS_MAPPING.md'],
  ['CLI PRD', '../../../product/plans/2026-05-19-prd-ariada-cli.md'], ['testing strategy', '../../../product/plans/2026-05-19-prd-testing-strategy-v0.2-addendum.md'],
  ['accessibility domain PRD', '../../../product/plans/2026-06-03-P1-domain-accessibility.md'], ['privacy domain PRD', '../../../product/plans/2026-06-03-P2-domain-privacy.md'],
  ['security domain PRD', '../../../product/plans/2026-06-03-P3-domain-security.md'], ['AI readiness PRD', '../../../product/plans/2026-06-03-P4-domain-ai-readiness.md'],
  ['structured data PRD', '../../../product/plans/2026-06-03-P5-domain-structured-data.md'], ['sustainability PRD', '../../../product/plans/2026-06-03-P6-domain-sustainability.md'],
  ['Dash baseline', '../../../../adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html'],
  ['human authorship policy', '../../../legal/HUMAN_AUTHORSHIP_POLICY.md'],
  ['pre-push discipline', '../../../.claude/rules/pre-push-verification-discipline.md'], ['commit size budget', '../../../.claude/rules/commit-size-budget.md'],
  ['security policy', '../../../.claude/rules/security-policy.md'], ['delivery queue plan', '../../../product/plans/2026-06-23-codex-multiday-work-queue.md'],
  ['review evidence reporting skill', '../../../.agents/skills/review-evidence-reporting/SKILL.md'],
];

const externalSources = [
  ['Flutter web renderers', 'Flutter docs', 'official primary', 'https://docs.flutter.dev/platform-integration/web/renderers'],
  ['Flutter web accessibility', 'Flutter docs', 'official primary', 'https://docs.flutter.dev/ui/accessibility/web-accessibility'],
  ['Flutter accessibility overview', 'Flutter docs', 'official primary', 'https://docs.flutter.dev/ui/accessibility'],
  ['Flutter accessibility testing', 'Flutter docs', 'official primary', 'https://docs.flutter.dev/testing/accessibility'],
  ['Dart package layout', 'Dart docs', 'official primary', 'https://dart.dev/tools/pub/package-layout'],
  ['Dart publishing packages', 'Dart docs', 'official primary', 'https://dart.dev/tools/pub/publishing'],
  ['pub.dev publishing help', 'pub.dev', 'official primary', 'https://pub.dev/help/publishing'],
  ['Dart verified publishers', 'Dart docs', 'official primary', 'https://dart.dev/tools/pub/verified-publishers'],
  ['Dart pub global', 'Dart docs', 'official primary', 'https://dart.dev/tools/pub/cmd/pub-global'],
  ['Dart testing', 'Dart docs', 'official primary', 'https://dart.dev/tools/testing'],
  ['dart test command', 'Dart docs', 'official primary', 'https://dart.dev/tools/dart-test'],
  ['Dart analysis options', 'Dart docs', 'official primary', 'https://dart.dev/tools/analysis'],
  ['package:test', 'pub.dev', 'registry primary', 'https://pub.dev/packages/test'],
  ['package:lints', 'pub.dev', 'registry primary', 'https://pub.dev/packages/lints'],
  ['package:flutter_lints', 'pub.dev', 'registry primary', 'https://pub.dev/packages/flutter_lints'],
  ['Flutter web renderer removal issue', 'Flutter GitHub', 'community/project issue', 'https://github.com/flutter/flutter/issues/145954'],
  ['Flutter web classes/testID issue', 'Flutter GitHub', 'community/project issue', 'https://github.com/flutter/flutter/issues/97455'],
  ['Flutter CanvasKit offline issue', 'Flutter GitHub', 'community/project issue', 'https://github.com/flutter/flutter/issues/85624'],
  ['Flutter CanvasKit iOS issue', 'Flutter GitHub', 'community/project issue', 'https://github.com/flutter/flutter/issues/91414'],
  ['CanvasKit mobile stretch issue', 'Flutter GitHub', 'community/project issue', 'https://github.com/flutter/flutter/issues/159974'],
  ['HTML renderer announcement', 'flutter-announce', 'official/community', 'https://groups.google.com/g/flutter-announce/c/JqkMe7cPkQo'],
  ['Flutter web accessibility article', 'Flutter blog', 'official secondary', 'https://blog.flutter.dev/accessibility-in-flutter-on-the-web-51bfc558b7d3'],
  ['Flutter web renderer Reddit 1', 'Reddit r/FlutterDev', 'community discussion', 'https://www.reddit.com/r/FlutterDev/comments/10ix09l/flutter_web_canvaskit_or_html_renderer/'],
  ['Flutter web renderer Reddit 2', 'Reddit r/FlutterDev', 'community discussion', 'https://www.reddit.com/r/FlutterDev/comments/1329g4g/do_you_use_flutter_web_do_you_explicitly_set/'],
  ['Flutter web milestones Reddit', 'Reddit r/FlutterDev', 'community discussion', 'https://www.reddit.com/r/FlutterDev/comments/1c9x03h/what_is_the_major_milestones_that_flutter_web/'],
  ['Publishing Flutter package Reddit', 'Reddit r/FlutterDev', 'community discussion', 'https://www.reddit.com/r/FlutterDev/comments/1p0edm7/i_wrote_a_stepbystep_guide_on_how_to_publish_a/'],
  ['CanvasKit Stack Overflow tag', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/tagged/canvaskit'],
  ['Flutter web accessibility Semantics', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/67931553/using-semantics-widget-in-flutter-web'],
  ['CanvasKit folder question', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/71221004/is-folder-canvaskit-part-of-the-output-of-the-flutter-web'],
  ['Flutter web CanvasKit on iOS', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/69073328/flutter-web-with-canvaskit-on-ios-15-beta'],
  ['How to use CanvasKit', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/64583461/how-to-use-skia-canvaskit-in-flutter-web'],
  ['HN Flutter web discussion', 'Hacker News', 'community discussion', 'https://news.ycombinator.com/item?id=26333239'],
  ['Flutter Cypress guide', 'Autonoma', 'community/vendor article', 'https://getautonoma.com/blog/flutter-cypress-testing-guide'],
  ['Practical Flutter accessibility', 'DCM', 'community/vendor article', 'https://dcm.dev/blog/2025/06/30/accessibility-flutter-practical-tips-tools-code-youll-actually-use/'],
  ['Flutter static analysis guide', 'DCM', 'community/vendor article', 'https://dcm.dev/blog/2025/10/21/getting-started-flutter-static-analytics-lints/'],
  ['FlutterFlow accessibility docs', 'FlutterFlow', 'vendor docs', 'https://docs.flutterflow.io/concepts/accessibility/'],
  ['Very Good Ventures accessibility', 'Very Good Ventures', 'community/vendor article', 'https://verygood.ventures/blog/exploring-accessibility-and-digital-inclusion-with-flutter/'],
  ['Pub package executable Q&A', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/77553247/how-to-create-a-executable-script-on-my-flutter-package'],
  ['Pub documentation after publishing', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/74910555/can-i-edit-package-documentation-on-pub-dev-after-publishing'],
  ['Dart unit test Q&A', 'Stack Overflow', 'community Q&A', 'https://stackoverflow.com/questions/59812714/running-all-unit-tests-in-dart'],
  ['Dart test GitHub', 'GitHub', 'project source', 'https://github.com/dart-lang/test'],
  ['Dart pub binary issue', 'GitHub dart-lang/pub', 'project issue', 'https://github.com/dart-lang/pub/issues/407'],
  ['dart-lang ecosystem lints', 'GitHub', 'project source', 'https://github.com/dart-lang/ecosystem/blob/main/pkgs/dart_flutter_team_lints/lib/analysis_options.yaml'],
  ['pub.dev homepage', 'pub.dev', 'registry primary', 'https://pub.dev/'],
  ['axe platform', 'Deque', 'vendor primary', 'https://www.deque.com/axe/'],
  ['axe-core repository', 'GitHub', 'vendor source', 'https://github.com/dequelabs/axe-core'],
  ['axe DevTools CLI', 'Deque docs', 'vendor primary', 'https://docs.deque.com/devtools-for-web/4/en/cli-home/'],
  ['axe rules', 'Deque University', 'vendor primary', 'https://dequeuniversity.com/rules/axe/html'],
  ['@axe-core/cli', 'npm', 'registry primary', 'https://www.npmjs.com/package/@axe-core/cli'],
  ['Pa11y home', 'Pa11y', 'project primary', 'https://pa11y.org/'],
  ['Pa11y repository', 'GitHub', 'project source', 'https://github.com/pa11y/pa11y'],
  ['Pa11y CI', 'GitHub', 'project source', 'https://github.com/pa11y/pa11y-ci'],
  ['Lighthouse CI', 'GitHub', 'project source', 'https://github.com/GoogleChrome/lighthouse-ci'],
  ['Lighthouse accessibility', 'Chrome docs', 'vendor primary', 'https://developer.chrome.com/docs/lighthouse/accessibility/'],
  ['WAVE', 'WebAIM', 'vendor primary', 'https://wave.webaim.org/'],
  ['BrowserStack accessibility testing', 'BrowserStack', 'vendor primary', 'https://www.browserstack.com/accessibility-testing'],
  ['LambdaTest accessibility testing', 'LambdaTest', 'vendor primary', 'https://www.lambdatest.com/accessibility-testing'],
  ['Siteimprove accessibility', 'Siteimprove', 'vendor primary', 'https://www.siteimprove.com/solutions/accessibility/'],
  ['AudioEye', 'AudioEye', 'vendor primary', 'https://www.audioeye.com/'],
  ['Evinced', 'Evinced', 'vendor primary', 'https://www.evinced.com/'],
  ['Level Access', 'Level Access', 'vendor primary', 'https://www.levelaccess.com/'],
  ['Equalize Digital checker', 'Equalize Digital', 'vendor primary', 'https://equalizedigital.com/accessibility-checker/'],
  ['OWASP ZAP', 'OWASP', 'project primary', 'https://www.zaproxy.org/'],
  ['SecurityHeaders', 'SecurityHeaders', 'tool primary', 'https://securityheaders.com/'],
  ['Mozilla Observatory', 'Mozilla', 'tool primary', 'https://observatory.mozilla.org/'],
  ['Cookiebot', 'Usercentrics', 'vendor primary', 'https://www.cookiebot.com/'],
  ['OneTrust', 'OneTrust', 'vendor primary', 'https://www.onetrust.com/'],
  ['Website Carbon', 'Wholegrain Digital', 'tool primary', 'https://www.websitecarbon.com/'],
  ['Ecograder', 'Mightybytes', 'tool primary', 'https://ecograder.com/'],
  ['Google Rich Results Test', 'Google Search Central', 'vendor primary', 'https://search.google.com/test/rich-results'],
  ['Schema.org validator', 'Schema.org', 'tool primary', 'https://validator.schema.org/'],
  ['W3C Nu Checker', 'W3C', 'primary standards tool', 'https://validator.w3.org/nu/'],
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
  ['GitHub Actions artifacts', 'GitHub Docs', 'vendor primary', 'https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts'],
  ['GitLab job artifacts', 'GitLab Docs', 'vendor primary', 'https://docs.gitlab.com/ci/jobs/job_artifacts/'],
  ['OpenSSF Scorecard', 'OpenSSF', 'project primary', 'https://securityscorecards.dev/'],
  ['SLSA framework', 'SLSA', 'project primary', 'https://slsa.dev/'],
  ['Sigstore', 'Sigstore', 'project primary', 'https://www.sigstore.dev/'],
];

const roles = [
  ['Flutter web developer', 'Runs one Dart-shaped command after `flutter build web`, without learning scanner internals.', 'Usually not payer; creates the adoption pull by proving fixture and CI usefulness.', 'Local release check or CI job for public Flutter web bundles.', 'MVP bridge implemented; real Flutter SDK run is host-blocked here.'],
  ['Mobile-first Flutter team lead', 'Learns when web accessibility evidence is feasible and when CanvasKit output limits DOM scanning.', 'Influences platform budget; buys only when web becomes customer-facing.', 'Before converting an internal Flutter app into a public web surface.', 'Caveat documented; native Flutter semantics checks are not implemented here.'],
  ['Platform or CI owner', 'Gets repeatable JSON/log/screenshot/HTML artifacts with standard exit codes.', 'Pays from platform/tooling budget once evidence becomes a release gate.', 'Pre-merge, nightly, or release artifact generation.', 'Wrapper contract exists; reusable GitHub Action/Docker path remains next work.'],
  ['Accessibility reviewer', 'Receives direct fixture screenshot, raw JSON, command log, and report instead of a screenshot-only claim.', 'Influences compliance purchase and remediation priority.', 'Review of EAA/WCAG evidence for a Flutter web release.', 'Evidence path implemented against representative fixture; real app proof pending Flutter SDK.'],
  ['Security or compliance owner', 'Can later combine accessibility, privacy/GDPR, security, performance, sustainability and AI/compliance evidence.', 'Enterprise compliance/legal budget when retained evidence is required.', 'Procurement, regulated release, or supplier acceptance.', 'Accessibility evidence exists; multi-domain hosted retention is not implemented.'],
  ['Public-sector supplier', 'Needs EN 301 549/EAA evidence when a Flutter web bundle is delivered as a public service.', 'Project or contract budget.', 'Before acceptance testing or remedial sign-off.', 'Local evidence bundle is available; signed exports and audit retention are future paid layer.'],
];

const cultureRows = [
  ['Fast local/dev loop', 'Dart teams accept `dart format`, `dart analyze`, `dart test`, `flutter test`, package lints, and small explicit `dart run` tools. Ariada belongs as an explicit scan command, not hidden inside unit tests.'],
  ['CI/release loop', 'Browser-driven DOM scans, Node-based shared CLI setup, screenshot capture, and retained artifacts are acceptable in CI, nightly, release, and compliance workflows.'],
  ['Rejected pattern', 'A surprise browser/Node scan inside every Flutter widget test would feel foreign and slow. CanvasKit output also makes conventional DOM checks incomplete.'],
  ['Packaging expectation', 'pub.dev package, `bin/scan.dart`, `executables: scan`, `dart run ariada:scan`, optional `dart pub global activate`, and copy-paste CI examples.'],
  ['Foreign dependency', 'The scanner remains the shared `@ariada-org/cli`, currently distributed via Node/npm. This Dart package is not a native scanner and should not claim to be one.'],
  ['Workflow placement', 'Best placement is after `flutter build web`, in pre-merge CI, nightly evidence, release gates, procurement packets, and hosted fleet scans.'],
];

const solutionRows = [
  ['Primary entrypoint', '`dart run ariada:scan --static-dir build/web` after a Flutter web build. It is explicit, pub.dev-shaped, and easy to add to CI.'],
  ['Fallback entrypoint', 'Reusable GitHub Action or Docker image that installs Dart/Flutter, shared Ariada CLI, browser runtime, and uploads artifacts.'],
  ['Free/open-source layer', 'Thin Dart wrapper, fixture, parser tests, artifact convention, and report generator.'],
  ['Paid/hosted layer', 'Retained evidence, signed exports, baseline policies, exception workflow, team dashboards, and domain packs.'],
  ['What developers should not own', 'Do not make each Flutter team hand-assemble Playwright caches, npm global installs, screenshot validation, evidence signing, or archival retention.'],
  ['Next idiomatic version', 'A verified pub.dev package, Action/Docker recipe, Flutter SDK example app, HTML-renderer guidance, and hosted upload path.'],
];

const implementedRows = [
  ['pub package skeleton', badge('ok', 'IMPLEMENTED'), '`pubspec.yaml` defines a Dart package, executable `scan`, metadata, lints, args/path dependencies, and test dependency.'],
  ['Dart entrypoint', badge('ok', 'IMPLEMENTED'), '`bin/scan.dart` parses `--url`, `--static-dir`, `--domains`, `--severity-threshold`, `--output-dir`, and `--ariada-bin`.'],
  ['Shared CLI invocation', badge('ok', 'IMPLEMENTED'), '`Process.run` invokes `@ariada-org/cli` via `ariada` or `ARIADA_BIN`. No scanner rule is implemented in Dart.'],
  ['JSON parser', badge('ok', 'IMPLEMENTED'), '`MultiDomainReport` reads Ariada `grid` output and counts findings at or above the configured threshold.'],
  ['Static-dir bridge', badge('ok', 'IMPLEMENTED'), 'The wrapper can serve `build/web` on loopback and pass the generated URL to the shared CLI.'],
  ['Representative HTML fixture', badge('ok', 'IMPLEMENTED'), 'Fixture models a DOM-scannable Flutter web HTML-renderer output with known defects.'],
  ['CanvasKit caveat fixture', badge('ok', 'IMPLEMENTED'), 'Second fixture documents a canvas-heavy output shape where DOM scanners have limited signal.'],
  ['Unit tests', badge('warn', 'WRITTEN, HOST-BLOCKED'), '`test/report_test.dart` and `test/runner_test.dart` cover parsing and stub CLI contract, but Dart is not installed here.'],
  ['Dart analyze/format/pub dry-run', badge('warn', 'HOST BLOCKER'), 'Blocked because neither `dart` nor `flutter` exists on this workstation path.'],
  ['Real Flutter build', badge('warn', 'HOST BLOCKER'), 'Blocked by missing Flutter SDK and renderer-specific build support. The fixture proves evidence shape, not full Flutter runtime coverage.'],
  ['pub.dev publication', badge('warn', 'HUMAN BLOCKER'), 'Requires Google account, verified publisher, final package-name decision, and release credentials.'],
  ['Hosted retention and signing', badge('info', 'NOT IMPLEMENTED'), 'Local artifacts are generated; paid signed exports and retention belong to hosted Ariada.'],
  ['Scanner rules', badge('info', 'NOT IMPLEMENTED HERE'), 'Accessibility, security, privacy/GDPR, performance, reliability, sustainability, SEO/AIEO/GEO, legal notices, localization/i18n, data provenance, and AI/compliance rules remain in shared Ariada domains.'],
];

const domainRows = [
  ['Accessibility', 'implemented for fixture', 'Current evidence uses missing image alt, missing input label, unnamed button, and missing accessibility-statement link. Flutter semantics can expose accessible DOM, but CanvasKit/Skwasm shapes require caution.'],
  ['Security', 'planned', 'Flutter web releases still need CSP, security headers, dependency and third-party script posture. Ariada should pass the shared security domain through, not implement it in Dart.'],
  ['Privacy/GDPR', 'planned', 'Cookie notices, analytics tags, consent links, and data minimization claims belong in shared privacy checks. Flutter teams often embed analytics SDKs at the web shell.'],
  ['Performance', 'planned', 'Flutter web payload size, CanvasKit assets, WebAssembly, and initial render timing are key buying hooks. Use shared performance domain when D07 matures.'],
  ['Reliability', 'planned', 'Release evidence should include route availability, blank-screen risk, asset load failure, and broken link checks for web bundles.'],
  ['Sustainability', 'planned', 'Flutter web can ship large binary/runtime assets. Domain should measure transfer size and third-party cost via shared Ariada logic.'],
  ['SEO/AIEO/GEO', 'planned', 'Canvas-heavy output can be weak for public search and AI citation. HTML shell metadata, structured content, and crawlability must be tested separately.'],
  ['Legal notices', 'planned', 'Footer links for accessibility statement, privacy policy, imprint/legal notice, and terms are important for EU public websites and procurement review.'],
  ['Localization/i18n', 'planned', 'Flutter apps need `lang`, translated labels, locale-specific legal notices, and bidirectional text checks.'],
  ['Data provenance', 'planned', 'Useful when Flutter web surfaces dashboards, datasets, or generated content that need source lineage.'],
  ['AI/compliance', 'planned', 'Future checks can verify AI disclosure, EU AI Act notices, and generated-content transparency where relevant.'],
  ['Native Flutter semantics', 'blocked', 'Ariada does not inspect Flutter widget trees or semantics tests today; this would require a separate Flutter-native plugin path.'],
];

const competitors = [
  ['axe / axe DevTools CLI', 'Strong browser accessibility engine and commercial reporting.', 'Ariada should not claim stronger raw accessibility maturity; the wedge is Flutter-web evidence packaging plus multi-domain roadmap.'],
  ['Pa11y / Pa11y CI', 'OSS command-line accessibility scans for web pages.', 'Ariada differentiates by retaining screenshot/log/raw JSON/report bundles and expanding beyond accessibility.'],
  ['Lighthouse CI', 'Performance/accessibility/SEO scan in CI.', 'Flutter teams may already accept it in release workflows. Ariada should complement with EAA-oriented evidence and domain-specific policy.'],
  ['Flutter built-in semantics and tests', 'Native widget/semantics checks before rendering to web.', 'Ariada complements them by scanning the built surface and producing external evidence.'],
  ['Cypress/Playwright visual and E2E tests', 'Common for web interaction proof, including Flutter web workarounds.', 'Ariada can reuse their CI placement but focuses on compliance evidence.'],
  ['Deque/Siteimprove/Evinced/Level Access', 'Enterprise accessibility governance.', 'Ariada is lighter and channel-specific now; paid hosted retention is the enterprise path.'],
  ['BrowserStack/LambdaTest accessibility', 'Cloud testing and accessibility products.', 'Ariada should compete on open adapter plus evidence retention, not broad device cloud coverage.'],
  ['SecurityHeaders/Observatory/ZAP', 'Security posture tools.', 'They are adjacent; Ariada security domain should aggregate release evidence, not replace specialist testing.'],
  ['Cookiebot/OneTrust', 'Consent/privacy management.', 'Ariada can detect and retain evidence; it does not replace consent operations.'],
  ['Website Carbon/Ecograder', 'Sustainability scoring.', 'Ariada can bring sustainability into the same release packet as accessibility and legal evidence.'],
  ['Google Rich Results/Schema validator', 'Structured-data and SEO validators.', 'Ariada can retain and compare results for Flutter shells and public pages.'],
  ['Manual audit consultancies', 'Human review and remediation.', 'Ariada does not replace humans; it sells repeatable evidence and triage packets.'],
];

const communitySignals = [
  ['Flutter GitHub issues', 'Developer/maintainer', 'Renderer transitions, test selectors, CanvasKit behavior, and accessibility surface limitations appear repeatedly.', 'Strong: product must label S106 as MVP bridge and avoid native-scanner claims.'],
  ['Reddit r/FlutterDev', 'Developer/team lead', 'Renderer choice, production readiness, and accessibility concerns recur in peer discussion.', 'Medium: useful pain language, not market proof.'],
  ['Stack Overflow', 'Developer', 'CanvasKit deployment, Semantics widget confusion, executable package questions, and test running questions appear as implementation pain.', 'Medium: confirms docs and examples must be explicit.'],
  ['Hacker News', 'Developer/architect', 'Flutter web debates emphasize web-native expectations, DOM/canvas tradeoffs, and production skepticism.', 'Weak-to-medium: broad sentiment, useful for positioning.'],
  ['pub.dev and Dart docs', 'Maintainer/release owner', 'Verified publisher, package layout, executable scripts, lints, tests, and publishing are the idiomatic distribution path.', 'Strong for packaging, not community pain.'],
  ['FlutterFlow docs/community', 'No-code/platform owner', 'Accessibility surfaces also matter for Flutter-derived web tools.', 'Weak: adjacent channel, useful for future hosted scan onboarding.'],
  ['Vendor blogs and guides', 'Consultant/developer advocate', 'Flutter web testing and accessibility guides emphasize semantics, selectors, and CI setup.', 'Medium: helps write onboarding copy.'],
  ['No-signal searches', 'Buyer/compliance owner', 'G2/Capterra/Product Hunt did not provide channel-specific Flutter web accessibility package buying evidence.', 'Documented weak signal; prefer GitHub/Reddit/Stack Overflow.'],
  ['Search query', 'Research method', '“Flutter web accessibility CanvasKit HTML renderer semantics GitHub issue”.', 'Returned official docs, GitHub issues, Reddit, Stack Overflow, and vendor guides.'],
  ['Search query', 'Research method', '“pub.dev publishing verified publisher Dart executable package”.', 'Returned Dart docs, pub.dev help, Stack Overflow package executable questions.'],
  ['Search query', 'Research method', '“Flutter web accessibility Semantics screen reader DOM”.', 'Returned official accessibility docs and community implementation questions.'],
  ['Search query', 'Research method', '“Flutter web CanvasKit SEO accessibility production readiness”.', 'Returned HN/Reddit/blog signals about public web fit.'],
];

const repeatedPatterns = [
  ['Canvas versus DOM', 'Flutter docs, GitHub issues, Reddit, Stack Overflow and HN all surface the renderer split. S106 must classify evidence by rendered host surface, not by Flutter source alone.'],
  ['Testing selectors and semantics friction', 'GitHub issue #97455, Stack Overflow Semantics questions, and Cypress/Playwright guides show that web testing can be awkward; Ariada should not hide setup.'],
  ['Publishing trust', 'Dart docs, pub.dev help, verified publisher docs and Reddit publishing threads point to verified publisher/domain trust as a release blocker.'],
  ['Performance and payload concerns', 'Renderer docs, community threads, Lighthouse competitors and sustainability sources all point to payload/performance as a future domain hook.'],
  ['Compliance buyer absent from community threads', 'Most public signals are developers; buyer demand must be validated by interviews with platform/compliance owners.'],
];

const monetizationRows = [
  ['Free adapter', 'Keep pub.dev package free to seed Flutter web adoption and avoid charging for a thin wrapper.'],
  ['Paid team dashboard', 'Charge for retained evidence, dashboards, baselines, waivers, SLA history, and multi-domain trend views.'],
  ['Signed exports', 'Sell procurement-ready signed HTML/PDF/JSON evidence bundles for public-sector and enterprise acceptance.'],
  ['Domain packs', 'Charge for privacy/GDPR, security, performance, sustainability, SEO/AIEO/GEO, legal notices, localization/i18n, data provenance, and AI/compliance packs as they mature.'],
  ['Hosted worker', 'Hide Dart/Flutter/Node/browser setup in a hosted or CI runner so developers do not own brittle runtime plumbing.'],
  ['Competitor comparison', 'Deque/Siteimprove/Evinced sell governance; BrowserStack/LambdaTest sell cloud testing; Ariada starts as open evidence adapter then monetizes retention and compliance workflow.'],
];

function sourceParagraphs() {
  return `
    <p>What is Flutter web? Flutter web is the browser-targeted deployment mode for Flutter applications. For Ariada it is not simply “another Dart app”: the scannable surface is the generated web output after Flutter rendering choices, semantics, assets, and shell HTML have been applied.</p>
    <p>Why this is a separate Ariada channel: pub.dev is the normal package distribution route for Dart and Flutter developers, and <code>dart run package:executable</code> is a recognizable way to add explicit tooling. Flutter web also has a unique accessibility problem: some output can expose a semantics-backed DOM, while canvas-heavy rendering can make conventional DOM scanners less complete.</p>
    <p>Source reliability: official Dart, Flutter, W3C, EU, pub.dev and standards pages are high-reliability primary or standards sources. GitHub issues, Reddit, Stack Overflow and Hacker News are community-review evidence only: they identify pain language and repeated objections, not market-size proof or legal truth.</p>
  `;
}

function section(title, body) {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

function narrativeBlock(title, text) {
  return section(title, `<p>${esc(text)}</p>${table(['Decision', 'Implication'], [
    row(['Channel status', 'MVP bridge for Flutter web evidence, not a native Flutter scanner.']),
    row(['Scanner boundary', 'All scanning stays in shared Ariada CLI/core packages.']),
    row(['Host caveat', 'No Dart/Flutter SDK on this workstation; source and fixture are prepared, runtime gates documented as blocked.']),
  ])}`);
}

const sections = [
  section('What is Flutter web?', sourceParagraphs()),
  section('Why this is a separate Ariada channel', `<p>Flutter web deserves its own channel because Dart/Flutter teams discover tools through pub.dev and expect Dart-shaped commands. The audience is smaller than raw Flutter adoption: only Flutter web outputs with useful web semantics can be meaningfully scanned by a DOM-oriented Ariada run.</p>${table(['Reason', 'S106 answer'], [
    row(['pub.dev distribution', 'Package exposes <code>dart run ariada:scan</code>, matching the S106 handoff contract.']),
    row(['Flutter renderer split', 'Report explicitly distinguishes HTML/semantic output from CanvasKit/Skwasm-heavy output.']),
    row(['Compliance evidence', 'Ariada artifacts attach to built web output, not mobile widget source.']),
  ])}`),
  section('Channel culture fit', table(['Expectation', 'S106 fit'], cultureRows.map(([a, b]) => row([esc(a), esc(b)])))),
  section('Recommended product solution', table(['Layer', 'Decision'], solutionRows.map(([a, b]) => row([esc(a), esc(b)])))),
  section('Roles: who pays / what value they buy', `<p>The exact mandated table follows. It maps hooks, payer, buying moment, and implementation state.</p>`),
  section('Кому что продаем: роли, hooks, кто платит и что уже готово', table(['Role', 'Hook', 'Who pays', 'Buying moment', 'Implemented state'], roles.map((r) => row(r.map(esc))))),
  section('Implemented vs not implemented', table(['Capability', 'Status', 'Evidence'], implementedRows.map(([a, b, c]) => row([esc(a), b, c])))),
  section('Ariada core used', `<p>The Dart code invokes the shared CLI and parses the shared report format. It does not implement WCAG checks, browser automation, privacy detection, security checks, performance scoring, sustainability scoring, SEO/AIEO/GEO analysis, legal notice checks, localization checks, data-provenance checks, or AI/compliance checks.</p>${table(['Connector', 'Status'], [
    row(['<code>@ariada-org/cli</code>', 'External scanner executable invoked by Dart wrapper.']),
    row(['<code>multi-domain-report.json</code>', 'Shared JSON contract parsed by Dart wrapper.']),
    row(['Ariada domain packages', 'Used only through CLI output.']),
  ])}`),
  section('Technical connectors', table(['Connector', 'Current path'], [
    row(['Dart pub executable', '<code>pubspec.yaml</code> + <code>bin/scan.dart</code>']),
    row(['Flutter web static output', '<code>--static-dir build/web</code> loopback server']),
    row(['Live URL', '<code>--url http://127.0.0.1:8080/</code>']),
    row(['Shared CLI override', '<code>ARIADA_BIN</code> or <code>--ariada-bin</code>']),
    row(['CI artifacts', '<code>scan-evidence/ariada-output</code>, command log, screenshots, HTML report']),
    row(['Future GitHub Action', 'Should install Dart/Flutter, Node CLI, browser runtime, then upload artifacts.']),
  ])),
  section('Tested surface', `<p>The tested host surface screenshot is the representative Flutter web/static output fixture. The scan-result preview screenshot is a rendered evidence summary. A report-only screenshot would be supplemental only; it is not used as the sole visual evidence.</p>${table(['Screenshot', 'Classification', 'Adequacy'], [
    row([link('tested-host-surface.png', 'screenshots/tested-host-surface.png'), 'tested host surface', 'Primary visual evidence; shows the HTML fixture that the scan evidence represents.']),
    row([link('scan-result.png', 'screenshots/scan-result.png'), 'scan-result preview', 'Secondary evidence; shows parsed findings from Ariada JSON.']),
    row(['result.html embedded screenshot', 'report-only embedding', 'Not counted alone; embeds the tested-host screenshot and links to the standalone PNG.']),
  ])}`),
  section('Visual evidence review', `<p>Visual evidence classification: tested-host-surface, scan-result preview, and report embedding are intentionally separated. This avoids the VISUAL_EVIDENCE_GAP where a report only screenshots itself. The fixture screenshot is expected to show a white app panel, green chips, an image placeholder, unlabeled email input, unnamed button, and missing statement link text. The scan preview is expected to show four findings and the host-blocker note.</p>${table(['Review item', 'Result'], [
    row(['Standalone PNG link', link('screenshots/tested-host-surface.png', 'screenshots/tested-host-surface.png')]),
    row(['Embedded screenshot', testedHostPng ? 'Embedded from captured tested-host PNG.' : 'Pending screenshot capture.']),
    row(['Nonblank validation', 'Validated by <code>scripts/validate-screenshots.mjs</code> after capture.']),
  ])}`),
  section('Evidence artifacts', table(['Artifact', 'Purpose'], [
    row([link('multi-domain-report.json', 'ariada-output/multi-domain-report.json'), 'Representative shared CLI JSON output consumed by the wrapper.']),
    row([link('command.log', 'command.log'), 'Documents exact attempted command and Dart/Flutter host blocker.']),
    row([link('command.exit', 'command.exit'), 'Records host blocker outcome.']),
    row([link('scan-result-preview.html', 'scan-result-preview.html'), 'Rendered scan-result preview used for screenshot capture.']),
    row([link('result.html', 'result.html'), 'Dash-style full research report.']),
  ])),
  section('Evidence/test cases', table(['Case', 'Expected signal'], [
    row(['Parser fixture', 'Two serious findings and two moderate findings are counted at moderate threshold.']),
    row(['Runner stub test', 'Stub shared CLI writes <code>multi-domain-report.json</code>; wrapper returns exit 1.']),
    row(['Static-dir fixture', 'Loopback server bridges <code>build/web</code> style output to the shared CLI.']),
    row(['CanvasKit caveat fixture', 'Documents low-DOM output as a limitation rather than pretending coverage.']),
    row(['Screenshot validation', 'Dimensions and nonblank pixels checked locally.']),
  ])),
  section('Verification and test adequacy', `<p>Test adequacy is partial because the host lacks Dart and Flutter. The source includes Dart tests and package metadata, but local execution could not prove analyzer, format, pub resolution, or <code>dart test</code>. The evidence still validates the fixture path, report path, screenshot path, and report completeness.</p>${table(['Gate', 'Status'], [
    row(['<code>command -v dart</code>', 'not found']),
    row(['<code>command -v flutter</code>', 'not found']),
    row(['<code>node scripts/validate-screenshots.mjs</code>', 'locally runnable and required before commit']),
    row(['Dash-plus audit', 'locally runnable with root audit script and Dash baseline']),
  ])}`),
  section('Blockers', table(['Blocker', 'Exact owner/action'], [
    row(['Dart SDK missing', 'Install Dart SDK before running `dart pub get`, `dart analyze`, `dart test`, `dart format`, and `dart pub publish --dry-run`.']),
    row(['Flutter SDK missing', 'Install Flutter before generating a real `flutter build web --web-renderer html` fixture.']),
    row(['pub.dev publication', 'Founder/release coordinator must approve package name, Google account, verified publisher, and credentials.']),
    row(['CanvasKit/Skwasm coverage', 'Requires native Flutter semantics/testing path or explicit limitation for DOM scanners.']),
    row(['Shared CLI distribution', 'Dart users still need npm/global CLI, CI Action, Docker image, or hosted worker to hide Node/browser setup.']),
  ])),
  section('Domain map', table(['Domain', 'State', 'S106 interpretation'], domainRows.map((r) => row(r.map(esc))))),
  section('Domain map: accessibility, security, privacy/GDPR, performance, reliability, sustainability, SEO/AIEO/GEO, legal notices, localization/i18n, data provenance, AI/compliance where relevant', `<p>This heading is deliberately explicit because S106 is a cross-domain release-evidence channel. Accessibility is implemented in the fixture; every other domain is pass-through or planned until shared Ariada domain packages mature.</p>`),
  section('Flutter web evidence decision matrix', table(['Decision point', 'Recommended S106 position', 'Why it matters'], [
    row(['HTML-renderer or semantics-rich output', 'Treat as the best current target for the adapter because DOM-oriented evidence can observe meaningful labels, links, text, forms, headings, landmarks, legal notices and metadata.', 'This is the path where Ariada evidence can be useful immediately after a Flutter web build. It still needs a real Flutter SDK fixture in the next pass.']),
    row(['CanvasKit or Skwasm-heavy output', 'Mark as limited for DOM scanning and require native Flutter semantics tests, manual review, or future Ariada Flutter plugin work before compliance claims.', 'A canvas can be visually complete while exposing little ordinary HTML. The report must avoid overstating coverage.']),
    row(['Public marketing site built in Flutter web', 'Recommend Ariada only if the rendered output exposes text, metadata, links, language, legal notices and crawlable content.', 'Marketing and SEO/AIEO/GEO buyers care about discoverability and inspectable structure, not only visual parity with mobile.']),
    row(['Internal admin app deployed on web', 'Use Ariada as a release evidence packet for accessibility and legal-policy checks, but keep deeper workflow validation in Flutter widget and E2E tests.', 'Admin teams can accept CI evidence, but they still need keyboard, focus, modal, form and state-path tests outside a static scan.']),
    row(['Public-sector service surface', 'Require the strongest path: real build output, browser scan, screenshot, raw JSON, command log, manual reviewer sign-off and retained evidence.', 'EAA and EN 301 549 evidence is a procurement and acceptance artifact, not just a developer convenience.']),
    row(['Mobile-only Flutter app', 'Do not sell S106. Route to future mobile/app accessibility evidence work instead.', 'The distribution channel is Flutter web. Selling it to mobile-only teams would create wrong expectations.']),
    row(['FlutterFlow or generated Flutter web', 'Treat as adjacent future onboarding, not proof of this pub package. Generated web shells still need real screenshots and host-specific blockers documented.', 'No-code and generated-app teams may buy evidence, but packaging and support surfaces differ from pub.dev developers.']),
    row(['CI without local Dart', 'Prefer Docker/GitHub Action/hosted worker because the adapter source alone cannot prove package behavior without Dart SDK.', 'This mirrors the current host blocker and turns it into a product packaging requirement.']),
    row(['CI with Dart but no Flutter', 'Allow URL scanning of already served Flutter web output, but block claims about `flutter build web` integration.', 'Dart package tests can pass while the Flutter build path remains unproven.']),
    row(['CI with Flutter SDK', 'Run `flutter build web`, preserve `build/web`, run `dart run ariada:scan --static-dir build/web`, upload raw JSON, screenshots and HTML report.', 'This is the target happy path for the next S106 validation host.']),
    row(['Hosted scan', 'Hide Dart/Flutter/Node/browser setup and sell retention, signatures, baselines and dashboards.', 'Buyers pay to remove operational friction and keep evidence history.']),
    row(['Native Flutter plugin', 'Future path only. It should inspect Semantics, route coverage and widget-level accessibility before browser output exists.', 'A native plugin would be a different product surface from the current thin CLI wrapper.']),
  ])),
  section('Renderer-specific evidence adequacy', table(['Renderer or output shape', 'Evidence classification', 'Adequacy statement'], [
    row(['HTML-like DOM output', 'tested host surface can be meaningful', 'Ariada can inspect ordinary controls, labels, headings, language, links, legal notices, metadata, structured data and many cross-domain signals.']),
    row(['Flutter semantics DOM layer', 'partially meaningful host surface', 'Screen-reader-oriented structure may be present, but the report must still check whether labels, roles and focus semantics appear as expected.']),
    row(['CanvasKit canvas with minimal semantics', 'limited host surface', 'Ariada may see shell metadata and canvas element only. This is not enough for a compliance claim without native semantics tests or manual review.']),
    row(['Skwasm output', 'limited unless semantics are exposed', 'The WebAssembly renderer changes implementation details and may require separate capture/performance evidence.']),
    row(['Server shell plus Flutter app mount', 'mixed host surface', 'Ariada can inspect the shell, legal links, metadata and app mount, but may miss widget semantics if canvas-only.']),
    row(['Prerendered marketing shell with Flutter islands', 'promising surface', 'Ariada can inspect the public shell while separate checks handle Flutter islands. This may be the best SEO/AIEO/GEO route.']),
    row(['Single-page authenticated app', 'requires authenticated scan path', 'Future hosted worker or CI recipe must support auth/session setup before claims are useful.']),
    row(['Embedded Flutter web inside another host', 'host-specific evidence needed', 'The containing CMS, Angular, React or native shell can affect layout, accessibility, CSP and asset loading.']),
    row(['PWA installable Flutter web app', 'additional manifest and offline checks needed', 'Reliability, privacy, security and legal notice checks should include manifest, service worker, cache and update behavior.']),
    row(['Internationalized Flutter web app', 'locale-specific evidence needed', 'A single English fixture does not prove Swedish/EU language, labels, date formats, legal notices or RTL behavior.']),
  ])),
  section('Buyer objections and answers', table(['Objection', 'Answer Ariada should give', 'Status today'], [
    row(['Flutter already has accessibility APIs.', 'Yes, and Ariada should complement them by scanning the built web artifact and retaining external evidence. Native Flutter semantics checks are future work.', 'Documented.']),
    row(['CanvasKit is not normal HTML.', 'Correct. The report labels canvas-heavy output as limited and does not use a static DOM fixture to claim CanvasKit compliance.', 'Documented with caveat fixture.']),
    row(['Why install Node for a Dart package?', 'The wrapper is intentionally thin over the shared scanner. The next product step is a Docker/GitHub Action/hosted worker that hides Node and browser setup.', 'Open packaging gap.']),
    row(['Why not just use Lighthouse?', 'Lighthouse is useful, but Ariada is positioned as retained multi-domain compliance evidence with raw JSON, screenshots, command logs and future signed exports.', 'Positioned in competitor map.']),
    row(['Why pay for a wrapper?', 'Do not charge for the wrapper. Charge for retention, signatures, baselines, dashboards, exception workflows and compliance-domain packs.', 'Monetization section says this.']),
    row(['Can this prove EAA compliance?', 'No automated scanner alone proves compliance. It creates repeatable evidence and triage artifacts for human review.', 'Self-critique section says this.']),
    row(['Will it run in our CI?', 'Yes after Dart/Flutter/Node/browser setup exists. The current host lacks Dart/Flutter, so CI recipe is a required next artifact.', 'Host blocker documented.']),
    row(['What about authenticated routes?', 'Not implemented in S106. Future Action/hosted worker needs session setup and route inventory.', 'Future gap.']),
    row(['What about screenshots?', 'The evidence separates tested host surface from scan-result preview and avoids report-only proof.', 'Implemented.']),
    row(['What if pub.dev package name is unavailable?', 'Founder/release coordinator decides final name; source currently uses `ariada` to satisfy `dart run ariada:scan` in the spec.', 'Human blocker.']),
    row(['What about FlutterFlow users?', 'Adjacent channel. Use this research later, but do not claim FlutterFlow marketplace/product coverage in S106.', 'Scoped.']),
    row(['What about mobile accessibility?', 'Separate channel. S106 is web-output evidence and should not be sold as mobile app scanning.', 'Scoped.']),
  ])),
  section('pub.dev release readiness checklist', table(['Release item', 'Why it matters', 'Current state'], [
    row(['Package name decision', 'The command requested by the handoff is `dart run ariada:scan`, which implies package name `ariada`; pub.dev availability and brand fit must be confirmed.', 'Human blocker.']),
    row(['Verified publisher', 'Dart docs and pub.dev help emphasize publisher identity. Ariada should publish under a verified Ariada domain, not as an unverified uploader.', 'Human blocker.']),
    row(['License and repository metadata', 'pub.dev scoring and enterprise trust depend on clear license, repository and issue tracker metadata.', 'Present in `pubspec.yaml`; final publication still needs dry-run.']),
    row(['Executable mapping', 'Dart package layout expects public tools in `bin/`; the package exposes `scan` for `dart run ariada:scan`.', 'Implemented in source.']),
    row(['README install path', 'Dart users need exact commands and the shared CLI dependency explained up front.', 'Implemented.']),
    row(['Analyzer and format', 'Dart packages should pass `dart analyze` and `dart format --output=none --set-exit-if-changed .` before publication.', 'Blocked by missing Dart SDK.']),
    row(['Tests', 'Parser and runner tests should pass under `dart test` before publication.', 'Written, blocked by missing Dart SDK.']),
    row(['Publish dry-run', '`dart pub publish --dry-run` catches metadata and package-shape issues before credentials are used.', 'Blocked by missing Dart SDK.']),
    row(['Flutter example', 'A real Flutter web sample build is stronger than a static fixture and should be included before public promotion.', 'Blocked by missing Flutter SDK.']),
    row(['CI recipe', 'The first public users should be able to copy a GitHub Action without manually composing Dart, Flutter, Node, browser and upload steps.', 'Not implemented.']),
    row(['Security disclosure', 'The package shells out to external CLI; docs should explain no secrets are collected and where artifacts are written.', 'Partially covered; needs release review.']),
    row(['Versioning', 'Start at 0.1.0 only after runtime gates pass. Keep pre-release/internal status until Dart/Flutter host validation is complete.', 'Source says 0.1.0; publication blocked.']),
  ])),
  section('CI and hosted packaging backlog', table(['Backlog item', 'Free/open-source shape', 'Paid/hosted shape'], [
    row(['GitHub Action', 'Composite Action that installs Dart/Flutter, Node, Ariada CLI, browser runtime, runs scan, uploads artifacts.', 'Enterprise variant uploads to Ariada dashboard and enforces baseline policy.']),
    row(['Docker image', 'Pinned image with Dart/Flutter SDK, Node, shared CLI and browser cache for reproducible CI.', 'Hosted worker maintains image updates and vulnerability response.']),
    row(['Artifact convention', 'Raw JSON, command log, screenshots, HTML report and optional route manifest under predictable names.', 'Retention, signatures, comparisons, exception approvals and export history.']),
    row(['Auth support', 'Document local URL and static-dir first; later add Playwright session/bootstrap hook.', 'Hosted secrets, SSO, route credentials and redacted logs.']),
    row(['Route inventory', 'Allow a simple URL list or route manifest for public Flutter web pages.', 'Fleet scan, sitemap discovery and scheduled route coverage.']),
    row(['Renderer detection', 'Document user-provided renderer/build mode and screenshot classification.', 'Hosted analysis flags canvas-heavy output and recommends native/manual follow-up.']),
    row(['Baseline policy', 'CLI threshold by severity and domain.', 'Organization-level policy, waivers, expiry and audit history.']),
    row(['Evidence signing', 'Out of scope for free wrapper.', 'Signed JSON/HTML/PDF exports for procurement and regulator packets.']),
    row(['Remediation handoff', 'Link raw findings to source/report context.', 'Team dashboards, assignments, Jira/GitHub issues and reviewer comments.']),
    row(['Community templates', 'Issue templates asking for renderer, Flutter version, output type and failing artifact.', 'Support workflow with retained reproduction artifacts.']),
  ])),
  section('Expanded domain implementation backlog', table(['Domain', 'First useful Flutter web check', 'Why this domain can sell'], [
    row(['Accessibility', 'Labels, buttons, headings, focus order proxies, statement link, language and obvious contrast where visible.', 'EAA/WCAG pressure is the immediate buying trigger.']),
    row(['Privacy/GDPR', 'Cookie/analytics scripts, consent link, privacy notice, local/session storage inventory and third-party endpoints.', 'Public Flutter web apps often add analytics and SDKs after the UI is built.']),
    row(['Security', 'CSP, frame options, referrer policy, permissions policy, mixed content and risky third-party resources.', 'Platform owners already understand release gates and header evidence.']),
    row(['Performance', 'Initial payload, CanvasKit/Skwasm asset size, long tasks, render timing, image size and third-party cost.', 'Flutter web criticism often centers on payload and startup time.']),
    row(['Reliability', 'Blank-screen risk, missing assets, service worker failure, offline route behavior and broken links.', 'A visually blank Flutter web app can be a release blocker even when the build succeeded.']),
    row(['Sustainability', 'Transfer size, cache policy, unused payload, third-party scripts and heavy canvas/runtime assets.', 'Large web payloads create cost and carbon narratives for public services.']),
    row(['SEO/AIEO/GEO', 'Title, description, canonical, robots, structured data, crawlable text and AI-readable public content.', 'Canvas-heavy public pages can fail discoverability expectations.']),
    row(['Legal notices', 'Accessibility statement, privacy policy, terms, imprint/legal notice and contact paths.', 'EU public and commercial sites need visible governance links.']),
    row(['Localization/i18n', 'HTML lang, locale route coverage, untranslated labels, date/number formats and RTL support.', 'Sweden/EU buyers care about language obligations and procurement evidence.']),
    row(['Data provenance', 'Dataset/source links, timestamps, update policy and generated-content source references.', 'Dashboards and public data apps need trustable source lineage.']),
    row(['AI/compliance', 'AI disclosure, generated-content notice, human review statement and EU AI Act transparency where relevant.', 'Future compliance layer for generated guidance and AI-assisted apps.']),
    row(['Procurement packet', 'Bundle domain results into one retained artifact with reviewer notes and sign-off state.', 'This is where free wrapper adoption becomes paid workflow.']),
  ])),
  section('Human interview guide', table(['Interviewee', 'Questions to ask', 'Decision this informs'], [
    row(['Flutter web developer', 'Which renderer do you use, where do you run accessibility checks, and what would make a `dart run` scanner acceptable?', 'Local/dev-loop placement and documentation tone.']),
    row(['Flutter team lead', 'When does web output become release-critical, and who owns CI runtime setup?', 'Whether Action/Docker path is mandatory before promotion.']),
    row(['Accessibility reviewer', 'What evidence do you need beyond raw scanner output for a Flutter web release?', 'Report fields, screenshot classification and manual-review workflow.']),
    row(['Platform owner', 'Would you permit a Node-backed scanner in a Dart CI pipeline if it arrived as a maintained Docker/Action?', 'Packaging solution and objection handling.']),
    row(['Public-sector supplier', 'Which artifacts are accepted in procurement: HTML report, JSON, screenshot, command log, signed PDF, or human checklist?', 'Paid export shape.']),
    row(['Security owner', 'Should security headers and third-party resources appear in the same Flutter web release packet?', 'Cross-domain roadmap order.']),
    row(['Privacy/legal owner', 'Which GDPR/legal-notice checks matter before a public Flutter web app ships?', 'Privacy/legal domain content.']),
    row(['SEO/content owner', 'Do you treat Flutter web as acceptable for public content, or only for app-like surfaces?', 'SEO/AIEO/GEO positioning.']),
    row(['Sustainability advocate', 'Do CanvasKit payload size and runtime assets matter in procurement or public reporting?', 'Sustainability sales hook.']),
    row(['Release coordinator', 'Would pub.dev package trust require verified publisher and signed artifacts?', 'Release checklist and publication blocker.']),
  ])),
  section('Competitors/channel saturation', table(['Competitor or category', 'Current strength', 'Ariada response'], competitors.map((r) => row(r.map(esc))))),
  section('Narrow competitors by domain', table(['Domain', 'Narrow alternatives', 'S106 wedge'], [
    row(['Accessibility', 'axe, Pa11y, Lighthouse, WAVE, Deque, BrowserStack, LambdaTest', 'Dart-shaped wrapper plus retained evidence path.']),
    row(['Security', 'ZAP, SecurityHeaders, Observatory', 'Same artifact packet as accessibility; not a pentest replacement.']),
    row(['Privacy/GDPR', 'Cookiebot, OneTrust, CMP tools', 'Detect/review evidence, not consent operations.']),
    row(['Performance', 'Lighthouse, WebPageTest, Flutter DevTools', 'Release-evidence capture and trend retention.']),
    row(['Sustainability', 'Website Carbon, Ecograder', 'Combine payload and third-party evidence with compliance packet.']),
    row(['SEO/AIEO/GEO', 'Rich Results, Schema validator, Search Console', 'Retain shell/crawlability evidence for Flutter web releases.']),
  ])),
  section('Community review sources', table(['Source family', 'Roles speaking', 'Signal', 'Product implication'], communitySignals.map((r) => row(r.map(esc))))),
  section('Signal count', table(['Pattern', 'Evidence cluster'], repeatedPatterns.map((r) => row(r.map(esc))))),
  section('Pain mining', table(['Where to search next', 'Queries and signals to collect'], [
    row(['Flutter GitHub issues', '`is:issue web accessibility semantics CanvasKit`, `testID Flutter web`, `HTML renderer removed accessibility`; collect blocker labels and maintainer replies.']),
    row(['Reddit r/FlutterDev', '`Flutter web accessibility`, `CanvasKit HTML renderer`, `pub.dev package publishing`; collect production anecdotes and objections.']),
    row(['Stack Overflow', '`flutter web semantics`, `canvaskit accessibility`, `dart run executable package`; collect recurring setup questions.']),
    row(['HN/Lobsters', '`Flutter web production ready accessibility SEO`; collect architect objections and language for positioning.']),
    row(['pub.dev package pages', '`accessibility`, `flutter web`, `seo`, `lighthouse`; map saturated package names and maintenance quality.']),
    row(['No-signal searches', 'G2, Capterra, TrustRadius and Product Hunt: no strong Flutter-web-specific package buying signal found; treat as weak.']),
  ])),
  section('Distribution/monetization', table(['Revenue layer', 'Decision'], monetizationRows.map((r) => row(r.map(esc))))),
  section('Sources incl community/review places where possible', table(['Source', 'Owner', 'Reliability', 'URL'], linkTableRows(externalSources))),
  section('Local source map', table(['Local file', 'Path'], localLinks.map(([label, href]) => row([esc(label), link(href, href)])))),
  section('Source attribution method', `<p>Official Flutter/Dart/pub.dev/W3C/EU sources are used for stable mechanics, standards, and publishing rules. Community-review sources are used only for objections, adoption signals, and pain-mining language. Internal Ariada PRDs and package files are used for implementation boundaries and domain roadmap fit.</p>`),
  section('Self-critique and limitations', table(['What this report does not prove', 'Next proof needed'], [
    row(['It does not prove a real Flutter SDK build on this host.', 'Install Flutter and run `flutter build web --web-renderer html` against an example app.']),
    row(['It does not prove CanvasKit accessibility completeness.', 'Build a native Flutter semantics/testing connector or mark CanvasKit as limited for DOM scans.']),
    row(['It does not prove pub.dev name availability.', 'Release coordinator checks pub.dev and verified publisher setup.']),
    row(['It does not prove buyer willingness.', 'Interview platform owners, accessibility reviewers, and public-sector suppliers.']),
    row(['It does not prove all domains.', 'Implement/pass through shared Ariada domain packs as they mature.']),
  ])),
  section('Next steps for Ariada', table(['Owner', 'Action'], [
    row(['Adapter maintainer', 'Run Dart gates on a host with Dart SDK: `dart pub get`, `dart analyze`, `dart test`, `dart format --output=none --set-exit-if-changed .`.']),
    row(['Flutter maintainer', 'Create real sample app and run `flutter build web --web-renderer html`; preserve build output fixture.']),
    row(['Platform maintainer', 'Ship a GitHub Action/Docker recipe that hides Node/browser/Ariada CLI setup.']),
    row(['Product', 'Define paid retention, baseline policy, signed export, and exception workflow for Flutter web evidence.']),
    row(['Research', 'Run pain-mining queries monthly and update source/signal table.']),
  ])),
  section('Next steps for humans', table(['Human role', 'Action'], [
    row(['Founder/release coordinator', 'Approve pub.dev package name and verified publisher.']),
    row(['Compliance reviewer', 'Review whether fixture findings map to EAA/WCAG buyer language.']),
    row(['Flutter expert', 'Validate CanvasKit/Skwasm limitation and semantics-layer wording.']),
    row(['Sales/product', 'Test pricing language with platform owners and public-sector suppliers.']),
  ])),
  section('Human/agent handoff', table(['Handoff item', 'Status'], [
    row(['Changed files stay under `integrations/dart-flutter-ariada`', 'Yes.']),
    row(['Central hub files', 'Not edited by this work item per user instruction.']),
    row(['Mascot paths', 'Not staged.']),
    row(['Commit author', 'Alexander Brichkin (Agonist Development AB) <git@ariada.org>.']),
  ])),
  section('Distribution/promotion', table(['Surface', 'Message'], [
    row(['pub.dev', 'Thin Ariada evidence adapter for Flutter web builds; scanner rules live in shared CLI.']),
    row(['GitHub README', 'Use after `flutter build web`; document renderer caveat and artifacts.']),
    row(['Flutter community', 'Ask for feedback on CI evidence and renderer limitations, not generic accessibility claims.']),
    row(['Public-sector procurement', 'Offer retained EAA/WCAG evidence, screenshots, raw JSON, command log, and signed exports.']),
  ])),
  narrativeBlock('What developers should not be asked to own', 'Flutter web teams should not own browser-runtime caching, Node-based scanner installation, evidence signing, retention, or cross-domain policy interpretation. The wrapper should make the first local run easy; CI/Docker/hosted paths should absorb operational friction.'),
  narrativeBlock('Future native path', 'A truly native Flutter path would inspect Flutter semantics tests, widget trees, route maps, and generated web output together. S106 does not do that. The current channel is intentionally a thin evidence bridge around built web output and the shared Ariada CLI.'),
  narrativeBlock('Buyer timing', 'Ariada should enter when a Flutter web app becomes public-facing, contractual, regulated, or procurement-reviewed. Pure mobile teams are not the buyer for this channel until they ship a web surface.'),
  narrativeBlock('Report-only screenshot warning', 'A report-only screenshot is useful for presentation but cannot prove the tested host surface. This report embeds and links the tested-host PNG and separately captures the scan-result preview.'),
  narrativeBlock('Host blocker exactness', 'The host blocker is concrete: `command -v dart` and `command -v flutter` return no executable in this worktree environment. That blocks Dart/package runtime gates and real Flutter build validation, but not static source review, fixture inspection, screenshot capture, or report audit.'),
  section('Acceptance evidence still needed before public promotion', table(['Evidence gap', 'Why it matters for S106', 'Concrete next proof'], [
    row(['Real Flutter SDK build', 'A static fixture can prove the adapter and report path, but a public pub.dev announcement should show an actual Flutter project built with the documented renderer mode.', 'Create a tiny Flutter web app, run `flutter build web --web-renderer html` or the current supported equivalent, commit the generated representative fixture, and scan that output.']),
    row(['Renderer/version matrix', 'Flutter web renderer behavior changes across releases. A one-version result can become stale if HTML renderer support, CanvasKit semantics, or Skwasm defaults change.', 'Record Flutter version, Dart version, renderer/build mode, generated files, and screenshot classification in each evidence bundle.']),
    row(['Hosted CI proof', 'The product promise is stronger when Dart/Flutter/Node/browser setup is hidden from application developers.', 'Run the same fixture in a pinned Docker or GitHub Action environment and upload the full evidence bundle as an artifact.']),
    row(['Reviewer acceptance', 'The buyer is often an accessibility or compliance reviewer, not the developer who adds the package.', 'Ask reviewers whether raw JSON, command log, tested-host screenshot, scan-result preview and HTML report are sufficient for triage, and what signed export format they require.']),
  ])),
];

const previewRows = findings.map((finding) => row([
  esc(finding.ruleId ?? 'unknown'),
  esc(finding.severity ?? 'moderate'),
  esc(finding.message ?? ''),
]));

const styles = `
  :root { color-scheme: light; --ink: #162126; --muted: #526066; --line: #cfd8d3; --accent: #0e6f78; --soft: #eef5f1; --warn: #8a5a00; --bad: #9c2f2f; --ok: #1f6b43; }
  html, body { overflow: hidden; }
  ::-webkit-scrollbar { display: none; width: 0; height: 0; }
  body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #fbfbf8; line-height: 1.55; }
  header { padding: 36px 24px; background: #e8f1ed; border-bottom: 1px solid var(--line); }
  main { max-width: 1120px; margin: 0 auto; padding: 28px 24px 56px; }
  h1 { font-size: 34px; line-height: 1.15; margin: 0 0 10px; }
  h2 { margin-top: 34px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 22px; }
  p { max-width: 86ch; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 14px; background: white; }
  th, td { border: 1px solid var(--line); padding: 9px 10px; vertical-align: top; text-align: left; }
  th { background: var(--soft); font-weight: 700; }
  a { color: #075e68; }
  pre { overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; background: #172126; color: #f5fbf8; border-radius: 6px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .badge { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 12px; font-weight: 700; }
  .badge.ok { background: #dff2e7; color: var(--ok); }
  .badge.warn { background: #fff1cf; color: var(--warn); }
  .badge.info { background: #e4edf7; color: #24537a; }
  .hero-grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(280px, .8fr); gap: 24px; align-items: start; }
  .shot { display: block; max-width: 100%; border: 1px solid var(--line); border-radius: 6px; background: white; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .pill { background: white; border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; font-size: 13px; }
  @media (max-width: 760px) { .hero-grid { grid-template-columns: 1fr; } h1 { font-size: 28px; } table { font-size: 13px; } }
`;

const previewHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ariada Flutter web scan preview</title><style>${styles}</style></head>
<body><header><h1>Ariada Flutter web scan-result preview</h1><p>Classification: scan-result preview. This is not the tested host surface; it renders the representative shared CLI JSON for screenshot capture.</p></header>
<main>${table(['Rule', 'Severity', 'Message'], previewRows)}<h2>Host blocker</h2><pre>${esc(commandLog)}</pre></main></body></html>`;
writeFileSync(join(evidenceDir, 'scan-result-preview.html'), previewHtml);
writeFileSync(join(testReportDir, 'result.html'), previewHtml);

const reportHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>S106 Dart/Flutter web Ariada evidence report</title><style>${styles}</style></head>
<body>
<header>
  <div class="hero-grid">
    <div>
      <h1>S106 — Dart/Flutter pub package for Flutter web</h1>
      <p>Dash-style channel evidence report for a thin Dart adapter around the shared Ariada scanner CLI. The report is intentionally explicit about the Flutter web renderer caveat, host blockers, tested surface classification, monetization path, and community-review evidence.</p>
      <div class="meta">
        <span class="pill">Channel: S106</span>
        <span class="pill">Adapter: Dart pub package</span>
        <span class="pill">Surface: Flutter web/static output</span>
        <span class="pill">Scan status: fixture-backed MVP bridge</span>
        <span class="pill">Command exit: ${esc(commandExit)}</span>
      </div>
    </div>
    <figure>
      ${testedHostPng ? `<img class="shot" src="data:image/png;base64,${testedHostPng}" alt="Embedded tested host surface screenshot for the Flutter web fixture">` : '<p>Screenshot pending capture.</p>'}
      <figcaption>Embedded screenshot classification: tested host surface. Direct PNG: ${link('screenshots/tested-host-surface.png', 'screenshots/tested-host-surface.png')}.</figcaption>
    </figure>
  </div>
</header>
<main>
  ${sections.join('\n')}
  <section><h2>Command log</h2><pre>${esc(commandLog)}</pre></section>
  <section><h2>Raw representative Ariada JSON</h2><pre>${esc(rawReport)}</pre></section>
  <section><h2>Scan-result screenshot embed</h2>${scanResultPng ? `<img class="shot" src="data:image/png;base64,${scanResultPng}" alt="Embedded scan-result preview screenshot">` : '<p>Scan-result screenshot pending capture.</p>'}<p>Direct PNG: ${link('screenshots/scan-result.png', 'screenshots/scan-result.png')}.</p></section>
</main>
</body>
</html>`;

writeFileSync(join(evidenceDir, 'result.html'), reportHtml);
console.log(`wrote ${join(evidenceDir, 'result.html')}`);
