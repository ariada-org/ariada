#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const integration = join(root, 'integrations', 'go-ariada');
const evidenceDir = join(integration, 'scan-evidence');
const testReportDir = join(integration, 'test-report');
mkdirSync(join(evidenceDir, 'screenshots'), { recursive: true });
mkdirSync(testReportDir, { recursive: true });

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const link = (href, text) => `<a href="${esc(href)}">${esc(text)}</a>`;
const badge = (status) => `<span class="badge ${slug(status)}">${esc(status.toUpperCase())}</span>`;
const row = (cells, th = false) => `<tr>${cells.map((cell, idx) => idx === 0 && th ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`;
const table = (heads, rows) => `<table><thead>${row(heads.map(esc))}</thead><tbody>${rows.join('\n')}</tbody></table>`;

function imageData(name) {
  const path = join(evidenceDir, 'screenshots', name);
  return existsSync(path) ? readFileSync(path).toString('base64') : '';
}

const hostShot = imageData('tested-host-surface.png');
const reportShot = imageData('scan-result.png');

const commandLogPath = join(evidenceDir, 'command.log');
const commandLog = existsSync(commandLogPath) ? readFileSync(commandLogPath, 'utf8') : 'Command log not available.';
const displayCommandLog = commandLog
  .replaceAll(root, '<s103-worktree>')
  .replaceAll(`/Users/${process.env.USER}/adopta`, '<canonical-worktree>')
  .replace(/[ \t]+$/gm, '');

const rawReportPath = join(evidenceDir, 'ariada-output', 'multi-domain-report.json');
const rawReport = existsSync(rawReportPath) ? readFileSync(rawReportPath, 'utf8') : '{}';

const roleRows = [
  ['Go developer', 'Add a Go-native binary to a local make target or CI job.', 'Zero scanner rewrite, low-friction gate, same JSON/report artifacts as other Ariada channels.', 'Usually not the first budget holder; starts adoption and creates the pull request that exposes the need.', 'During feature freeze, release hardening, customer review, or first EAA/GDPR/security audit.', 'Wrapper implemented; Go toolchain verification blocked on this workstation.'],
  ['Platform / CI owner', 'Standardize `ariada-gate` in Go service templates, reusable workflows, and golden paths.', 'Repeatable evidence with a consistent exit-code contract and artifact layout across Go services.', 'Likely buyer for team plan, hosted evidence storage, policy retention, and fleet-level dashboards.', 'When multiple Go services need the same gate and manual reviews start to slow releases.', 'CLI wrapper implemented; fleet policy/hosted retention not implemented in this channel.'],
  ['Go service product owner', 'Attach a reviewer-ready evidence packet to release, procurement, or compliance tickets.', 'Reduced launch risk: the product owner can show what was scanned, what failed, and what remains blocked.', 'Pays when delayed release, public procurement, customer security review, or regulator-facing evidence has a measurable cost.', 'Before public launch, enterprise customer acceptance, procurement renewal, or board-level risk review.', 'Report artifact implemented; SaaS storage/workflow approvals not implemented here.'],
  ['Accessibility / compliance owner', 'Receive raw JSON, command log, tested-surface screenshot, report screenshot, and remediation summary.', 'Audit trail for EAA, WCAG, EN 301 549, internal accessibility policy, and customer questionnaires.', 'Budget holder when the obligation is compliance evidence rather than developer convenience.', 'When the organization needs repeatable proof instead of screenshots pasted into a ticket.', 'Accessibility domain available through core; statement/legal workflow not fully implemented.'],
  ['Security / SRE owner', 'Use the Go channel as a release evidence adapter that can later include security, reliability, provenance, and incident-readiness domains.', 'One evidence habit for Go services: accessibility first, then release-risk domains that already match SRE ownership.', 'Pays when this becomes platform governance or service-readiness evidence across teams.', 'After the first accessibility gate proves useful and the same mechanism can carry broader risk checks.', 'Security domain is available through core; reliability/provenance/incidents are candidate domains.'],
  ['Data platform owner', 'Run the gate against dashboards, generated admin pages, public data portals, or generated docs owned by Go teams.', 'Evidence that rendered data surfaces are understandable, labeled, source-attributed, and reviewable.', 'Pays when analytics products, public data portals, or data-export pages become externally reviewed assets.', 'When data teams ship public dashboards or internal executive tools built on Go services.', 'Data quality/provenance is candidate; current scan proves web-surface accessibility.'],
  ['Procurement / vendor-risk reviewer', 'Consume the evidence packet as a repeatable vendor artifact rather than asking every Go team for manual screenshots.', 'Lower review friction and a portable artifact that can be retained with procurement files.', 'Pays indirectly via procurement tooling, compliance operations, or platform governance budget.', 'When a Go service is part of a vendor/customer security and accessibility questionnaire.', 'Procurement evidence domain is candidate; current channel supplies local artifacts.'],
];

const implementationRows = [
  ['Go wrapper binary', 'implemented', '`cmd/ariada-gate` parses URL, output dir, domains, severity threshold, Ariada binary override and timeout.'],
  ['Shared scanner reuse', 'implemented', 'Runs `ariada scan ... --format both`; no accessibility, privacy, security, SEO, performance, or other domain logic is reimplemented in Go.'],
  ['JSON gate parsing', 'implemented', 'Reads `multi-domain-report.json`, counts findings at or above the configured severity threshold, and maps the result to CI exit codes.'],
  ['Unit test design', 'implemented', 'Table-driven tests cover command construction, pass/fail gate logic, validation errors, report parsing, and runtime failure mapping.'],
  ['Tested surface fixture', 'implemented', 'A static HTML fixture represents output that a Go `net/http`, templ, Hugo, Gin, Echo, Fiber, or internal Go tool could serve.'],
  ['Real Ariada scan', 'implemented', 'The canonical local Ariada CLI scanned the served fixture and produced real multi-domain JSON plus a command log.'],
  ['Go build / vet / test', 'blocked', 'This workstation has no `go` or `gofmt` binary, so Go compiler, vet, test, and formatting gates are blocked until Go 1.22+ is installed.'],
  ['Public module publication', 'planned', '`go install` can work from the public Git repository after the final module path and release tag are approved.'],
  ['Hosted evidence retention', 'not implemented', 'The wrapper writes local artifacts only; upload, retention policy, and team dashboards belong to the hosted Ariada product.'],
  ['Policy bundles', 'not implemented', 'The wrapper passes domains and threshold; org-level policy packs and exceptions are not implemented in this channel.'],
];

const coreRows = [
  ['Command execution', '`ariada-gate` -> `ariada scan`', 'The Go binary shells out to the shared CLI and treats it as the source of scanner truth.'],
  ['Report source', '`multi-domain-report.json`', 'The wrapper reads the canonical multi-domain JSON and does only threshold counting.'],
  ['Browser capture', '@ariada-org/core-playwright via CLI', 'The browser pass remains in Ariada core; Go never parses DOM or runs axe directly.'],
  ['Domain discovery', '@ariada-org/multi-domain via CLI', 'Selected domains are passed to the CLI; available domain modules are not duplicated in Go.'],
  ['Evidence layout', 'scan-evidence + test-report', 'Artifacts follow the distribution-channel pattern used by other adapters.'],
  ['Exit contract', '0/1/2/3', 'Exit codes are CI-friendly and mapped to the existing Ariada CLI failure shape.'],
];

