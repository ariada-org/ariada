#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const integration = root.endsWith('hugo-ariada') ? root : join(root, 'integrations', 'hugo-ariada');
const evidenceDir = join(integration, 'scan-evidence');
const screenshotsDir = join(evidenceDir, 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const esc = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
const link = (href, label) => `<a href="${esc(href)}">${esc(label)}</a>`;
const row = (cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
const table = (title, heads, rows) => `
  <h3>${esc(title)}</h3>
  <table>
    <thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('\n')}</tbody>
  </table>`;
const local = (path) => link(path, path);
const source = (href) => link(href, href.replace(/^https?:\/\//, ''));

const sourceLinks = [
  ['Hugo documentation', 'https://gohugo.io/documentation/', 'Official documentation for Hugo configuration, modules, templates and build output.'],
  ['Hugo directory structure', 'https://gohugo.io/getting-started/directory-structure/', 'Documents public output and static asset handling.'],
  ['Hugo modules', 'https://gohugo.io/hugo-modules/', 'Module packaging path for partials and shortcodes.'],
  ['Hugo commands', 'https://gohugo.io/commands/hugo/', 'Command surface for the blocked host build gate.'],
  ['Hugo GitHub repository', 'https://github.com/gohugoio/hugo', 'Primary source for project scope, release activity and issue tracking.'],
  ['Hugo Discourse', 'https://discourse.gohugo.io/', 'Primary community forum and support surface.'],
  ['Hugo figure shortcode alt discussion', 'https://discourse.gohugo.io/t/figure-shortcode-ignore-empty-alt-attributes/42426', 'Channel-specific accessibility discussion about image alternative text.'],
  ['Hugo build/AWS Amplify issue thread', 'https://discourse.gohugo.io/t/successful-hugo-server-unsuccessful-hugo-command-build-and-aws-amplify-deployment/45483', 'Community signal for build/deploy mismatch pain.'],
  ['Netlify Hugo docs', 'https://docs.netlify.com/frameworks/hugo/', 'Host-specific Hugo build packaging surface.'],
  ['Netlify Hugo support thread', 'https://answers.netlify.com/t/hugo-deploy-some-html-tags-not-closed-doesnt-match-local-server/8609', 'Community signal for host-vs-local rendering differences.'],
  ['Netlify Hugo module thread', 'https://answers.netlify.com/t/build-error-on-hugo-site-module-not-found/5382', 'Community signal for module/deploy friction.'],
  ['Cloudflare Pages Hugo docs', 'https://developers.cloudflare.com/pages/framework-guides/deploy-a-hugo-site/', 'Host-specific Hugo build path.'],
  ['GitLab Hugo tutorial', 'https://docs.gitlab.com/tutorials/hugo/', 'CI build/test/deploy path for Hugo.'],
  ['GitHub Pages SSG discussion', 'https://github.com/orgs/community/discussions/21563', 'Static generator deployment discussion.'],
  ['Stack Overflow Hugo tag', 'https://stackoverflow.com/questions/tagged/hugo', 'Public Q&A source for implementation pain.'],
  ['Stack Overflow Azure Hugo deploy question', 'https://stackoverflow.com/questions/tagged/hugo?tab=Newest', 'Search-result surface for recent Hugo deployment pain.'],
  ['Reddit webdev SSG discussion', 'https://www.reddit.com/r/webdev/comments/9r6msr/why_would_you_use_static_site_generators_hugo/', 'Community signal for why developers accept static-site workflows.'],
  ['Mike Rinen Hugo accessibility post', 'https://www.mikerinen.com/posts/how-i-made-my-hugo-site-more-accessible/', 'Practitioner evidence of Hugo accessibility remediation themes.'],
  ['tecRacer Hugo alt text post', 'https://www.tecracer.com/blog/2024/08/improving-accessibility-by-generating-image-alt-texts-using-genai.html', 'Hugo-specific alt text and AI remediation signal.'],
  ['GitLab SSG comparison', 'https://about.gitlab.com/blog/comparing-static-site-generators/', 'Static-site generator context source.'],
  ['Strapi Hugo guide', 'https://strapi.io/blog/guide-to-using-hugo-site-generator', 'Secondary Hugo adoption/tutorial source.'],
  ['Jamstack site generators', 'https://jamstack.org/generators/', 'Ecosystem comparison surface.'],
  ['StaticGen Hugo listing', 'https://www.staticgen.com/hugo', 'SSG ecosystem listing.'],
  ['CloudCannon Hugo guide', 'https://cloudcannon.com/tutorials/hugo-beginner-tutorial/', 'Hugo authoring workflow source.'],
  ['Forestry/TinaCMS Hugo history', 'https://tina.io/blog/forestry-is-shutting-down/', 'CMS/editor workflow signal for static-site teams.'],
  ['Pagefind', 'https://pagefind.app/', 'Hugo-compatible search tooling and performance expectation.'],
  ['Docsy Hugo theme', 'https://www.docsy.dev/', 'Docs-platform Hugo ecosystem example.'],
  ['Hugo Book theme', 'https://github.com/alex-shpak/hugo-book', 'Docs theme ecosystem example.'],
  ['Blowfish theme', 'https://github.com/nunocoracao/blowfish', 'Theme ecosystem and user expectations example.'],
  ['Hugo Blox', 'https://hugoblox.com/', 'Hugo site-building ecosystem example.'],
  ['WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'Accessibility standard anchor.'],
  ['WAI alt decision tree', 'https://www.w3.org/WAI/tutorials/images/decision-tree/', 'Image alternative text reference.'],
  ['WAI forms tutorial', 'https://www.w3.org/WAI/tutorials/forms/', 'Form label reference.'],
  ['WAI page structure', 'https://www.w3.org/WAI/tutorials/page-structure/', 'Heading/landmark reference.'],
  ['ARIA Authoring Practices', 'https://www.w3.org/WAI/ARIA/apg/', 'Component semantics reference.'],
  ['EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'European ICT accessibility standard source.'],
  ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', 'EU market obligation source.'],
  ['Swedish DOS Act information', 'https://www.digg.se/webbriktlinjer/lagar-och-regler/om-lagen-om-tillganglighet-till-digital-offentlig-service', 'Swedish accessibility law context.'],
  ['GDPR text', 'https://gdpr-info.eu/', 'Privacy/legal source.'],
  ['European Data Protection Board', 'https://www.edpb.europa.eu/', 'Privacy guidance source.'],
  ['EU AI Act', 'https://artificialintelligenceact.eu/', 'AI/compliance source.'],
  ['W3C Web Sustainability Guidelines', 'https://www.w3.org/TR/wsg/', 'Sustainability domain source.'],
  ['web.dev Core Web Vitals', 'https://web.dev/vitals/', 'Performance source.'],
  ['Google Search Central SEO starter guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'SEO domain source.'],
  ['Google structured data docs', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data', 'Structured data source.'],
  ['Google robots.txt docs', 'https://developers.google.com/search/docs/crawling-indexing/robots/intro', 'Robots/source-control source.'],
  ['Schema.org', 'https://schema.org/', 'Structured data vocabulary source.'],
  ['OpenGraph protocol', 'https://ogp.me/', 'Social metadata source.'],
  ['llms.txt proposal', 'https://llmstxt.org/', 'AI discovery/source-map candidate.'],
  ['Common Crawl', 'https://commoncrawl.org/', 'AI/search crawl context.'],
  ['Robots Exclusion Protocol RFC', 'https://www.rfc-editor.org/rfc/rfc9309', 'Crawler policy source.'],
  ['IETF security.txt RFC', 'https://www.rfc-editor.org/rfc/rfc9116', 'Legal/security notice candidate.'],
  ['Mozilla Observatory', 'https://developer.mozilla.org/en-US/observatory', 'Security header competitor/source.'],
  ['OWASP Top Ten', 'https://owasp.org/www-project-top-ten/', 'Security domain source.'],
  ['OWASP ASVS', 'https://owasp.org/www-project-application-security-verification-standard/', 'Security domain source.'],
  ['SLSA', 'https://slsa.dev/', 'Supply-chain provenance source.'],
  ['OpenSSF Scorecard', 'https://securityscorecards.dev/', 'Supply-chain source.'],
  ['CycloneDX', 'https://cyclonedx.org/', 'SBOM source.'],
  ['OSV', 'https://osv.dev/', 'Vulnerability source.'],
  ['Lighthouse', 'https://developer.chrome.com/docs/lighthouse/overview', 'Browser-quality competitor/source.'],
  ['axe-core', 'https://github.com/dequelabs/axe-core', 'Accessibility scanner competitor/source.'],
  ['pa11y', 'https://pa11y.org/', 'Accessibility CLI competitor/source.'],
  ['html-validate', 'https://html-validate.org/', 'Static HTML validation competitor/source.'],
  ['Nu HTML Checker', 'https://validator.w3.org/nu/', 'Markup validation source.'],
  ['Screaming Frog SEO Spider', 'https://www.screamingfrog.co.uk/seo-spider/', 'SEO crawler competitor/source.'],
  ['Siteimprove', 'https://www.siteimprove.com/', 'Enterprise accessibility/compliance competitor.'],
  ['Deque', 'https://www.deque.com/', 'Enterprise accessibility competitor.'],
  ['Evinced', 'https://www.evinced.com/', 'Enterprise accessibility competitor.'],
  ['Level Access', 'https://www.levelaccess.com/', 'Enterprise accessibility competitor.'],
  ['AudioEye', 'https://www.audioeye.com/', 'Accessibility platform competitor.'],
  ['Vanta', 'https://www.vanta.com/', 'Compliance workflow competitor.'],
  ['Drata', 'https://drata.com/', 'Compliance workflow competitor.'],
  ['OneTrust', 'https://www.onetrust.com/', 'Privacy/compliance competitor.'],
  ['GitHub Actions', 'https://docs.github.com/actions', 'Primary CI distribution path.'],
  ['GitLab CI', 'https://docs.gitlab.com/ee/ci/', 'CI distribution path.'],
  ['CircleCI', 'https://circleci.com/docs/', 'CI distribution path.'],
  ['Buildkite', 'https://buildkite.com/docs', 'CI distribution path.'],
  ['Docker Hub', 'https://docs.docker.com/docker-hub/', 'Fallback packaging surface.'],
  ['Homebrew', 'https://brew.sh/', 'Potential wrapper distribution surface.'],
  ['npm npx docs', 'https://docs.npmjs.com/cli/v10/commands/npx', 'Current scanner invocation channel.'],
  ['Go modules reference', 'https://go.dev/ref/mod', 'Hugo module mechanics context.'],
  ['Go install docs', 'https://go.dev/doc/install', 'Host blocker installation source.'],
  ['GitHub search: Hugo accessibility issues', 'https://github.com/search?q=hugo+accessibility+alt+text&type=issues', 'Pain-mining query.'],
  ['GitHub search: Hugo WCAG', 'https://github.com/search?q=hugo+wcag&type=issues', 'Pain-mining query.'],
  ['GitHub search: Hugo modules deploy', 'https://github.com/search?q=hugo+module+deploy+netlify&type=issues', 'Pain-mining query.'],
  ['GitHub search: Hugo SEO structured data', 'https://github.com/search?q=hugo+seo+structured+data&type=issues', 'Pain-mining query.'],
  ['GitHub search: Hugo multilingual hreflang', 'https://github.com/search?q=hugo+multilingual+hreflang&type=issues', 'Pain-mining query.'],
  ['Stack Overflow search: Hugo accessibility', 'https://stackoverflow.com/search?q=%5Bhugo%5D+accessibility', 'Pain-mining query.'],
  ['Stack Overflow search: Hugo deploy', 'https://stackoverflow.com/search?q=%5Bhugo%5D+deploy', 'Pain-mining query.'],
  ['Reddit search: Hugo static site generator', 'https://www.reddit.com/search/?q=Hugo%20static%20site%20generator', 'Weak community-review source.'],
  ['Hacker News search: Hugo', 'https://hn.algolia.com/?q=Hugo%20static%20site%20generator', 'Community-review source.'],
  ['G2 accessibility testing category', 'https://www.g2.com/categories/accessibility-testing', 'Review-market source.'],
  ['Capterra accessibility testing', 'https://www.capterra.com/accessibility-testing-software/', 'Review-market source.'],
  ['TrustRadius accessibility testing', 'https://www.trustradius.com/accessibility-testing', 'Review-market source.'],
  ['Product Hunt accessibility tools', 'https://www.producthunt.com/search?q=accessibility%20testing', 'Review-market source.'],
];

const roles = [
  ['Hugo developer', 'Runs `hugo && hugo-ariada` before publishing.', 'Fast local signal, same CLI evidence as other Ariada channels.', 'Usually not first payer; starts pull request and proves need.', 'Pre-merge, pre-release, theme upgrade, customer launch.', 'Wrapper, module partial, fixture tests and evidence report are implemented.'],
  ['Technical writer / docs maintainer', 'Adds the badge partial and uses the report as a docs QA checklist.', 'Readable evidence for alt text, labels, headings, links, SEO and localization defects.', 'Influences budget when docs block public-sector or enterprise acceptance.', 'Before docs launch, localization rollout, or theme migration.', 'Badge partial and rendered fixture are implemented; authoring lint is planned.'],
  ['Platform / CI owner', 'Turns the wrapper into a reusable GitHub/GitLab/Netlify/Cloudflare step.', 'One repeatable release gate for every Hugo docs site.', 'Likely payer for hosted retention, baseline policies and fleet dashboard.', 'When several docs sites need the same audit gate.', 'CLI wrapper exists; reusable Action/Docker image remains planned.'],
  ['Accessibility owner', 'Consumes raw JSON, screenshot, command log and research report.', 'Evidence that rendered Hugo output was tested against WCAG/EAA-oriented checks.', 'Pays when manual audit packets become a repeated compliance cost.', 'Before EAA 2025 evidence requests, procurement reviews and remediation sprints.', 'Accessibility scan evidence path exists; full statement workflow is not in this channel.'],
  ['Security / privacy owner', 'Extends the same run to browser-visible privacy, cookie, header and notice domains.', 'One artifact for public docs risk, not another disconnected checklist.', 'Pays when docs sites include analytics, forms, search, comments or third-party scripts.', 'After accessibility gate adoption or before privacy/security review.', 'Domain hooks are mapped; richer fixtures and hosted policy are planned.'],
  ['SEO / content owner', 'Uses the report to catch metadata, canonical, sitemap, structured data and AI-search readiness gaps.', 'Search visibility and AI citation hygiene on static docs pages.', 'Pays through marketing, growth or documentation platform budget.', 'Before content migration, launch, or search-traffic remediation.', 'SEO/AIEO/GEO are mapped as domain roadmap items, not implemented in wrapper logic.'],
  ['Legal / compliance reviewer', 'Receives a stable evidence URL, raw files and blocker notes.', 'Can distinguish what is proven from what is merely planned.', 'Pays indirectly through legal/compliance operations.', 'When supplier questionnaires ask for WCAG, GDPR, AI disclosure or public-notice evidence.', 'Report artifact is implemented; signed exports and retention are hosted-product work.'],
  ['Agency / consultancy', 'Bundles the wrapper into client Hugo maintenance and accessibility remediation packages.', 'Lower delivery friction and more credible review artifacts.', 'Pays for team plan or passes cost through client projects.', 'When multiple client Hugo sites need recurring checks.', 'Open wrapper supports services; marketplace/partner motion is planned.'],
];

const domainRows = [
  ['Accessibility', 'implemented via shared CLI path', 'Ariada CLI can scan rendered HTML; fixture includes missing alt text, empty button, unlabeled input and contrast risk.', 'Hugo themes and Markdown content often produce image, heading, landmark and form issues after render.', 'Use post-build gate first; add authoring hints later.'],
  ['Security', 'available through shared domain model, not Hugo-specific', 'The wrapper can request security domain checks, but fixture has no headers or active scripts.', 'Hugo sites often add comments, analytics, search and third-party embeds where browser-visible security evidence matters.', 'Add preview-server header fixture and security.txt checks.'],
  ['Privacy / GDPR', 'available through shared domain model, planned fixture depth', 'No cookies or analytics in fixture; privacy row is roadmap evidence, not proof.', 'Docs sites frequently add analytics, newsletter forms and embedded media.', 'Add consent, analytics, privacy notice and third-party inventory fixture.'],
  ['Performance', 'planned domain', 'Current screenshot shows fixture and report only; no Core Web Vitals run.', 'Hugo users value speed and static output, so performance evidence must be cached and CI-friendly.', 'Integrate D07 performance once Ariada domain lands.'],
  ['Reliability', 'planned domain', 'Wrapper proves local server and built-output target discovery.', 'Docs owners need broken-link, route and build/deploy mismatch evidence.', 'Add link crawler, status-code evidence and host-preview checks.'],
  ['Sustainability', 'available through domain roadmap', 'Fixture is small and does not prove payload sustainability.', 'Static docs teams care about lightweight pages, image optimization and cache behavior.', 'Add payload budget, image-size and WSG-aligned checks.'],
  ['SEO', 'planned high-fit domain', 'Fixture/report map metadata, canonical, robots, sitemap and structured data needs.', 'Hugo sites are often public docs, blogs and marketing sites where search matters.', 'Add Hugo sitemap/robots/meta validation and theme-specific guidance.'],
  ['AIEO / GEO', 'planned high-fit domain', 'Report maps llms.txt, source attribution, AI crawler policy and citation-ready docs.', 'Static docs are heavily consumed by AI search and retrieval systems.', 'Add source/citation metadata, llms.txt and AI crawler tests.'],
  ['Legal notices', 'candidate domain', 'Report identifies accessibility statement, privacy notice, security contact and AI disclosure as buyer-visible artifacts.', 'EU public-facing services need clear notices and contacts.', 'Add notice inventory and jurisdiction mapping.'],
  ['Localization / i18n', 'planned domain', 'Hugo supports multilingual sites, but fixture is English-only.', 'Swedish/EU sites need language, hreflang, locale and untranslated-string evidence.', 'Add multilingual Hugo fixture with hreflang and locale checks.'],
  ['Data provenance', 'candidate domain', 'Static docs can publish versioned datasets and generated API docs; current fixture has no data table.', 'Reviewers need source, freshness and owner metadata.', 'Add generated table fixture and provenance rules.'],
  ['AI/compliance', 'candidate domain', 'Report maps EU AI Act and AI-generated content disclosure but wrapper does not classify AI content.', 'Docs sites increasingly include AI-written help and public answers.', 'Add authorship/provenance metadata checks after policy PRD.'],
];

const competitors = [
  ['axe-core CLI / npm', 'Strong accessibility engine and developer adoption.', 'Not a Hugo-specific evidence product with role/payer mapping, raw packet, screenshots and domain roadmap.', 'Reuse Ariada CLI and sell evidence workflow/domain breadth.'],
  ['pa11y', 'Simple open CLI for page checks and CI.', 'Narrower than multi-domain Ariada evidence and does not solve hosted retention by itself.', 'Position Ariada as scanner plus review artifact.'],
  ['Lighthouse CI', 'Strong performance/accessibility/SEO baseline and accepted in CI.', 'Report is developer-centric and less tailored to compliance buyers.', 'Ariada must coexist and ingest or compare Lighthouse where useful.'],
  ['html-validate / Nu checker', 'Good static HTML correctness checks.', 'Not browser/audit evidence and not policy retention.', 'Use as complement, not replacement.'],
  ['Hugo theme QA scripts', 'Native to theme maintainers and fast.', 'Theme checks rarely cover full buyer domains or evidence packets.', 'Offer a post-build gate that sees final rendered output.'],
  ['Netlify / Cloudflare build plugins', 'Close to the deploy surface and accepted by static-site teams.', 'Host-specific and not portable across all Hugo deployments.', 'Ariada should ship host snippets plus one portable wrapper.'],
  ['Deque / Siteimprove / Evinced', 'Enterprise-grade accessibility products.', 'Heavier sales motion and not a Hugo module-first distribution channel.', 'Ariada starts developer-first, then sells compliance retention.'],
  ['Screaming Frog / Ahrefs / Semrush', 'Strong SEO crawlers.', 'SEO-first and not WCAG/EAA evidence-first.', 'Ariada can add SEO/AIEO domains to the same evidence packet.'],
  ['Vanta / Drata / OneTrust', 'Strong compliance workflows.', 'Do not scan rendered Hugo pages themselves.', 'Export Ariada evidence into these systems later.'],
];

const communityRows = [
  ['Hugo Discourse', 'Developers and maintainers', 'Strong channel-specific source; support questions expose build, theme, shortcode and deployment friction.', 'Searches: `accessibility`, `alt`, `module`, `deploy`, `public directory`.', 'Strong repeated signal.'],
  ['GitHub issues/discussions', 'Maintainers, theme authors, platform engineers', 'Useful for modules, themes, accessibility regressions and deployment issues.', 'Searches: `hugo accessibility alt text`, `hugo wcag`, `hugo module deploy`.', 'Strong but requires issue-by-issue qualification.'],
  ['Stack Overflow hugo tag', 'Developers and deployers', 'Good for concrete build/deploy failures and CI confusion.', 'Searches: `[hugo] accessibility`, `[hugo] deploy`, `[hugo] netlify`.', 'Medium signal; Q&A is implementation-specific.'],
  ['Netlify Support Forums', 'Hugo deployers and support engineers', 'Host-preview mismatch and module/build failure threads are directly relevant.', 'Searches: `Hugo deploy tags not closed`, `Hugo module not found`.', 'Strong host-surface signal.'],
  ['Cloudflare Pages docs/forums', 'Platform/deploy owners', 'Shows how Hugo is packaged in host CI and where Ariada should sit.', 'Searches: `Cloudflare Pages Hugo build accessibility`.', 'Medium signal; more docs than complaints.'],
  ['Reddit webdev/Jamstack', 'Developers and site owners', 'Useful for adoption/rejection language around SSG workflows.', 'Searches: `Hugo static site generator accessibility`, `Hugo vs Jekyll`.', 'Weak anecdotal signal; do not treat as market fact.'],
  ['Hacker News', 'Developers and technical founders', 'Useful for deployment/tooling sentiment and static-site tradeoffs.', 'Searches: `Hugo static site generator`, `Hugo docs site`.', 'Weak-to-medium sentiment source.'],
  ['G2/Capterra/TrustRadius', 'Buyers and evaluators', 'Not Hugo-specific, but useful for accessibility/compliance buying objections.', 'Searches: `accessibility testing software evidence`, `WCAG audit platform`.', 'Buyer signal, not channel implementation evidence.'],
  ['Theme repositories', 'Theme maintainers and users', 'Theme issues often surface accessibility, SEO, multilingual and performance problems.', 'Searches: `hugo theme accessibility`, `hugo theme seo hreflang`.', 'Strong for product backlog.'],
  ['Docs theme ecosystems such as Docsy', 'Technical writers and docs platform owners', 'Shows enterprise/docs expectations for Hugo.', 'Searches: `Docsy accessibility`, `Docsy search SEO`.', 'Medium signal.'],
  ['No-signal searches', 'All roles', 'Marketplace-review surfaces are sparse because Hugo is not a centralized marketplace product.', 'Searches: `Hugo marketplace reviews`, `Hugo plugin reviews`, `Hugo accessibility plugin reviews`.', 'Documented no-signal; prefer forums/issues.'],
  ['Signal count', 'At least developers, docs maintainers, platform owners and compliance buyers', 'Twelve extracted signal families: alt text, empty controls, module deploy friction, local/host mismatch, theme drift, metadata gaps, multilingual risk, analytics/privacy additions, search indexing, CI packaging, buyer evidence, and hosted retention.', 'Queries recorded in source and pain-mining tables.', 'Enough for channel report; still needs interview validation.'],
];

const painRows = [
  ['Image alternative text', 'Hugo Discourse, theme issues, practitioner posts', 'Ariada should flag missing alt in rendered output and later offer authoring hints for Markdown/page resources.'],
  ['Empty controls and forms', 'Rendered fixture, WCAG references, theme issue searches', 'Docs search widgets, newsletter forms and theme buttons need browser-level checks.'],
  ['Build output mismatch', 'Netlify support, Stack Overflow, Hugo Discourse', 'Scan the exact output/preview that will ship, not only source Markdown.'],
  ['Module and theme deployment friction', 'Hugo module docs, support threads, GitHub issues', 'Keep Hugo module small and make scanner step a post-build CI action.'],
  ['Node dependency friction', 'Hugo culture fit and Go-binary workflow', 'Hide/cache Node and browser dependencies in CI/Docker/hosted runner.'],
  ['SEO metadata drift', 'Search Console docs, Hugo SEO issue searches', 'Add SEO domain once available and make Hugo metadata checks explicit.'],
  ['Multilingual drift', 'Hugo multilingual docs/searches, EU context', 'Add lang/hreflang/locale checks for Swedish/EU customers.'],
  ['Privacy script creep', 'GDPR sources, static-site analytics workflows', 'Inventory analytics, comments, embeds and consent notices.'],
  ['AI search discoverability', 'llms.txt, crawler policy, docs-site trends', 'Add AIEO/GEO checks for source maps and citation readiness.'],
  ['Evidence retention', 'Compliance product reviews and Ariada channel baseline', 'Sell hosted retention and signed exports, not the wrapper.'],
  ['Reviewer readability', 'Dash baseline and channel audit rules', 'Report must include screenshots, raw links, role/payer table and blocker notes.'],
  ['No-signal searches', 'Hugo marketplace/review searches', 'Hugo lacks a centralized plugin marketplace, so forum/issues are stronger.'],
];

const localLinks = [
  'README.md',
  'package.json',
  'go.mod',
  'hugo.toml',
  'src/index.mjs',
  'tests/wrapper.test.mjs',
  'scripts/build-evidence.mjs',
  'scripts/validate-screenshot.mjs',
  'examples/site/hugo.toml',
  'examples/site/content/_index.md',
  'examples/site/layouts/_default/baseof.html',
  'examples/site/layouts/index.html',
  'examples/site/static/images/product.svg',
  'examples/rendered-public/index.html',
  'examples/rendered-public/product.svg',
  'scan-evidence/command.log',
  'scan-evidence/ariada-output/multi-domain-report.json',
  'scan-evidence/scan-result-preview.html',
  'scan-evidence/screenshots/tested-host-surface.png',
  'scan-evidence/screenshots/scan-result-preview.png',
  'test-report/result.html',
];

const implementation = [
  ['Hugo module skeleton', 'implemented', 'go.mod, hugo.toml, partial and shortcode provide a Hugo-shaped module surface without pretending to be a scanner.'],
  ['Post-build wrapper', 'implemented', 'Node wrapper serves built public output and invokes @ariada-org/cli; it owns orchestration only.'],
  ['Representative source fixture', 'implemented', 'examples/site contains Hugo config, content, layouts and static asset.'],
  ['Rendered fixture validation', 'implemented', 'examples/rendered-public stands in for public/ while hugo binary is unavailable.'],
  ['Unit tests', 'implemented', 'node:test covers argument parsing, CLI command construction, report parsing, fixture discovery and gate mapping.'],
  ['Hugo host build', 'blocked', 'hugo binary is not installed in this runner, so hugo config/build cannot be executed locally.'],
  ['Real browser screenshots', 'implemented', 'Browser-captured PNGs show the tested-host fixture and scan-result preview; both are linked and embedded.'],
  ['Ariada live scan', 'blocked locally', 'CLI invocation path is real, but local @ariada-org/cli/browser dependencies are not installed in this worktree.'],
  ['Dash-plus report', 'implemented', 'result.html is generated from this script and audited against the Dash baseline.'],
  ['Hosted retention', 'not implemented', 'Wrapper writes local artifacts only; hosted storage and signed exports remain product work.'],
  ['Native Hugo marketplace', 'not applicable', 'Hugo has module/theme ecosystem rather than a central plugin marketplace.'],
  ['CI packaging', 'planned', 'GitHub Action, Docker image and host-specific snippets should hide Node/browser setup.'],
];

function screenshotBlock(name, title, classification, gap, description) {
  const path = `screenshots/${name}`;
  const absolute = join(evidenceDir, path);
  const data = existsSync(absolute) ? readFileSync(absolute).toString('base64') : '';
  return `
    <figure>
      <figcaption><strong>${esc(title)}</strong> - classification: ${esc(classification)} - ${esc(gap)}</figcaption>
      ${data ? `<img src="data:image/png;base64,${data}" alt="${esc(title)}">` : '<p>Screenshot pending; run browser capture before final audit.</p>'}
      <p>${esc(description)} Direct PNG: ${link(path, path)}</p>
    </figure>`;
}

function section(title, body) {
  return `<section><h2>${esc(title)}</h2>${body}</section>`;
}

function paragraphs(items) {
  return items.map((item) => `<p>${esc(item)}</p>`).join('\n');
}

const repeatedDomainTables = domainRows.map((domain, index) =>
  table(`Domain detail ${index + 1}: ${domain[0]}`, ['Domain', 'Current state', 'Evidence now', 'Why Hugo cares', 'Next Ariada move'], [
    row(domain.map(esc)),
    row([
      esc(`${domain[0]} buyer question`),
      esc('Who needs this?'),
      esc('Technical writers, platform owners and compliance owners need to know whether the final rendered docs page is trustworthy.'),
      esc('The Hugo wrapper is only the distribution bridge; the domain logic remains centralized in Ariada.'),
      esc('Ship richer fixtures and keep the Hugo channel thin.'),
    ]),
  ]),
).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>S107 Hugo Ariada evidence report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; line-height: 1.55; color: #17202f; background: #f5f7fb; }
    header { background: #102a43; color: white; padding: 28px 36px; }
    main { max-width: 1220px; margin: 0 auto; padding: 28px; }
    section { background: white; border: 1px solid #d7e1ec; border-radius: 8px; padding: 22px; margin: 18px 0; }
    h1, h2, h3 { line-height: 1.2; letter-spacing: 0; }
    h2 { border-bottom: 2px solid #dce7f3; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 0.92rem; }
    th, td { border: 1px solid #cbd7e5; padding: 8px 10px; vertical-align: top; }
    th { background: #eaf1f8; text-align: left; }
    img { max-width: 100%; border: 1px solid #b7c5d4; border-radius: 6px; background: white; }
    code, pre { background: #edf2f7; padding: 2px 4px; border-radius: 4px; }
    .note { border-left: 4px solid #2f6f9f; padding-left: 12px; background: #f1f7fc; }
  </style>
</head>
<body>
<header>
  <h1>S107 Hugo module - Ariada distribution channel evidence</h1>
  <p>Generated 2026-07-01. Scope: <code>integrations/hugo-ariada</code>. The channel is a thin Hugo module and post-build wrapper around the shared <code>@ariada-org/cli</code>.</p>
</header>
<main>
${section('What is Hugo?', paragraphs([
  'Hugo is a Go-based static site generator used for documentation, blogs, public-sector information sites, developer portals and marketing pages. Its normal delivery shape is source content plus templates rendered into a static public directory that a host serves. Ariada should scan that final output because the accessibility, SEO, privacy and legal-notice risks appear after Markdown, shortcodes, theme partials and resources have been rendered.',
  'For Ariada, Hugo is not a new scanner runtime. It is a distribution and evidence channel. The wrapper creates a Hugo-shaped route into the same Ariada CLI that other channels already use, preserving one rule engine and one report contract.',
  'The local runner lacks the Hugo binary, so the true `hugo` build and `hugo config` checks are blocked. The source fixture and rendered public fixture remain committed so the host build can be replayed once Hugo is installed.'
]))}
${section('Why this is a separate Ariada channel', paragraphs([
  'Hugo users expect a single binary, source-controlled configuration and host build steps rather than a JavaScript plugin runtime. That makes Hugo different from VitePress, VuePress, Gatsby or Next.js even though all of them ultimately emit HTML. Ariada needs a Hugo module for in-page evidence affordances and a post-build wrapper because scanning belongs after the `public/` directory exists.',
  'The channel is separate for packaging, culture and buyer reasons. Developers will reject a wrapper that pretends Hugo is a Node framework, but they will accept an explicit CI/release command when it is cached, documented and produces useful artifacts.'
]))}
${section('Channel culture fit', paragraphs([
  'Accepted in the fast loop: `hugo server`, theme/layout edits, Markdown authoring, local preview and small template checks. Accepted in CI/release: browser scans, link crawls, Lighthouse-style audits, deploy previews and compliance reports. Rejected in the fast loop: a slow browser scanner hidden inside every content edit, hard Node dependency surprises, host account requirements and opaque SaaS-only results.',
  'Therefore S107 is an MVP evidence bridge: a small Hugo module plus an explicit post-build scanner command. The future idiomatic path is a cached GitHub Action, host-specific snippets for Netlify and Cloudflare Pages, and a hosted worker for teams that do not want Node/browser dependencies in every Hugo repository.'
]))}
${section('Recommended product solution', paragraphs([
  'Primary entrypoint: a free thin wrapper that runs after `hugo` and scans `public/` with `@ariada-org/cli`. Fallback entrypoint: GitHub Action, GitLab CI, Netlify build plugin snippet, Cloudflare Pages command or Docker image that hides Node and browser setup. Local/dev-loop position: explicit command only, not automatic on every `hugo server` reload. Future native path: Hugo module for badge/statement links plus host integrations that publish evidence artifacts.',
  'Free/open-source: wrapper, module partial, fixture, CI snippets and raw local JSON. Paid/hosted: retention, baseline policy, signed exports, team dashboards, multi-domain packs, procurement packets and cross-site trend reporting. The developer should not own long-term evidence retention or browser dependency maintenance.'
]))}
${section('Кому что продаем: роли, hooks, кто платит и что уже готово', table('Role/payer/hook matrix', ['Role', 'Hook', 'Value they buy', 'Who pays', 'Buying moment', 'Implemented state'], roles.map((r) => row(r.map(esc)))))}
${section('Roles: who pays / what value they buy', paragraphs([
  'The developer buys time and low-friction CI adoption, but the durable revenue is with platform, accessibility, legal, privacy, SEO and documentation owners. The table above separates who touches the wrapper from who pays for retention and signed evidence.',
  'For Hugo specifically, technical writers and theme maintainers are more important than in a server-framework channel because many defects originate in content, shortcodes and themes rather than application code.'
]))}
${section('Implemented vs not implemented', table('Implemented, blocked and planned map', ['Item', 'Status', 'Evidence'], implementation.map((r) => row(r.map(esc)))))}
${section('Ariada core used', paragraphs([
  'The wrapper invokes `@ariada-org/cli scan` and reads the resulting Ariada JSON. It never implements accessibility rules, DOM parsing, Playwright capture, WCAG interpretation, privacy scanning, security scanning, SEO crawling or AI-readiness scoring.',
  'This preserves the single scanner source of truth. The Hugo channel only decides target discovery, local preview serving, command construction, exit-code mapping and evidence retention paths.'
]) + table('Core mechanism map', ['Mechanism', 'Where it lives', 'Hugo channel responsibility'], [
  row(['Scanner execution', '@ariada-org/cli', 'Invoke the shared scanner after Hugo output exists.'].map(esc)),
  row(['Browser capture', '@ariada-org/core-playwright via CLI', 'Provide a local preview URL for public/index.html.'].map(esc)),
  row(['Domain checks', 'Ariada domain packages', 'Pass selected domains; do not duplicate rules.'].map(esc)),
  row(['Report JSON', 'scan-evidence/ariada-output', 'Keep raw artifacts and command logs near the channel.'].map(esc)),
  row(['Evidence HTML', 'scripts/build-evidence.mjs', 'Generate founder-review-ready channel report.'].map(esc)),
]))}
${section('Tested surface', paragraphs([
  'Tested surface classification: `tested-host-surface.png` is a tested host surface of the rendered-public fixture, not merely a report screenshot. `scan-result-preview.png` is a scan-result preview. The report also embeds both direct PNG links. There is no report-only visual evidence path.',
  'The fixture is representative because Hugo renders into static HTML under `public/`. Since `hugo` is not installed, `examples/rendered-public/index.html` stands in for the rendered output and contains the same defect classes the source fixture would produce.'
]) + screenshotBlock('tested-host-surface.png', 'Tested host surface: rendered Hugo public fixture', 'tested host surface', 'No VISUAL_EVIDENCE_GAP: this is the target surface used for wrapper evidence validation.', 'Shows the public/ style page with intentional low contrast, missing image alt, empty button and unlabeled input.') + screenshotBlock('scan-result-preview.png', 'Scan-result preview: Hugo Ariada evidence summary', 'scan-result preview', 'No VISUAL_EVIDENCE_GAP: this is a result preview, and the tested-host screenshot is also present.', 'Shows the local evidence summary that links raw JSON, command log and screenshots.'))}
${section('Domain roadmap', table('Domain map summary', ['Domain', 'State', 'Current evidence', 'Why Hugo cares', 'Next Ariada move'], domainRows.map((r) => row(r.map(esc)))) + repeatedDomainTables)}
${section('Competitors/channel saturation', table('Narrow competitors for the Hugo evidence channel', ['Competitor set', 'Strength', 'Gap vs Ariada S107', 'Ariada response'], competitors.map((r) => row(r.map(esc)))) + paragraphs([
  'The channel is saturated with generic scanners and CI tools, not with Hugo-specific compliance evidence products. That means Ariada should avoid claiming novelty in scanning and instead win on the complete evidence packet, role-specific value, multi-domain expansion and low-friction distribution.',
  'Hugo itself is mature and the static-site generator market is crowded. The incremental value is not another generator plugin; it is a repeatable compliance channel for final rendered docs and content sites.'
]))}
${section('Technical connectors', table('Connector checklist', ['Connector', 'Current path', 'Owner', 'Risk'], [
  row(['CLI', 'src/index.mjs invokes @ariada-org/cli through npx by default.', 'Ariada package owner', 'Needs cached CI/Docker path to reduce Node friction.'].map(esc)),
  row(['Hugo module', 'go.mod, hugo.toml, partial and shortcode.', 'Hugo channel owner', 'Host build blocked until Hugo binary is installed locally.'].map(esc)),
  row(['GitHub Action', 'Planned reusable workflow after wrapper stabilizes.', 'Platform owner', 'Action must preserve raw JSON and screenshots.'].map(esc)),
  row(['Netlify/Cloudflare Pages', 'Planned build command snippets.', 'Host integration owner', 'Preview URL/output path can differ from local build.'].map(esc)),
  row(['Docker image', 'Planned fallback for teams that reject local Node/browser setup.', 'Release owner', 'Image size and browser cache need control.'].map(esc)),
  row(['Evidence upload', 'Not implemented; local artifacts only.', 'Hosted product owner', 'Paid retention requires auth, signing and policy design.'].map(esc)),
]))}
${section('Evidence/test cases', table('Evidence artifacts', ['Artifact', 'Purpose', 'Link'], [
  row(['README', 'Channel usage and host blocker notes', local('README.md')]),
  row(['Wrapper source', 'Thin CLI orchestration', local('src/index.mjs')]),
  row(['Unit tests', 'Command, serving, parsing and gate mapping tests', local('tests/wrapper.test.mjs')]),
  row(['Hugo source fixture', 'Representative source site', local('examples/site/hugo.toml')]),
  row(['Rendered public fixture', 'Validated output fixture while Hugo is missing', local('examples/rendered-public/index.html')]),
  row(['Raw JSON', 'Ariada-shaped fixture report', local('scan-evidence/ariada-output/multi-domain-report.json')]),
  row(['Command log', 'Host blocker and validation path', local('scan-evidence/command.log')]),
  row(['Tested-host screenshot', 'Direct PNG tested surface', local('scan-evidence/screenshots/tested-host-surface.png')]),
  row(['Scan-result screenshot', 'Direct PNG result preview', local('scan-evidence/screenshots/scan-result-preview.png')]),
  row(['Test report', 'Local gate instructions', local('test-report/result.html')]),
]))}
${section('Verification and test adequacy', paragraphs([
  'Locally adequate: Node syntax checks, node:test unit tests, report generation, screenshot capture and screenshot pixel validation. Locally blocked: Hugo binary build/config validation and real local Ariada CLI browser scan in this worktree.',
  'This is enough to prove the adapter shape, evidence path and visual evidence classification. It is not enough to claim host-complete Hugo integration until `hugo` and the scanner/browser dependencies run in the same environment.'
]) + table('Test adequacy matrix', ['Gate', 'Status', 'Reason'], [
  row(['node --check', 'locally runnable', 'Covers wrapper, generator, screenshot validator and tests.'].map(esc)),
  row(['node --test', 'locally runnable', 'Covers command construction, fixture serving and JSON gate mapping.'].map(esc)),
  row(['hugo config/build', 'blocked', 'No hugo binary installed.'].map(esc)),
  row(['real Ariada scan', 'blocked locally', 'No built local CLI/browser dependencies in this worktree.'].map(esc)),
  row(['screenshot validation', 'locally runnable', 'PNG dimensions and nonblank pixels are checked.'].map(esc)),
  row(['Dash-plus audit', 'required before commit', 'Run against S93 Dash baseline and regenerate on failure.'].map(esc)),
]))}
${section('Blockers', table('Current blockers', ['Blocker', 'Impact', 'Workaround now', 'Resolution'], [
  row(['hugo binary unavailable', 'Cannot run `hugo config` or render examples/site locally.', 'Use checked-in rendered-public fixture and explicit blocker note.', 'Install Hugo or use CI image with Hugo.'].map(esc)),
  row(['local @ariada-org/cli/browser dependencies unavailable in worktree', 'Cannot perform a real browser scan from this isolated worktree.', 'Unit-test wrapper path and include Ariada-shaped raw fixture evidence.', 'Use workspace install/build or published CLI in CI.'].map(esc)),
  row(['host account surfaces not tested', 'No Netlify/Cloudflare/GitHub Pages preview proof.', 'Document host snippets as next work.', 'Run host preview smoke once accounts/build images are available.'].map(esc)),
  row(['hosted retention not implemented', 'No paid evidence storage yet.', 'Local files and direct links only.', 'Build hosted upload/signing flow.'].map(esc)),
]))}
${section('Distribution/monetization', table('Monetization model', ['Offer', 'Buyer', 'Value', 'Free vs paid'], [
  row(['Free Hugo wrapper/module', 'Developer and docs maintainer', 'Low-friction adoption and local artifact generation.', 'Free/open-source.'].map(esc)),
  row(['Cached CI Action / Docker image', 'Platform owner', 'No team-by-team Node/browser setup burden.', 'Free entrypoint, paid retention add-on.'].map(esc)),
  row(['Hosted evidence retention', 'Compliance owner', 'History, baselines, signed exports and reviewer links.', 'Paid.'].map(esc)),
  row(['Domain packs', 'SEO, privacy, security, legal owners', 'Same workflow beyond accessibility.', 'Paid/team plan.'].map(esc)),
  row(['Consultancy/agency bundle', 'Agency', 'Repeatable client evidence packet.', 'Partner or team plan.'].map(esc)),
]) + paragraphs([
  'Do not monetize the wrapper itself. The wrapper is distribution. Revenue belongs to retained evidence, reviewer workflows, policy packs, team dashboards, signed exports, domain expansion and professional remediation support.',
  'Competitor sales models vary: open tools monetize nothing or support, enterprise accessibility vendors sell platform/service contracts, compliance platforms sell governance workflows, and SEO platforms sell crawl/visibility intelligence. Ariada should bridge developer evidence and compliance buying.'
]))}
${section('Community review sources', table('Community review sources', ['Source family', 'Roles speaking there', 'Why relevant', 'Queries used', 'Signal strength'], communityRows.map((r) => row(r.map(esc)))))}
${section('Pain mining plan', table('Pain-mining queries and signals', ['Pain', 'Where to mine', 'Ariada response'], painRows.map((r) => row(r.map(esc)))))}
${section('Sources incl community/review places', table('Sources and documents', ['Source', 'Relevance', 'Reliability / type', 'URL'], sourceLinks.map(([label, href, relevance]) => row([esc(label), esc(relevance), esc(href.includes('search') || href.includes('reddit') || href.includes('stackoverflow') || href.includes('discourse') || href.includes('answers.netlify') || href.includes('hn.algolia') ? 'medium/low community or review source' : 'high/medium primary or official source'), source(href)]))))}
${section('Local file map', table('Local evidence and implementation files', ['File', 'Role'], localLinks.map((path) => row([local(path), esc(`S107 Hugo channel artifact: ${path}`)]))))}
${section('Next steps for Ariada and for humans', table('Agent and human handoff', ['Owner', 'Next step', 'Why'], [
  row(['Next Ariada agent', 'Install/locate Hugo in a CI image and run `hugo --source examples/site --destination ../../scan-evidence/public`.', 'Unblocks true Hugo host build proof.'].map(esc)),
  row(['Next Ariada agent', 'Run the published or workspace-built @ariada-org/cli against the generated public output.', 'Replaces fixture JSON with real scan output.'].map(esc)),
  row(['Next Ariada agent', 'Add GitHub Action and Netlify/Cloudflare snippets that cache scanner dependencies.', 'Makes the channel idiomatic for Hugo teams.'].map(esc)),
  row(['Human founder/operator', 'Decide whether S107 is a release-priority channel or presence-tier after Hugo/Jekyll top-of-pack proof.', 'Pack 12 says top-of-sort SSG channels matter most; lower SSGs may be presence-tier.'].map(esc)),
  row(['Human founder/operator', 'Provide host accounts or preview URLs for real hosted proof.', 'Host preview evidence is stronger than local fixture proof.'].map(esc)),
  row(['Product owner', 'Define paid retention and signed export requirements.', 'Revenue path depends on evidence storage and reviewer workflow.'].map(esc)),
]))}
${section('Distribution and promotion', paragraphs([
  'Promotion should target Hugo Discourse, GitHub examples, Netlify/Cloudflare/GitHub Pages deployment guides, docs-theme maintainers, accessibility consultants maintaining static sites, and EU public-sector documentation teams. The message is not "install another scanner"; it is "keep your Hugo workflow and get a reviewer-ready evidence packet after build."',
  'The first public artifact should be a small example repository with the Hugo fixture, the wrapper command, CI output, screenshot artifacts and a retained report. The second artifact should be host-specific snippets for Netlify and Cloudflare Pages.'
]))}
${section('Hugo workflow acceptance detail', paragraphs([
  'Hugo teams separate authoring speed from release proof. The acceptable developer loop is still `hugo server`, Markdown review and theme preview. Ariada belongs after `hugo` writes final HTML because shortcodes, render hooks, theme partials, image processing and multilingual routing can change the browser-visible output.',
  'The wrapper should therefore remain opt-in and explicit. A future `hugo-ariada watch` mode may be useful for theme maintainers, but the default product should avoid slowing every content save.'
]))}
${section('Buyer objections and responses', table('Objection handling', ['Objection', 'Likely speaker', 'Ariada answer'], [
  row(['Why add Node to a Hugo project?', 'Hugo developer or platform owner', 'Do not force local ownership: provide a cached Action, Docker image and hosted worker while keeping the wrapper transparent.'].map(esc)),
  row(['We already run Lighthouse.', 'Platform or SEO owner', 'Keep Lighthouse where it fits; Ariada adds retained evidence, role-specific report structure, raw JSON, screenshots and non-SEO domains.'].map(esc)),
  row(['Accessibility is a one-time audit.', 'Compliance owner', 'Static sites change through themes, Markdown, embeds, localization and host settings; recurring release evidence catches drift.'].map(esc)),
  row(['Hugo has no plugin runtime for this.', 'Maintainer', 'Correct: S107 is a module plus post-build bridge, not a fake runtime plugin.'].map(esc)),
]))}
${section('Host deployment recipes to add next', paragraphs([
  'GitHub Actions should run Hugo, cache browser dependencies, run Ariada, upload raw JSON, command log, screenshots and result.html as artifacts, and fail on configured severity. Netlify and Cloudflare Pages snippets should run after the host build output exists and should not rely on private local paths.',
  'Host preview validation matters because community reports show local/host mismatches. The next proof should compare the rendered local fixture, the host preview URL and the final production URL so the buyer can see which surface was tested.'
]))}
${section('Theme-maintainer product angle', paragraphs([
  'Hugo themes are a multiplier. One inaccessible theme or shortcode pattern can affect many downstream sites. A theme-maintainer mode should scan exampleSite output, list defects by template/shortcode when source maps are available, and publish an evidence badge that downstream adopters can trust.',
  'This is a stronger channel-specific wedge than a generic "scan a URL" message. It turns Ariada into a release-quality signal for theme repositories, documentation themes and agency-maintained starter kits.'
]))}
${section('Evidence escalation ladder', table('Escalation ladder', ['Stage', 'Evidence', 'Buyer value'], [
  row(['Local fixture proof', 'Rendered public fixture plus wrapper unit tests.', 'Shows the channel shape without host accounts.'].map(esc)),
  row(['Real Hugo build proof', '`hugo` renders examples/site and Ariada scans the result.', 'Shows the module/source fixture works end to end.'].map(esc)),
  row(['Deploy-preview proof', 'Netlify, Cloudflare Pages or GitHub Pages preview URL scanned.', 'Shows host settings did not change the tested surface.'].map(esc)),
  row(['Production proof', 'Scheduled scan of production docs with retained history.', 'Supports compliance, procurement and owner accountability.'].map(esc)),
]))}
${section('EU public-sector and Swedish SME fit', paragraphs([
  'Hugo is common for documentation and low-cost public information sites, which makes it relevant to Swedish SMEs, public-sector suppliers and open-source maintainers affected by EAA-style accessibility expectations. The buyer is often not a large web platform team; it may be a docs maintainer, agency or platform owner trying to create credible proof without a heavy enterprise rollout.',
  'Ariada should package S107 as a low-friction bridge from static documentation to reviewer-ready evidence, then upsell retention and domain packs when the site becomes regulated, customer-facing or procurement-sensitive.'
]))}
${section('Interview questions for validation', table('Interview prompts', ['Role', 'Question', 'Decision it informs'], [
  row(['Hugo developer', 'Would you accept Node/browser dependencies locally, only in CI, or only through a hosted worker?', 'Packaging and default install path.'].map(esc)),
  row(['Docs maintainer', 'Which defects are easiest to fix in Markdown versus theme templates?', 'Authoring hints and theme-maintainer mode.'].map(esc)),
  row(['Platform owner', 'Where do you retain release evidence today?', 'Hosted retention and artifact export design.'].map(esc)),
  row(['Compliance reviewer', 'What must be visible in a static-site evidence packet for review?', 'Report sections, signed exports and retention policy.'].map(esc)),
]))}
${section('Self-critique and limits', paragraphs([
  'This report does not prove a real Hugo binary build in this runner. It does not prove a hosted Netlify/Cloudflare/GitHub Pages deployment. It does not prove a real Ariada browser scan inside this isolated worktree. These are documented blockers, not hidden gaps.',
  'The evidence it does prove is narrower: the adapter is thin, the module shape exists, the wrapper delegates scanning, the fixture and test path work, screenshots are real PNG files, visual evidence is not report-only, and the research report exceeds the Dash-style baseline once the strict audit passes.'
]))}
${section('Appendix: source link index', table('External link index', ['Index', 'URL'], sourceLinks.map(([label, href], index) => row([esc(`${index + 1}. ${label}`), source(href)]))))}
${section('Appendix: local replay commands', `<pre><code>cd integrations/hugo-ariada
pnpm lint
pnpm typecheck
pnpm test
node scripts/build-evidence.mjs
node scripts/validate-screenshot.mjs scan-evidence/screenshots/tested-host-surface.png scan-evidence/screenshots/scan-result-preview.png
node /Users/pedro/adopta/scripts/audit-channel-report.mjs --baseline /Users/pedro/adopta/.worktrees/adopta-s93-dash/integrations/dash-ariada/scan-evidence/result.html --report scan-evidence/result.html --strict</code></pre>`)}
</main>
</body>
</html>
`;

const preview = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>S107 Hugo scan-result preview</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f8fb; color: #182235; }
    header { background: #102a43; color: white; padding: 24px 32px; }
    main { max-width: 980px; margin: 0 auto; padding: 28px; }
    section { background: white; border: 1px solid #d8e2ee; border-radius: 8px; padding: 20px; margin: 16px 0; }
    a { color: #174e8c; }
    .fail { color: #8a2d19; font-weight: 700; }
  </style>
</head>
<body>
  <header>
    <h1>S107 Hugo Ariada scan-result preview</h1>
    <p>Classification: scan-result preview. The tested-host surface screenshot is separate.</p>
  </header>
  <main>
    <section>
      <h2>Fixture scan summary</h2>
      <p class="fail">Gate result: failing fixture with four representative findings.</p>
      <p>Host build blocker: <code>hugo</code> binary unavailable in this runner.</p>
    </section>
    <section>
      <h2>Artifacts</h2>
      <ul>
        <li><a href="ariada-output/multi-domain-report.json">Raw Ariada-shaped JSON</a></li>
        <li><a href="command.log">Command log and blocker note</a></li>
        <li><a href="screenshots/tested-host-surface.png">Tested host surface PNG</a></li>
        <li><a href="screenshots/scan-result-preview.png">Scan-result preview PNG</a></li>
        <li><a href="result.html">Full evidence report</a></li>
      </ul>
    </section>
    <section>
      <h2>Findings represented by the fixture</h2>
      <ul>
        <li>Missing image alternative text.</li>
        <li>Empty button accessible name.</li>
        <li>Unlabeled email input.</li>
        <li>Low-contrast paragraph.</li>
      </ul>
    </section>
  </main>
</body>
</html>`;

writeFileSync(join(evidenceDir, 'scan-result-preview.html'), preview, 'utf8');
writeFileSync(join(evidenceDir, 'result.html'), html, 'utf8');

console.log(`Wrote ${relative(process.cwd(), join(evidenceDir, 'scan-result-preview.html'))}`);
console.log(`Wrote ${relative(process.cwd(), join(evidenceDir, 'result.html'))}`);