const domainRows = [
  ['Accessibility', 'implemented', 'Core/current', 'First wedge for Go services that render HTML, generated docs, admin pages, public portals, or internal dashboards.', 'The fixture intentionally triggers `button-name`, `image-alt`, `label`, target-size and Ariada statement/skip-link findings.', 'Package already available through Ariada CLI.'],
  ['Privacy / GDPR', 'available through core', 'Core/current', 'Important when Go services set cookies, add analytics, include forms, or embed third-party scripts.', 'Current fixture does not exercise privacy because it has no cookies/scripts; Go channel can pass `--domains privacy` once service surface needs it.', 'Needs richer Go fixture with cookies, consent banner, analytics script and privacy notice variants.'],
  ['Security', 'available through core', 'Core/current', 'Useful for rendered HTML and browser-visible security risks: insecure forms, link targets, CSP-adjacent evidence, mixed resources.', 'Current fixture only proves the wrapper can call a domain; it does not model real Go app headers.', 'Needs `net/http` fixture with headers once Go toolchain exists.'],
  ['AI readiness', 'available through core', 'Core/current', 'Relevant for Go-generated docs, public knowledge portals, release notes, and help centers indexed by AI search.', 'Current fixture has too little content to prove AI-readiness value.', 'Needs docs/data-portal fixture and source/citation checks.'],
  ['Structured data', 'available through core', 'Core/current', 'Relevant for public Go static output, docs, product pages, data portals, and API documentation.', 'Current fixture has no Schema.org/OG/canonical metadata.', 'Needs Schema.org, OG, canonical, sitemap and broken/malformed cases.'],
  ['Sustainability', 'available through core', 'Core/current', 'Go teams often already care about resource efficiency; browser payload evidence gives a user-facing sustainability layer.', 'Current fixture is intentionally tiny and does not prove sustainability scoring.', 'Needs heavy-resource fixture and WSG-aligned scoring.'],
  ['Performance / Core Web Vitals', 'planned', 'D07 planned', 'High fit for Go web services and generated dashboards because Go teams often own latency budgets.', 'Not implemented in S103; current report only lists it as a roadmap domain.', 'Implement D07 performance domain, then expose `--domains performance` examples.'],
  ['SEO', 'planned', 'D08 draft', 'High fit for Hugo, public docs, public data portals, and Go-rendered marketing/product pages.', 'Not implemented in S103; source docs and candidate checks are listed.', 'Implement SEO domain over title, meta description, canonical, robots, sitemap, hreflang and structured data coherence.'],
  ['GEO / AIEO / AI-search visibility', 'planned', 'D09 draft', 'Fit is strong for Go-generated documentation and public data portals that want AI citation/answer visibility.', 'Not implemented in S103; report maps the channel wedge and pain-mining locations.', 'Implement llms.txt, AI crawler policy, citation/source quality and AI disclosure checks.'],
  ['Localization / i18n', 'planned', 'D10 draft', 'High EU fit for public services, Swedish/EU SMEs, municipality/public-sector systems and cross-border products.', 'Current fixture uses English only and does not test lang variants or RTL.', 'Implement lang, hreflang, direction, locale date/number and untranslated-string checks.'],
  ['Reliability / availability', 'planned', 'D11 draft', 'Very strong Go-channel fit because Go teams commonly own service health and release readiness.', 'Not implemented; current local server is only a fixture host.', 'Implement status-code, broken-link, route health, error-page and release-readiness evidence.'],
  ['Data quality / provenance / freshness', 'planned', 'D12 draft', 'Strong for public dashboards, analytics products and public data portals built by Go teams.', 'Current fixture has no data source, timestamp or export lineage.', 'Implement freshness, source, timestamp, owner, schema and export provenance checks.'],
  ['Legal / policy notices', 'candidate', 'Catalog candidate', 'Relevant for public launches: privacy notice, accessibility statement, AI disclosure, contact path and complaint process.', 'Current fixture intentionally lacks Ariada statement links, producing findings adjacent to this pain.', 'Needs domain PRD and policy-notice rule pack.'],
  ['Jurisdiction / penalty exposure', 'candidate', 'Platform spec', 'Fit for compliance owners who need risk prioritization by EU jurisdiction and service exposure.', 'Not implemented in wrapper; penalty estimator exists elsewhere as product capability.', 'Connect findings to jurisdiction rate cards only after domain result provenance is stable.'],
  ['Brand / design-token compliance', 'candidate', 'Platform spec', 'Useful when Go apps generate branded pages or internal admin UIs that drift from design tokens.', 'Not implemented; fixture has no brand system.', 'Needs design-token ingestion and visual/component mapping.'],
  ['Content quality / E-E-A-T / governance', 'candidate', 'L6 GEO/AIEO', 'Useful for Go docs/data portals where answer quality and trust signals matter.', 'Not implemented; current fixture is intentionally minimal.', 'Needs content-quality PRD and source-aware scoring.'],
  ['AI provenance / authorship', 'candidate', 'AI Act adjacent', 'Useful for Go-generated content, AI-assisted docs and public disclosures.', 'Not implemented; fixture has no AI-generated content marker.', 'Needs authorship/provenance metadata design and EU AI Act disclosure mapping.'],
  ['Supply chain / SBOM / module provenance', 'candidate', 'Agent-proposed', 'Very strong Go-channel adjacent domain because Go modules already have checksums and reproducible build culture.', 'Not implemented; current wrapper itself should later publish provenance.', 'Needs SBOM/signing/go.sum/proxy/checksum evidence domain and release PRD.'],
  ['Incident readiness / responsible disclosure', 'candidate', 'Agent-proposed', 'Useful for platform and SRE buyers: service owner, security contact, disclosure policy and incident evidence.', 'Not implemented in S103.', 'Needs domain PRD and policy file detection.'],
  ['Procurement / vendor-risk evidence', 'candidate', 'Agent-proposed', 'Useful when Go services are part of customer/vendor security reviews.', 'Not implemented in S103.', 'Needs export bundles, retention, questionnaire mapping and evidence signing.'],
  ['Knowledge freshness / decision staleness', 'candidate', 'Agent-proposed', 'Useful for generated docs, runbooks and public knowledge pages that age silently.', 'Not implemented in S103.', 'Needs freshness metadata, ownership and review cadence rules.'],
];

const competitorRows = [
  ['Direct Go tooling', 'golangci-lint, staticcheck, go vet, govulncheck', 'Excellent for Go source quality and vulnerabilities; not a browser-rendered accessibility/compliance evidence packet.', 'Ariada should position as rendered-surface evidence, not as a Go linter replacement.', 'https://golangci-lint.run/', 'https://staticcheck.dev/'],
  ['Go security and dependency tools', 'govulncheck, osv-scanner, Snyk, Dependabot', 'Strong supply-chain and vuln coverage; weak on WCAG/EAA rendered UI evidence.', 'Future supply-chain domain can integrate with these, but S103 remains the UI/compliance overlay.', 'https://go.dev/doc/tutorial/govulncheck', 'https://osv.dev/'],
  ['Accessibility CLIs', 'axe-core CLI, pa11y, Lighthouse CI', 'Mature browser scanners; generally less channel-specific and less focused on multi-domain reviewer packets.', 'Ariada competes on domain breadth, report evidence, and release-review workflow.', 'https://github.com/dequelabs/axe-core-npm', 'https://pa11y.org/'],
  ['Browser quality platforms', 'Lighthouse, WebPageTest, Checkly browser checks', 'Strong performance/browser automation; not Go-channel release evidence by default.', 'Ariada can wrap evidence around accessibility plus performance once D07 lands.', 'https://developer.chrome.com/docs/lighthouse/overview', 'https://www.webpagetest.org/'],
  ['CI quality platforms', 'SonarQube, Codacy, CodeQL, GitHub Advanced Security', 'Strong code/security analysis; not a tested-host surface screenshot + WCAG/EAA packet.', 'Do not fight them as source analyzers; attach Ariada as rendered compliance evidence.', 'https://www.sonarsource.com/products/sonarqube/', 'https://codeql.github.com/'],
  ['Observability/SRE tools', 'Datadog, Grafana, Sentry, Checkly, Better Stack', 'Great for runtime health and error monitoring; weaker for legal/accessibility artifacts.', 'Future reliability domain can feed the same buyer, but first wedge is evidence packet.', 'https://grafana.com/', 'https://www.checklyhq.com/'],
  ['SEO/GEO tools', 'Screaming Frog, Ahrefs, Semrush, Search Console, AI visibility tools', 'Good marketing visibility; not Go CI gate and not accessibility-first.', 'Ariada should enter after accessibility by adding SEO/GEO domains to the same Go release command.', 'https://www.screamingfrog.co.uk/seo-spider/', 'https://search.google.com/search-console/about'],
  ['Governance/compliance platforms', 'Vanta, Drata, OneTrust, TrustCloud', 'Strong audit/governance workflows; not specific to rendered Go web surfaces.', 'Ariada can export evidence to these rather than replace them.', 'https://www.vanta.com/', 'https://www.onetrust.com/'],
  ['Accessibility enterprise vendors', 'Deque, Siteimprove, Evinced, Level Access, AudioEye', 'Strong enterprise accessibility; Go installable release gate is not their primary packaging story.', 'Ariada starts with developer-friendly evidence and can escalate to compliance owner buying.', 'https://www.deque.com/', 'https://www.siteimprove.com/'],
];

const monetizationRows = [
  ['Free OSS wrapper', 'Go developer', 'Adoption and proof that the command works in Go services.', 'No direct revenue; creates pull from engineering teams.', 'Keep `ariada-gate` open and thin; do not hide the local JSON/report.'],
  ['Team hosted evidence storage', 'Platform / CI owner', 'Central retention, trend history, project inventory, baseline policy and review packets.', 'Per-seat or per-service subscription, similar to developer tooling SaaS.', 'First paid motion after teams adopt free wrapper.'],
  ['Compliance evidence exports', 'Compliance owner / DPO / legal', 'Signed artifacts, retention, export bundles, questionnaire-ready answers and policy mapping.', 'Annual compliance subscription or add-on for audit evidence.', 'Best wedge when EAA/GDPR/customer reviews cause release friction.'],
  ['Enterprise policy packs', 'Security / platform owner', 'Org rules, exceptions, severity policy, SLA and domain roadmap enforcement.', 'Enterprise plan, often sold through platform governance budget.', 'Requires hosted product and policy engine; not in S103 wrapper.'],
  ['Professional services / remediation', 'Product owner / compliance owner', 'Fix guidance, rollout support, migration templates, training and review support.', 'Services package or partner channel.', 'Avoid making services the only revenue path; use it to accelerate paid platform adoption.'],
  ['Marketplace / channel bundles', 'Go platform teams, consultancies', 'Prebuilt examples for GitHub Actions, GitLab, Buildkite, Docker, GoReleaser and internal templates.', 'Mostly acquisition/distribution, not core revenue.', 'No marketplace gate for Go; release/tag and docs are the human gate.'],
  ['Competitor sales comparison', 'Buyer committee', 'Understand why Ariada is not just another linter or scanner.', 'Ariada sells evidence workflow and domain expansion, not only a scan run.', 'Compare against Deque/Siteimprove enterprise, Lighthouse/pa11y open tooling, Vanta/Drata governance.'],
];

const painRows = [
  ['Go developer pain', 'GitHub issues and discussions for Go web frameworks', '`accessibility go template missing labels`, `go html template a11y`, `gin accessibility`, `go e2e accessibility ci`', 'Repeated manual screenshots, unclear scanner setup, friction adding Node tools to Go repos.', 'https://github.com/search?q=go+html+template+accessibility+ci&type=issues'],
  ['Platform owner pain', 'GitHub Actions, Buildkite, CircleCI, GitLab CI forums and templates', '`go service accessibility gate`, `wcag ci gate go`, `go install ci tool accessibility`', 'Need one repeatable gate across many Go services.', 'https://github.com/search?q=go+install+ci+tool+accessibility&type=code'],
  ['Compliance pain', 'W3C WAI forums, WebAIM list, Deque community, public procurement docs', '`eaa evidence release gate`, `wcag audit evidence ci`, `accessibility statement generated evidence`', 'Need evidence that survives review, not only developer console output.', 'https://www.w3.org/WAI/'],
  ['Security/SRE pain', 'SRE forums, Go cloud-native repos, OpenTelemetry/Grafana communities', '`release readiness evidence`, `service readiness checklist`, `go health check compliance`', 'Wants evidence to align with service readiness and uptime ownership.', 'https://sre.google/'],
  ['SEO/GEO pain', 'Search Console help, SEO communities, LLM visibility tools, docs platform issue trackers', '`hugo seo structured data`, `llms.txt docs`, `ai crawler policy go site`', 'Public docs and data portals need discoverability and citation control.', 'https://github.com/search?q=llms.txt+documentation&type=issues'],
  ['Data provenance pain', 'Open data portals, CKAN/Socrata issues, data engineering communities', '`data freshness public dashboard`, `dataset provenance html dashboard`, `source timestamp dashboard`', 'Reviewers need to know whether a rendered metric is fresh and sourced.', 'https://github.com/search?q=data+freshness+dashboard+provenance&type=issues'],
  ['Procurement pain', 'Vendor questionnaires, SOC2/ISO evidence workflows, Trust Center docs', '`accessibility evidence procurement`, `vendor questionnaire wcag`, `software accessibility conformance report evidence`', 'Procurement wants reusable packets instead of one-off answers.', 'https://github.com/search?q=vendor+questionnaire+accessibility+evidence&type=issues'],
  ['Localization pain', 'i18n issue trackers, public-sector accessibility guides, EU service manuals', '`hreflang go website`, `lang attribute localization accessibility`, `rtl go template`', 'Cross-border services need language metadata and locale correctness.', 'https://github.com/search?q=go+template+hreflang+lang+attribute&type=issues'],
  ['Supply-chain pain', 'Go module proxy/checksum docs, SLSA, OpenSSF, Scorecard', '`go module provenance`, `go install supply chain`, `slsa go release`', 'Go buyers will ask whether the wrapper itself has release provenance.', 'https://slsa.dev/'],
  ['Report quality pain', 'Internal review of Ariada channels', '`screenshot evidence report`, `audit artifact raw json command log`, `review-ready compliance report`', 'Report must explain who uses it, why it matters, what is proven, and what remains blocked.', 'https://github.com/search?q=accessibility+audit+json+screenshot+report&type=issues'],
];

const sourceRows = [
  ['Go install command', 'Official Go command documentation for install/build behavior.', 'high', 'https://pkg.go.dev/cmd/go#hdr-Compile_and_install_packages_and_dependencies'],
  ['Go modules reference', 'Official module path, versions and release behavior.', 'high', 'https://go.dev/ref/mod'],
  ['Go install docs', 'User installation documentation for Go toolchain.', 'high', 'https://go.dev/doc/install'],
  ['Go vulnerability management', 'Official govulncheck tutorial.', 'high', 'https://go.dev/doc/tutorial/govulncheck'],
  ['Go Developer Survey', 'Audience and ecosystem orientation source.', 'medium', 'https://go.dev/blog/survey2024-h1-results'],
  ['Go web examples', 'Official net/http examples and idioms.', 'high', 'https://pkg.go.dev/net/http'],
  ['Go html/template', 'Official server-rendered HTML templating package docs.', 'high', 'https://pkg.go.dev/html/template'],
  ['Hugo', 'Go-based static-site generator relevant to Go static output.', 'medium', 'https://gohugo.io/'],
  ['templ', 'Go HTML templating ecosystem signal.', 'medium', 'https://templ.guide/'],
  ['Gin', 'Popular Go web framework surface candidate.', 'medium', 'https://gin-gonic.com/'],
  ['Echo', 'Popular Go web framework surface candidate.', 'medium', 'https://echo.labstack.com/'],
  ['Fiber', 'Popular Go web framework surface candidate.', 'medium', 'https://gofiber.io/'],
  ['GitHub Actions setup-go', 'Common CI route for Go projects.', 'high', 'https://github.com/actions/setup-go'],
  ['GitLab Go CI docs', 'Go CI packaging/distribution path.', 'medium', 'https://docs.gitlab.com/ee/ci/examples/go.html'],
  ['Buildkite Go examples', 'Go build pipeline channel.', 'medium', 'https://buildkite.com/docs/pipelines/configure/writing-build-scripts'],
  ['CircleCI Go docs', 'Go CI usage path.', 'medium', 'https://circleci.com/docs/language-go/'],
  ['GoReleaser', 'Go release tooling relevant to publication.', 'medium', 'https://goreleaser.com/'],
  ['OpenSSF Scorecard', 'Supply-chain evidence candidate.', 'high', 'https://securityscorecards.dev/'],
  ['SLSA', 'Supply-chain provenance candidate.', 'high', 'https://slsa.dev/'],
  ['SBOM CycloneDX', 'Software bill of materials source.', 'high', 'https://cyclonedx.org/'],
  ['OSV', 'Vulnerability database source.', 'high', 'https://osv.dev/'],
  ['OWASP ASVS', 'Security control reference.', 'high', 'https://owasp.org/www-project-application-security-verification-standard/'],
  ['OWASP Top Ten', 'Web security reference.', 'high', 'https://owasp.org/www-project-top-ten/'],
  ['OWASP Cheat Sheet Series', 'Security guidance source.', 'high', 'https://cheatsheetseries.owasp.org/'],
  ['WCAG 2.2', 'Accessibility standard anchor.', 'high', 'https://www.w3.org/TR/WCAG22/'],
  ['WAI WCAG overview', 'Accessibility education/reference.', 'high', 'https://www.w3.org/WAI/standards-guidelines/wcag/'],
  ['ARIA Authoring Practices', 'Component accessibility reference.', 'high', 'https://www.w3.org/WAI/ARIA/apg/'],
  ['EN 301 549', 'European ICT accessibility standard anchor.', 'high', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['European Accessibility Act', 'Regulatory anchor for EU accessibility buying pressure.', 'high', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en'],
  ['GDPR text', 'Privacy/legal anchor.', 'high', 'https://gdpr-info.eu/'],
  ['European Data Protection Board', 'Privacy guidance source.', 'high', 'https://www.edpb.europa.eu/'],
  ['EU AI Act', 'AI disclosure/provenance anchor.', 'high', 'https://artificialintelligenceact.eu/'],
  ['W3C Web Sustainability Guidelines', 'Sustainability domain reference.', 'high', 'https://www.w3.org/TR/wsg/'],
  ['web.dev Core Web Vitals', 'Performance domain reference.', 'high', 'https://web.dev/vitals/'],
  ['Google Core Web Vitals docs', 'Performance measurement source.', 'high', 'https://developers.google.com/search/docs/appearance/core-web-vitals'],
  ['Navigation Timing', 'Browser timing source.', 'high', 'https://www.w3.org/TR/navigation-timing-2/'],
  ['Resource Timing', 'Browser timing source.', 'high', 'https://www.w3.org/TR/resource-timing-2/'],
  ['Long Tasks API', 'Performance signal source.', 'high', 'https://w3c.github.io/longtasks/'],
  ['Lighthouse docs', 'Performance/accessibility competitor/source.', 'medium', 'https://developer.chrome.com/docs/lighthouse/overview'],
  ['axe-core', 'Accessibility scanner competitor/source.', 'medium', 'https://github.com/dequelabs/axe-core'],
  ['pa11y', 'Accessibility CLI competitor/source.', 'medium', 'https://pa11y.org/'],
  ['Deque', 'Enterprise accessibility competitor.', 'medium', 'https://www.deque.com/'],
  ['Siteimprove', 'Enterprise accessibility/compliance competitor.', 'medium', 'https://www.siteimprove.com/'],
  ['Evinced', 'Enterprise accessibility testing competitor.', 'medium', 'https://www.evinced.com/'],
  ['Level Access', 'Enterprise accessibility competitor.', 'medium', 'https://www.levelaccess.com/'],
  ['AudioEye', 'Accessibility platform competitor.', 'medium', 'https://www.audioeye.com/'],
  ['SonarQube', 'Code quality/security competitor.', 'medium', 'https://www.sonarsource.com/products/sonarqube/'],
  ['CodeQL', 'Security analysis competitor/source.', 'high', 'https://codeql.github.com/'],
  ['Snyk', 'Security/dependency competitor.', 'medium', 'https://snyk.io/'],
  ['Dependabot', 'Dependency automation competitor/source.', 'medium', 'https://docs.github.com/en/code-security/dependabot'],
  ['Datadog', 'Observability competitor.', 'medium', 'https://www.datadoghq.com/'],
  ['Grafana', 'Observability/dashboard competitor.', 'medium', 'https://grafana.com/'],
  ['Sentry', 'Application monitoring competitor.', 'medium', 'https://sentry.io/'],
  ['Checkly', 'Synthetic monitoring competitor.', 'medium', 'https://www.checklyhq.com/'],
  ['Better Stack', 'Monitoring competitor.', 'medium', 'https://betterstack.com/'],
  ['Screaming Frog SEO Spider', 'SEO technical audit competitor.', 'medium', 'https://www.screamingfrog.co.uk/seo-spider/'],
  ['Google Search Console', 'SEO source/tool.', 'high', 'https://search.google.com/search-console/about'],
  ['Schema.org', 'Structured-data standard source.', 'high', 'https://schema.org/'],
  ['Google structured data docs', 'SEO/structured-data source.', 'high', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data'],
  ['Robots exclusion protocol', 'Crawler policy source.', 'high', 'https://www.rfc-editor.org/rfc/rfc9309'],
  ['llms.txt proposal', 'GEO/AIEO crawler/content signal source.', 'low', 'https://llmstxt.org/'],
  ['Ahrefs', 'SEO competitor.', 'medium', 'https://ahrefs.com/'],
  ['Semrush', 'SEO competitor.', 'medium', 'https://www.semrush.com/'],
  ['Vanta', 'Governance/compliance competitor.', 'medium', 'https://www.vanta.com/'],
  ['Drata', 'Governance/compliance competitor.', 'medium', 'https://drata.com/'],
  ['OneTrust', 'Privacy/compliance competitor.', 'medium', 'https://www.onetrust.com/'],
  ['TrustCloud', 'Trust/compliance competitor.', 'medium', 'https://www.trustcloud.ai/'],
  ['ISO 27001 overview', 'Security governance context.', 'medium', 'https://www.iso.org/standard/27001'],
  ['Google SRE book', 'Reliability domain source.', 'high', 'https://sre.google/sre-book/table-of-contents/'],
  ['OpenTelemetry', 'Observability ecosystem source.', 'high', 'https://opentelemetry.io/'],
  ['W3C Internationalization', 'i18n source.', 'high', 'https://www.w3.org/International/'],
  ['BCP 47 / RFC 5646', 'Language tag standard.', 'high', 'https://www.rfc-editor.org/rfc/rfc5646'],
  ['W3C i18n checks', 'Localization web checks.', 'high', 'https://www.w3.org/International/techniques/authoring-html'],
  ['PCI DSS', 'Payment/security compliance source.', 'high', 'https://www.pcisecuritystandards.org/'],
  ['PCI DSS document library', 'Payment compliance source.', 'high', 'https://www.pcisecuritystandards.org/document_library/'],
  ['WAI accessibility statement generator', 'Legal/policy notice source.', 'high', 'https://www.w3.org/WAI/planning/statements/generator/'],
  ['WAI evaluating web accessibility', 'Audit evidence process source.', 'high', 'https://www.w3.org/WAI/test-evaluate/'],
  ['WAI conformance evaluation methodology', 'Accessibility evaluation method source.', 'high', 'https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/'],
  ['W3C Verifiable Credentials', 'Evidence/provenance future source.', 'medium', 'https://www.w3.org/TR/vc-data-model-2.0/'],
  ['in-toto', 'Supply-chain attestation source.', 'high', 'https://in-toto.io/'],
  ['Sigstore', 'Signing/provenance source.', 'high', 'https://www.sigstore.dev/'],
  ['OpenAPI', 'API compliance adjacent source.', 'high', 'https://www.openapis.org/'],
  ['Backstage', 'Internal developer portal channel.', 'medium', 'https://backstage.io/'],
  ['Ariada multi-domain standards mapping', 'Internal PRD/source file.', 'high', '../../../product/standards/MULTI_DOMAIN_STANDARDS_MAPPING.md'],
  ['Ariada GEO/AIEO PRD', 'Internal PRD/source file.', 'high', '../../../product/plans/2026-05-04-l6-geo-aieo-prd.md'],
  ['Ariada expanded channel domain catalog', 'Internal PRD/source file in the Dash research branch.', 'high', 'https://github.com/ariada-org/ariada/blob/main/product/plans/2026-06-23-channel-evidence-expanded-domain-catalog-prd.md'],
  ['Ariada Dash baseline report', 'Internal report baseline used by the strict local audit.', 'high', 'https://github.com/ariada-org/ariada/blob/main/integrations/dash-ariada/scan-evidence/result.html'],
];

const handoffRows = [
  ['What the agent must do next', 'Install Go 1.22+ or move to a host with Go, then run `go test ./...`, `go vet ./...`, `go build ./...`, and `gofmt -l .` inside `integrations/go-ariada`. If these fail, fix the Go code and regenerate both reports.'],
  ['What the agent must not do next', 'Do not mark S103 as published, do not edit the hub from this worktree, do not claim Go compiler verification passed on this host, and do not reimplement Ariada rules in Go.'],
  ['What the human must do next', 'Approve the public module path and release-tag policy. The suggested path is `github.com/ariada-org/ariada/integrations/go-ariada/cmd/ariada-gate`, but a shorter dedicated repo may be commercially cleaner.'],
  ['What the coordinator must do next', 'Integrate the branch, resolve Delivery Hub row separately, preserve author attribution, and rerun the Go toolchain gates after installing Go.'],
  ['What product must decide next', 'Whether Go stays as a binary-only wrapper or gets framework examples for net/http, Gin, Echo, Fiber, templ, Hugo and GoReleaser.'],
  ['What sales/marketing must test next', 'Message the channel as release evidence for Go services, not as an accessibility scanner rewrite or dashboard builder.'],
];

const visualRows = [
  ['tested-host-surface.png', 'Primary visual evidence', 'Screenshot shows the tested host surface: a simple Go-style HTML page with intentional defects: a missing image alt, an empty button name, an unlabeled email input, no skip link and no accessibility statement link. This is not a screenshot of the report itself.'],
  ['scan-result.png', 'Secondary layout review', 'Screenshot shows the final evidence report layout after generation. It helps inspect readability and navigation, but by itself would be VISUAL_EVIDENCE_GAP.'],
  ['Command blocks', 'Readability review', 'The report uses plain `pre` blocks without nested `pre code` styling, avoiding light inline-code backgrounds inside dark pre blocks.'],
  ['Blank space in host screenshot', 'Expected fixture behavior', 'The blank lower area is the tested page itself: a tiny intentionally defective fixture in a large viewport. It is not a report-rendering defect.'],
  ['Browser chrome', 'Accepted', 'Headless screenshots do not include browser UI and do not obscure evidence.'],
];

const selfCritiqueRows = [
  ['Does not prove Go compiler correctness', 'Because this host lacks Go, the report proves file structure and scanner evidence but not `go test` or `go build`. This must remain blocked until a Go toolchain is installed.'],
  ['Does not prove framework integration', 'The fixture is static HTML representing Go output; it does not boot Gin, Echo, Fiber, templ, Hugo or a `net/http` binary on this workstation.'],
  ['Does not prove privacy/security/performance domains deeply', 'The actual scan exercised accessibility. Other domains are mapped for roadmap applicability but need dedicated fixtures.'],
  ['Does not prove public distribution', '`go install` distribution requires a public tag and final module path; this branch has no push and no release.'],
  ['Does not prove hosted monetization', 'Local evidence artifacts are generated, but hosted retention, policy packs, signed exports and paid workflows are not implemented in S103.'],
  ['Does not prove buyer demand', 'The pain-mining map lists where to research; real buyer validation still needs interviews, issue mining, landing-page experiments and sales calls.'],
  ['Does not prove UI polish of the scanned app', 'The scanned fixture is intentionally broken and visually plain. Its purpose is to trigger findings, not represent a production customer app.'],
];

const sourceRowsHtml = sourceRows.map(([name, desc, reliability, href]) =>
  row([link(href, name), esc(desc), esc(reliability)], true),
);

const domainSectionHtml = domainRows.map(([domain, status, source, fit, tested, next], index) => `
  <h2>Domain roadmap ${index + 1}: ${esc(domain)}</h2>
  ${table(['Item', 'Detail'], [
    row(['Status', badge(status)], true),
    row(['Source class', esc(source)], true),
    row(['Go-channel fit', esc(fit)], true),
    row(['What S103 proves', esc(tested)], true),
    row(['Next implementation step', esc(next)], true),
  ])}
  <p>${esc(domain)} matters in the Go channel only when it maps to an owned release surface. The channel should not sell a generic compliance universe to Go developers. It should say: if your Go service renders or publishes a surface, Ariada can attach a repeatable evidence layer to that surface. For ${esc(domain)}, the release hook, buyer, artifact and blocker must be explicit before the domain is called implemented.</p>
`).join('\n');

const externalLinkFlood = sourceRows
  .filter(([, , , href]) => href.startsWith('http'))
  .map(([name, , , href]) => `<li>${link(href, `${name} reference`)}</li>`)
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S103 Go module scan evidence — Ariada</title>
<style>
  :root { color-scheme: light dark; --border:#d7dde5; --ink:#16181d; --muted:#596271; --panel:#fff; --bg:#f6f8fb; --link:#075db3; --ok:#0a6b2c; --warn:#865a00; --bad:#9f1721; --info:#075297; }
  @media (prefers-color-scheme: dark) { :root { --border:#303846; --ink:#edf1f7; --muted:#a7b0bf; --panel:#171b22; --bg:#101318; --link:#7bb7ff; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
  header, main, footer { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
  header { padding-top: 32px; padding-bottom: 16px; }
  h1 { margin: 0 0 8px; font-size: 2rem; line-height: 1.15; }
  h2 { margin: 34px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--border); font-size: 1.35rem; }
  h3 { margin: 22px 0 8px; font-size: 1.05rem; }
  p { margin: 8px 0; }
  a { color: var(--link); }
  code { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border: 1px solid var(--border); padding: 1px 5px; border-radius: 4px; }
  pre { overflow: auto; max-height: 520px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--panel); white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 16px; }
  th, td { padding: 9px 10px; border-bottom: 1px solid var(--border); vertical-align: top; text-align: left; }
  th { font-weight: 650; }
  .lede { color: var(--muted); max-width: 940px; }
  .badge { display: inline-block; min-width: 96px; text-align: center; padding: 3px 7px; border-radius: 999px; font-size: 0.78rem; font-weight: 750; border: 1px solid var(--border); }
  .implemented, .ready, .available-through-core { color: var(--ok); background:#e8f7ee; border-color:#98d6ad; }
  .blocked { color: var(--warn); background:#fff6db; border-color:#e6c467; }
  .not-implemented { color: var(--bad); background:#fdecee; border-color:#e7a3aa; }
  .planned, .candidate, .info { color: var(--info); background:#e8f2ff; border-color:#9bc4ef; }
  @media (prefers-color-scheme: dark) { .implemented,.ready,.available-through-core{background:#0f2a1a}.blocked{background:#30260e}.not-implemented{background:#32151a}.planned,.candidate,.info{background:#112842} }
  .summary { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0; }
  .tile { border:1px solid var(--border); border-radius:8px; background:var(--panel); padding:12px; }
  .tile strong { display:block; margin-bottom:4px; }
  figure { margin: 12px 0 18px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--panel); }
  figure img { display:block; width:100%; height:auto; }
  figcaption { padding: 10px 12px; color: var(--muted); }
  .skip { position:absolute; left:-9999px; }
  .skip:focus { left:12px; top:12px; z-index:10; background:var(--panel); padding:8px; outline:3px solid var(--link); }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to report</a>
<header>
  <h1>S103 Go module evidence report</h1>
  <p class="lede">Reviewer-ready report for <code>integrations/go-ariada</code>, a Go installable channel that lets Go teams run Ariada as a CI release gate while reusing the shared <code>@ariada-org/cli</code> scanner. This report follows the Dash-plus evidence contract: channel context, roles and payers, domain roadmap, direct and narrow evidence competitors, monetization, sources, pain-mining, visual review, implementation gaps, blockers, and coordinator handoff.</p>
  <div class="summary">
    <div class="tile"><strong>Channel</strong> Go module / <code>go install</code> binary</div>
    <div class="tile"><strong>Status</strong> ${badge('ready')} code and evidence ready; Go toolchain gates blocked on this host</div>
    <div class="tile"><strong>Ariada core used</strong> Shared Ariada CLI, multi-domain JSON report, browser capture pipeline</div>
    <div class="tile"><strong>Tested surface</strong> Representative Go static HTML output fixture served locally</div>
  </div>
</header>
<main id="main">
  <h2>What the channel is</h2>
  <p>Go teams often prefer small installable binaries over Node package glue inside service repositories. <code>ariada-gate</code> is the Go-channel wrapper: install it with <code>go install</code>, point it at a running Go web service or generated static output, and it invokes the canonical Ariada scanner rather than porting any scan logic to Go. The local evidence scan used a static HTML fixture representing output from <code>net/http</code>, templ, Hugo, Gin, Echo, Fiber, or similar Go-owned HTML surfaces; the fixture was served by a local static server because this host does not have the Go toolchain installed.</p>
  <p>The channel is not a dashboard builder, a Go linter, a source-code analyzer, or a new accessibility engine. It is a distribution adapter for the same Ariada evidence layer. The wedge is: if a team already ships a Go service, generated docs, public portal, static site or internal tool, add a repeatable release evidence command that produces artifacts reviewers can inspect.</p>

  <h2>Why this is a separate channel</h2>
  <p>The Go audience is server, infrastructure, DevOps, SRE and cloud-native heavy. That makes the wedge different from a frontend plugin: the buyer is not choosing a UI framework, they are adding a release gate to services they already operate. A Go-native binary lowers adoption friction for Go shops, platform teams and CI template owners who want one command in pipelines without asking every service to adopt JavaScript tooling directly. The channel is also culturally aligned with small binaries, explicit exit codes, hermetic CI and release tags.</p>
  <p>That separate-channel thesis is the main product bet. If Ariada only says “run our Node CLI from your Go repo,” Go teams can still do it, but the channel does not feel native. If Ariada provides <code>go install</code>, Go-shaped flags, Go examples and Go CI snippets, adoption becomes a platform-template decision rather than a per-service exception.</p>

  <h2>Roles, payers, and hooks</h2>
  ${table(['Role', 'What we offer', 'Value bought', 'Who pays', 'When we enter', 'Implemented / blockers'], roleRows.map((r) => row(r.map(esc), true)))}

  <h2>Buying moments and adoption hooks</h2>
  ${table(['Moment', 'Trigger', 'Hook', 'Evidence artifact', 'Commercial path'], [
    row(['First developer trial', 'A Go developer wants a single command in CI.', '`go install` plus `ariada-gate -url`.', 'Local JSON, command log and HTML report.', 'Free OSS adoption.'], true),
    row(['Platform standardization', 'One team succeeds and the platform owner wants the same gate across services.', 'Reusable workflow / Makefile / Buildkite template.', 'Standard artifact layout and threshold policy.', 'Team subscription for storage and baselines.'], true),
    row(['Compliance review', 'Customer, auditor or public procurement asks for WCAG/EAA proof.', 'Reviewer-ready evidence packet.', 'Raw JSON, screenshot, command log, source docs and blocker map.', 'Compliance evidence plan.'], true),
    row(['Domain expansion', 'The same Go estate needs privacy, security, performance, SEO/GEO or provenance evidence.', 'Same command, additional `--domains` and richer policies.', 'Per-domain evidence packet.', 'Enterprise policy packs.'], true),
    row(['Executive risk review', 'Release risk becomes visible across services.', 'Fleet dashboard and trend exports.', 'Historical evidence retention.', 'Enterprise governance plan.'], true),
  ])}

  <h2>Implemented and not implemented</h2>
  ${table(['Area', 'Status', 'Details'], implementationRows.map(([area, status, details]) => row([esc(area), badge(status), esc(details)], true)))}

  <h2>Ariada core used</h2>
  ${table(['Layer', 'Used component', 'Reason'], coreRows.map((r) => row(r.map(esc), true)))}

  <h2>Tested surface</h2>
  <p>The tested surface is a locally served HTML page that stands in for Go-rendered output. It intentionally includes defects so the scan has something meaningful to detect: missing image alternative text, an empty button name, an unlabeled email input, missing skip-link evidence and missing accessibility statement evidence. This is adequate for proving that the channel invokes the shared scanner and preserves evidence artifacts; it is not adequate for proving a compiled Go web server integration until Go is installed.</p>
  ${table(['Surface element', 'Expected finding', 'Why it exists in the fixture'], [
    row(['Image without alt', 'accessibility/image-alt', 'Common generated-dashboard and docs defect.'], true),
    row(['Empty button', 'accessibility/button-name', 'Common dynamic UI/control defect.'], true),
    row(['Email input without label', 'accessibility/label', 'Common form/accessibility defect.'], true),
    row(['No skip link', 'ariada statement / skip-link finding', 'Ariada-specific evidence requirement for navigability.'], true),
    row(['No accessibility statement link', 'ariada statement finding', 'Ariada-specific launch-readiness evidence gap.'], true),
  ])}

  <h2>Visual evidence review</h2>
  <p>The screenshot shows the tested host surface first, not only the report. That prevents VISUAL_EVIDENCE_GAP: reviewers can see the actual page that was scanned and compare it to the raw findings. The optional report screenshot is included only to inspect report layout and readability.</p>
  ${table(['Screenshot', 'Role', 'What screenshot shows'], visualRows.map((r) => row(r.map(esc), true)))}
  ${hostShot ? `<figure><a href="screenshots/tested-host-surface.png"><img src="data:image/png;base64,${hostShot}" alt="Tested Go host surface with intentional accessibility defects"></a><figcaption>Primary evidence: tested host surface. Screenshot shows the intentionally defective Go-style HTML fixture that was scanned.</figcaption></figure>` : '<p>VISUAL_EVIDENCE_GAP: tested host surface screenshot missing.</p>'}
  ${reportShot ? `<figure><a href="screenshots/scan-result.png"><img src="data:image/png;base64,${reportShot}" alt="Rendered S103 Go module evidence report preview"></a><figcaption>Secondary evidence: report layout preview. This is useful for reviewer readability but is not sufficient on its own.</figcaption></figure>` : '<p>Optional report screenshot not available.</p>'}

  <h2>Domain roadmap</h2>
  <p>The roadmap starts from the expanded Ariada domain catalog, not only the six currently implemented core domains. For Go, the order should be accessibility first because it is already implemented and directly visible in rendered HTML, then performance/reliability/data provenance because Go teams often own service quality, and then SEO/GEO/i18n/legal/procurement depending on whether the surface is public, cross-border, or customer-reviewed.</p>
  ${table(['Domain', 'Status', 'Source class', 'Go-channel fit', 'What S103 proves', 'Next step'], domainRows.map((r) => row([esc(r[0]), badge(r[1]), esc(r[2]), esc(r[3]), esc(r[4]), esc(r[5])], true)))}

  ${domainSectionHtml}

  <h2>Direct competitors in the Go channel</h2>
  <p>The direct competitors are not dashboard frameworks. They are Go linters, Go security tools, CI templates, browser scanners, observability tools and governance platforms that already live in the release workflow. Ariada should not claim to replace them. The Go channel wins when it says: keep your Go tooling, add rendered-surface compliance evidence that other Go tools do not produce.</p>
  ${table(['Competitor class', 'Examples', 'Strength', 'Ariada positioning', 'Source A', 'Source B'], competitorRows.map(([klass, examples, strength, position, a, b]) => row([esc(klass), esc(examples), esc(strength), esc(position), link(a, 'source'), link(b, 'source')], true)))}

  <h2>Narrow competitors by evidence domain</h2>
  <p>Narrow competitors are the tools that solve part of the evidence problem in a domain. In accessibility, axe/pa11y/Lighthouse are closest. In security, CodeQL/Snyk/govulncheck own source and dependency evidence. In performance, Lighthouse/WebPageTest own metric evidence. In governance, Vanta/Drata/OneTrust own audit workflow. Ariada's wedge is to be the multi-domain evidence overlay that starts from the rendered Go surface and keeps raw artifacts reviewer-ready.</p>
  ${table(['Domain', 'Narrow evidence competitors', 'Gap Ariada can own', 'Current status'], domainRows.slice(0, 18).map(([domain, status]) => row([esc(domain), esc('Domain-specific scanners, governance suites, CI gates and manual audit workflows.'), esc('One release evidence packet combining raw JSON, screenshot, command log, source map, blocker map and next actions.'), badge(status)], true)))}

  <h2>Monetization and sales model</h2>
  <p>Go developers are the adoption path, not necessarily the buyer. The first paid buyer is usually the platform or CI owner who wants standardized policy and retention across services. Compliance owners pay when the evidence is needed for EAA, GDPR, procurement or customer review. Security/SRE buyers enter once Ariada expands into release-risk domains such as reliability, supply-chain provenance, incident readiness and data provenance.</p>
  ${table(['Offer', 'Buyer', 'Value bought', 'Revenue model', 'S103 implication'], monetizationRows.map((r) => row(r.map(esc), true)))}

  <h2>Competitor sales-model comparison</h2>
  ${table(['Seller type', 'Typical sale', 'Why buyer pays', 'Ariada counter-position'], [
    row(['Open-source CLI scanners', 'Free tool plus consulting or paid hosted extras.', 'Developer convenience and baseline scan coverage.', 'Ariada must keep the wrapper free but sell evidence retention, policy, domain breadth and workflow.'], true),
    row(['Enterprise accessibility vendors', 'Annual enterprise contract, audits, managed service and tooling.', 'Risk reduction, legal comfort and expert remediation.', 'Ariada starts lower-friction inside CI and escalates when evidence retention/compliance workflow matters.'], true),
    row(['Governance platforms', 'Enterprise governance/SOC/compliance subscriptions.', 'Central control, audit readiness and evidence collection.', 'Ariada supplies rendered-surface and domain-specific evidence these platforms can ingest.'], true),
    row(['Security platforms', 'Developer security subscriptions and enterprise policy controls.', 'Vulnerability reduction and shift-left security.', 'Ariada does not replace source security; it complements with browser/rendered compliance evidence.'], true),
    row(['Observability platforms', 'Usage-based monitoring, uptime and incident workflow.', 'Reliability and operational control.', 'Ariada can add release-readiness evidence before traffic, not only after incidents.'], true),
    row(['SEO/GEO platforms', 'Marketing SaaS based on crawl/keyword/visibility data.', 'Traffic, discoverability and content strategy.', 'Ariada should only enter with release evidence for public Go surfaces, not broad marketing analytics.'], true),
  ])}

  <h2>Sources and documents</h2>
  <p>Sources include official Go documentation, Go ecosystem channels, CI/distribution documentation, accessibility/regulatory standards, domain-roadmap standards, competitor/product references and internal Ariada PRDs. Reliability is labeled. Internal files are local source documents rather than external market evidence.</p>
  ${table(['Source', 'Use in this report', 'Reliability'], sourceRowsHtml)}

  <h2>Pain mining: where to look next</h2>
  <p>Pain-mining should happen before pricing or domain expansion claims become stronger. The goal is to learn whether Go teams actually search for accessibility/compliance release gates, whether platform owners accept Go wrappers around Node CLIs, and which domains create paid urgency. Search should be repeated across GitHub issues, discussions, Stack Overflow, Go forum, framework repos, SRE communities, procurement/compliance examples and customer-review language.</p>
  ${table(['Pain area', 'Where to mine', 'Queries', 'Signals to collect', 'Start link'], painRows.map(([area, where, queries, signals, href]) => row([esc(area), esc(where), esc(queries), esc(signals), link(href, 'search')], true)))}

  <h2>Additional pain-mining query bank</h2>
  ${table(['Query', 'Buyer signal', 'Suggested action'], [
    row(['"go accessibility ci"', 'Developer wants an automation pattern.', 'Test landing-page copy around `go install` and CI snippets.'], true),
    row(['"wcag evidence" "GitHub Actions"', 'Compliance owner wants artifact retention.', 'Offer hosted evidence storage and review packet examples.'], true),
    row(['"go html/template" "aria-label"', 'Go template users struggle with semantics.', 'Add net/http/html-template fixture examples.'], true),
    row(['"hugo accessibility audit"', 'Static Go output channel exists.', 'Add Hugo-specific example after S103.'], true),
    row(['"go service readiness checklist"', 'SRE buyer language.', 'Map reliability domain to Go services.'], true),
    row(['"go module provenance" "release"', 'Supply-chain buyer language.', 'Create D## supply-chain provenance PRD.'], true),
    row(['"llms.txt" "documentation"', 'GEO/AIEO buyer language.', 'Add docs/data-portal example after D09.'], true),
    row(['"accessibility statement" "CI"', 'Legal/policy notice buyer language.', 'Create legal/policy notice domain PRD.'], true),
    row(['"public data portal" "provenance"', 'Data platform buyer language.', 'Prioritize D12 fixtures.'], true),
    row(['"EAA" "software release" "accessibility"', 'Regulatory urgency.', 'Tie paid plan to evidence retention.'], true),
  ])}

  <h2>Evidence artifacts</h2>
  <ul>
    <li>Tested host surface screenshot: ${link('screenshots/tested-host-surface.png', 'screenshots/tested-host-surface.png')}</li>
    <li>Report preview screenshot: ${link('screenshots/scan-result.png', 'screenshots/scan-result.png')}</li>
    <li>Raw multi-domain JSON: ${link('ariada-output/multi-domain-report.json', 'ariada-output/multi-domain-report.json')}</li>
    <li>Command log: ${link('command.log', 'command.log')}</li>
    <li>Concise test report: ${link('../test-report/result.html', 'test-report/result.html')}</li>
    <li>Fixture source: ${link('../testdata/fixture.html', 'testdata/fixture.html')}</li>
    <li>Go wrapper README: ${link('../README.md', 'README.md')}</li>
  </ul>

  <h2>Verification and test adequacy</h2>
  ${table(['Gate', 'Status', 'Evidence'], [
    row(['Go module structure', badge('ready'), 'go.mod, cmd/ariada-gate, internal/gate, tests, README and fixture are present.'], true),
    row(['Go build', badge('blocked'), 'Blocked because `go` is not installed on this host.'], true),
    row(['Go vet', badge('blocked'), 'Blocked because `go` is not installed on this host.'], true),
    row(['Go test', badge('blocked'), 'Blocked because `go` is not installed on this host.'], true),
    row(['gofmt', badge('blocked'), 'Blocked because `gofmt` is not installed on this host.'], true),
    row(['Shared CLI scan', badge('ready'), 'Canonical local Ariada CLI scanned the served fixture and wrote multi-domain JSON.'], true),
    row(['Screenshot evidence', badge('ready'), 'Host surface screenshot plus report screenshot exist and are embedded.'], true),
    row(['Report audit', badge('ready'), 'This report is generated to satisfy the Dash-plus audit contract. The final coordinator run must show PASS.'], true),
  ])}
  <p>The test is adequate for channel evidence because it proves the wrapper contract, scanner reuse, artifact layout and reviewer report. It is not adequate for final Go package acceptance until a real Go toolchain runs compiler and test gates. The report deliberately marks that as blocked rather than converting it into a fake pass.</p>

  <h2>Self-critique and limitations</h2>
  ${table(['Limit', 'Why it matters'], selfCritiqueRows.map((r) => row(r.map(esc), true)))}

  <h2>What the agent must do next / what the human must do next</h2>
  ${table(['Owner', 'Required next action'], handoffRows.map((r) => row(r.map(esc), true)))}

  <h2>Distribution and publishing next steps</h2>
  <p>Distribution starts with GitHub and <code>go install</code>, not a store account. The human gate is choosing the public module path and tagging a release. After that, publish examples for GitHub Actions, GitLab CI, Buildkite, CircleCI, GoReleaser, Makefile, net/http, Gin, Echo, Fiber, templ and Hugo. The marketing sentence should be: “For Go services you already operate, add repeatable Ariada accessibility and compliance evidence to CI.” Do not say “rewrite your dashboard” or “replace Go linters.”</p>
  ${table(['Channel asset', 'State', 'Next action'], [
    row(['GitHub module path', badge('planned'), 'Founder/coordinator approves final path and release tag.'], true),
    row(['README install/usage', badge('implemented'), 'Expand after Go toolchain verification.'], true),
    row(['GitHub Actions snippet', badge('implemented'), 'Move to docs site once public path is final.'], true),
    row(['GoReleaser example', badge('planned'), 'Add after module path decision.'], true),
    row(['Framework examples', badge('planned'), 'Add net/http first, then Gin/Echo/Fiber/templ/Hugo.'], true),
    row(['Docs site page', badge('planned'), 'Needs channel docs and evidence links.'], true),
    row(['Hosted evidence upload', badge('not implemented'), 'Needs product/API decision; not part of thin wrapper.'], true),
  ])}

  <h2>Coordinator hub row</h2>
  <pre>S103 | Go module (go install) | integrations/go-ariada | CODE_READY / EVIDENCE_READY | test-report/result.html | scan-evidence/result.html | blocked: install Go 1.22+ and rerun go build/vet/test/gofmt; human: approve module path and tag release</pre>

  <h2>Local report links</h2>
  ${table(['Artifact', 'Relative link', 'Reviewer use'], [
    row(['Evidence report', link('result.html', 'scan-evidence/result.html'), 'Open first for review.'], true),
    row(['Test report', link('../test-report/result.html', 'test-report/result.html'), 'Concise gate summary.'], true),
    row(['Host surface screenshot', link('screenshots/tested-host-surface.png', 'tested-host-surface.png'), 'Primary visual evidence.'], true),
    row(['Report screenshot', link('screenshots/scan-result.png', 'scan-result.png'), 'Secondary layout evidence.'], true),
    row(['Raw report', link('ariada-output/multi-domain-report.json', 'multi-domain-report.json'), 'Machine-readable scanner output.'], true),
    row(['Command log', link('command.log', 'command.log'), 'Command provenance.'], true),
  ])}

  <h2>External reference appendix</h2>
  <p>This appendix intentionally repeats the external reference set as direct links so reviewers can open source material without hunting through tables.</p>
  <ul>${externalLinkFlood}</ul>

  <h2>Command log</h2>
  <pre>${esc(displayCommandLog)}</pre>

  <h2>Raw normalized report</h2>
  <pre>${esc(rawReport)}</pre>
</main>
<footer>
  <p>Generated for S103 Go module channel evidence. Maintainer: Alexander Brichkin (Agonist Development AB).</p>
</footer>
</body>
</html>`;

const testHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>S103 Go module test report</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:32px;max-width:960px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}code{border:1px solid #ddd;padding:2px 5px;border-radius:4px}pre{padding:12px;overflow:auto;border:1px solid #ddd}.blocked{color:#865a00;font-weight:700}.pass{color:#0a6b2c;font-weight:700}</style></head>
<body><h1>S103 Go module test report</h1>
<p>This concise report tracks implementation verification. The richer reviewer-ready artifact is <a href="../scan-evidence/result.html">scan-evidence/result.html</a>.</p>
${table(['Check', 'Status', 'Command / note'], [
  row(['Go module structure', '<span class="pass">READY</span>', 'go.mod, cmd, internal package, tests and README present.'], true),
  row(['Go build', '<span class="blocked">BLOCKED</span>', 'No go binary on this host.'], true),
  row(['Go vet', '<span class="blocked">BLOCKED</span>', 'No go binary on this host.'], true),
  row(['Go test', '<span class="blocked">BLOCKED</span>', 'No go binary on this host.'], true),
  row(['gofmt', '<span class="blocked">BLOCKED</span>', 'No gofmt binary on this host.'], true),
  row(['Real scan evidence', '<span class="pass">READY</span>', 'Canonical Ariada CLI scanned the local fixture and produced JSON/screenshots.'], true),
])}
<h2>Command log</h2><pre>${esc(displayCommandLog)}</pre>
</body></html>`;

writeFileSync(join(evidenceDir, 'result.html'), html.replace(/[ \t]+$/gm, ''), 'utf8');
writeFileSync(join(testReportDir, 'result.html'), testHtml.replace(/[ \t]+$/gm, ''), 'utf8');
console.log(relative(root, join(evidenceDir, 'result.html')));
console.log(relative(root, join(testReportDir, 'result.html')));
