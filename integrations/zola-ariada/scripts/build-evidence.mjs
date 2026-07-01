#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd().endsWith('zola-ariada') ? process.cwd() : join(process.cwd(), 'integrations', 'zola-ariada');
const evidenceDir = join(root, 'scan-evidence');
const outputDir = join(evidenceDir, 'ariada-output');
const screenshotsDir = join(evidenceDir, 'screenshots');
mkdirSync(outputDir, { recursive: true });
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
const paragraphs = (items) => items.map((item) => `<p>${esc(item)}</p>`).join('\n');
const section = (title, body) => `<section><h2>${esc(title)}</h2>${body}</section>`;
const source = (href) => link(href, href.replace(/^https?:\/\//, ''));

const sourceLinks = [
  ['Zola documentation', 'https://www.getzola.org/documentation/getting-started/overview/', 'Primary source for Zola as a Rust static site generator.'],
  ['Zola GitHub repository', 'https://github.com/getzola/zola', 'Primary source for repository, release and issue signals.'],
  ['Zola CLI overview', 'https://www.getzola.org/documentation/getting-started/cli-usage/', 'Primary source for the build command and local workflow.'],
  ['Zola directory structure', 'https://www.getzola.org/documentation/getting-started/directory-structure/', 'Primary source for content, templates, static assets and public output.'],
  ['Zola configuration', 'https://www.getzola.org/documentation/getting-started/configuration/', 'Primary source for config.toml.'],
  ['Zola templates', 'https://www.getzola.org/documentation/templates/overview/', 'Primary source for Tera template rendering.'],
  ['Zola themes', 'https://www.getzola.org/themes/', 'Ecosystem source for theme-driven adoption.'],
  ['Zola Sass', 'https://www.getzola.org/documentation/content/sass/', 'Build feature source.'],
  ['Zola search', 'https://www.getzola.org/documentation/content/search/', 'Search feature source.'],
  ['Zola image processing', 'https://www.getzola.org/documentation/content/image-processing/', 'Image workflow source.'],
  ['Zola multilingual sites', 'https://www.getzola.org/documentation/content/multilingual/', 'Localization source.'],
  ['Tera templates', 'https://keats.github.io/tera/docs/', 'Template engine source.'],
  ['Rust install', 'https://www.rust-lang.org/tools/install', 'Host-tool source for installing Rust tooling if needed.'],
  ['Homebrew Zola formula', 'https://formulae.brew.sh/formula/zola', 'Distribution source for macOS runners.'],
  ['GitHub Actions docs', 'https://docs.github.com/actions', 'CI distribution source.'],
  ['GitLab CI docs', 'https://docs.gitlab.com/ee/ci/', 'CI distribution source.'],
  ['Netlify Zola docs', 'https://docs.netlify.com/frameworks/zola/', 'Host build source.'],
  ['Cloudflare Pages framework guides', 'https://developers.cloudflare.com/pages/framework-guides/', 'Host build source family.'],
  ['Vercel static builds', 'https://vercel.com/docs/frameworks/static-build', 'Static build hosting source.'],
  ['Jamstack generators', 'https://jamstack.org/generators/', 'SSG ecosystem comparison source.'],
  ['StaticGen Zola listing', 'https://www.staticgen.com/zola', 'Ecosystem listing source.'],
  ['Zola forum', 'https://zola.discourse.group/', 'Community support source.'],
  ['Zola GitHub issues', 'https://github.com/getzola/zola/issues', 'Issue and pain-mining source.'],
  ['Zola accessibility issue search', 'https://github.com/getzola/zola/issues?q=accessibility', 'Pain-mining query.'],
  ['Zola alt text issue search', 'https://github.com/getzola/zola/issues?q=alt+text', 'Pain-mining query.'],
  ['Zola SEO issue search', 'https://github.com/getzola/zola/issues?q=seo', 'Pain-mining query.'],
  ['Zola deploy issue search', 'https://github.com/getzola/zola/issues?q=deploy', 'Pain-mining query.'],
  ['Stack Overflow Zola tag', 'https://stackoverflow.com/questions/tagged/zola', 'Developer Q&A source.'],
  ['Stack Overflow Zola search', 'https://stackoverflow.com/search?q=zola+static+site+generator', 'Pain-mining query.'],
  ['Reddit Zola search', 'https://www.reddit.com/search/?q=Zola%20static%20site%20generator', 'Weak community sentiment source.'],
  ['Hacker News Zola search', 'https://hn.algolia.com/?q=Zola%20static%20site%20generator', 'Developer sentiment source.'],
  ['Zulip Rust community', 'https://rust-lang.zulipchat.com/', 'Rust-community source family.'],
  ['Rust users forum', 'https://users.rust-lang.org/', 'Rust developer community source.'],
  ['WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'Accessibility standard source.'],
  ['WAI image decision tree', 'https://www.w3.org/WAI/tutorials/images/decision-tree/', 'Alt text source.'],
  ['WAI forms tutorial', 'https://www.w3.org/WAI/tutorials/forms/', 'Form labeling source.'],
  ['WAI page structure', 'https://www.w3.org/WAI/tutorials/page-structure/', 'Heading and landmark source.'],
  ['ARIA APG', 'https://www.w3.org/WAI/ARIA/apg/', 'Interaction semantics source.'],
  ['EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'European accessibility standard source.'],
  ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', 'EU accessibility obligation source.'],
  ['AccessibleEU EAA date', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en', 'EAA timing source.'],
  ['Swedish web accessibility law', 'https://www.digg.se/webbriktlinjer/lagar-och-regler/om-lagen-om-tillganglighet-till-digital-offentlig-service', 'Swedish public-sector context source.'],
  ['GDPR EUR-Lex', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng', 'Privacy law source.'],
  ['European Data Protection Board', 'https://www.edpb.europa.eu/', 'Privacy guidance source.'],
  ['EU AI Act service desk', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50', 'AI transparency source.'],
  ['W3C Web Sustainability Guidelines', 'https://www.w3.org/TR/web-sustainability-guidelines/', 'Sustainability source.'],
  ['web.dev Core Web Vitals', 'https://web.dev/vitals/', 'Performance source.'],
  ['Google SEO starter guide', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'SEO source.'],
  ['Google structured data intro', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data', 'Structured data source.'],
  ['Google robots.txt intro', 'https://developers.google.com/search/docs/crawling-indexing/robots/intro', 'Crawler source.'],
  ['Schema.org', 'https://schema.org/', 'Structured data vocabulary source.'],
  ['OpenGraph protocol', 'https://ogp.me/', 'Social metadata source.'],
  ['llms.txt proposal', 'https://llmstxt.org/', 'AI discovery source.'],
  ['Common Crawl', 'https://commoncrawl.org/', 'Crawler ecosystem source.'],
  ['Robots Exclusion RFC 9309', 'https://www.rfc-editor.org/rfc/rfc9309', 'Crawler policy source.'],
  ['security.txt RFC 9116', 'https://www.rfc-editor.org/rfc/rfc9116', 'Security contact source.'],
  ['OWASP Top Ten', 'https://owasp.org/www-project-top-ten/', 'Security source.'],
  ['OWASP ASVS', 'https://owasp.org/www-project-application-security-verification-standard/', 'Security source.'],
  ['Mozilla Observatory', 'https://developer.mozilla.org/en-US/observatory', 'Security header competitor/source.'],
  ['SLSA', 'https://slsa.dev/', 'Supply-chain source.'],
  ['OpenSSF Scorecard', 'https://securityscorecards.dev/', 'Supply-chain source.'],
  ['CycloneDX', 'https://cyclonedx.org/', 'SBOM source.'],
  ['OSV', 'https://osv.dev/', 'Vulnerability source.'],
  ['Lighthouse overview', 'https://developer.chrome.com/docs/lighthouse/overview', 'Browser-quality competitor/source.'],
  ['axe-core', 'https://github.com/dequelabs/axe-core', 'Accessibility scanner competitor/source.'],
  ['pa11y', 'https://pa11y.org/', 'Accessibility CLI competitor/source.'],
  ['html-validate', 'https://html-validate.org/', 'Static HTML validation competitor/source.'],
  ['Nu HTML Checker', 'https://validator.w3.org/nu/', 'Markup validation source.'],
  ['Screaming Frog SEO Spider', 'https://www.screamingfrog.co.uk/seo-spider/', 'SEO crawler competitor/source.'],
  ['Siteimprove', 'https://www.siteimprove.com/', 'Enterprise accessibility competitor.'],
  ['Deque', 'https://www.deque.com/', 'Enterprise accessibility competitor.'],
  ['Evinced', 'https://www.evinced.com/', 'Enterprise accessibility competitor.'],
  ['Level Access', 'https://www.levelaccess.com/', 'Enterprise accessibility competitor.'],
  ['AudioEye', 'https://www.audioeye.com/', 'Accessibility platform competitor.'],
  ['Vanta', 'https://www.vanta.com/', 'Compliance workflow competitor.'],
  ['Drata', 'https://drata.com/', 'Compliance workflow competitor.'],
  ['OneTrust', 'https://www.onetrust.com/', 'Privacy/compliance competitor.'],
  ['Cookiebot', 'https://www.cookiebot.com/', 'Consent/privacy competitor.'],
  ['Website Carbon Calculator', 'https://www.websitecarbon.com/', 'Sustainability competitor.'],
  ['Ecograder', 'https://ecograder.com/', 'Sustainability competitor.'],
  ['Google Rich Results Test', 'https://search.google.com/test/rich-results', 'Structured data competitor.'],
  ['Docker Hub docs', 'https://docs.docker.com/docker-hub/', 'Fallback packaging source.'],
  ['npm npx docs', 'https://docs.npmjs.com/cli/v10/commands/npx', 'Current scanner invocation channel.'],
  ['GitHub Marketplace Actions', 'https://github.com/marketplace?type=actions', 'Future distribution source.'],
  ['G2 accessibility testing', 'https://www.g2.com/categories/accessibility-testing', 'Buyer review source.'],
  ['Capterra accessibility testing', 'https://www.capterra.com/accessibility-testing-software/', 'Buyer review source.'],
  ['TrustRadius accessibility testing', 'https://www.trustradius.com/accessibility-testing', 'Buyer review source.'],
  ['Product Hunt accessibility tools', 'https://www.producthunt.com/search?q=accessibility%20testing', 'Weak market-discovery source.'],
  ['Hugo repository', 'https://github.com/gohugoio/hugo', 'Adjacent single-binary SSG competitor/source.'],
  ['Jekyll repository', 'https://github.com/jekyll/jekyll', 'Adjacent SSG competitor/source.'],
  ['VitePress repository', 'https://github.com/vuejs/vitepress', 'Adjacent docs framework source.'],
  ['VuePress repository', 'https://github.com/vuejs/vuepress', 'Adjacent docs framework source.'],
  ['Hexo repository', 'https://github.com/hexojs/hexo', 'Adjacent SSG source.'],
  ['mdBook repository', 'https://github.com/rust-lang/mdBook', 'Adjacent Rust docs source.'],
  ['GitBook docs', 'https://docs.gitbook.com/', 'Hosted docs competitor/source.'],
  ['Nextra docs', 'https://nextra.site/', 'Adjacent docs framework source.'],
  ['Pelican docs', 'https://docs.getpelican.com/', 'Adjacent SSG source.'],
  ['Pagefind', 'https://pagefind.app/', 'Static-site search source.'],
  ['Starlight docs', 'https://starlight.astro.build/', 'Adjacent docs framework source.'],
  ['Docusaurus docs', 'https://docusaurus.io/', 'Adjacent docs framework source.'],
  ['MkDocs docs', 'https://www.mkdocs.org/', 'Adjacent docs framework source.'],
  ['Read the Docs', 'https://docs.readthedocs.io/', 'Hosted docs platform source.'],
  ['GitHub Pages documentation', 'https://docs.github.com/pages', 'Static publishing comparison source.'],
  ['Netlify build configuration', 'https://docs.netlify.com/build/configure-builds/overview/', 'Build hook and artifact source.'],
  ['Cloudflare Pages build configuration', 'https://developers.cloudflare.com/pages/configuration/build-configuration/', 'Build command and output directory source.'],
  ['Vercel build output docs', 'https://vercel.com/docs/build-output-api/v3', 'Static output packaging source.'],
  ['W3C Easy Checks', 'https://www.w3.org/WAI/test-evaluate/easy-checks/', 'Reviewer-friendly accessibility source.'],
  ['W3C evaluating web accessibility', 'https://www.w3.org/WAI/test-evaluate/', 'Audit process source.'],
  ['Accessibility Conformance Testing rules', 'https://www.w3.org/WAI/standards-guidelines/act/rules/', 'Rules ecosystem source.'],
  ['OpenTelemetry', 'https://opentelemetry.io/', 'Future evidence observability source.'],
  ['OpenVEX', 'https://openvex.dev/', 'Security evidence comparison source.'],
  ['Sigstore', 'https://www.sigstore.dev/', 'Signed artifact roadmap source.'],
  ['in-toto', 'https://in-toto.io/', 'Provenance roadmap source.'],
  ['OpenSSF Best Practices', 'https://bestpractices.coreinfrastructure.org/', 'Open-source project hygiene source.'],
  ['ISO/IEC 40500 overview', 'https://www.iso.org/standard/58625.html', 'WCAG international standard source.'],
  ['WAI accessibility statements', 'https://www.w3.org/WAI/planning/statements/', 'Accessibility statement source.'],
  ['Google Search Central sitemaps', 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview', 'Sitemap source.'],
];

const roles = [
  ['Zola developer', 'Runs `zola build && zola-ariada` before publishing.', 'Fast local signal over the exact static output.', 'Usually not first payer; starts adoption by showing evidence in a pull request.', 'Pre-merge, pre-release, theme upgrade, public docs launch.', 'Wrapper, source fixture, rendered fixture and unit/e2e tests are implemented.'],
  ['Rust / docs platform maintainer', 'Adds the post-build command to a release script or GitHub Action.', 'Keeps the Rust-first workflow while delegating scanning to Ariada CLI.', 'Influences platform/tooling budget.', 'When several docs sites need the same release gate.', 'CI snippet is documented; reusable Action/Docker image is planned.'],
  ['Technical writer', 'Uses the evidence packet to prioritize alt text, headings, landmarks, links and metadata.', 'Readable reviewer artifact rather than raw terminal output.', 'Influences budget when docs block public-sector or enterprise acceptance.', 'Before localization, migration or theme refresh.', 'Report artifact is implemented; authoring-side lint is not.'],
  ['Accessibility reviewer', 'Consumes raw JSON, command log, screenshot and result.html.', 'Can distinguish tested final HTML from source Markdown guesses.', 'May pay in agency context; usually shapes procurement requirements.', 'Before WCAG/EAA signoff and remediation sprints.', 'Local evidence exists; signed hosted exports are product work.'],
  ['Security / privacy owner', 'Extends the same run to browser-visible headers, scripts, cookies and notices.', 'One evidence packet for docs release risk.', 'Pays when static sites include analytics, forms, comments or embedded media.', 'After accessibility gate adoption or before privacy review.', 'Domain hooks are mapped; richer fixtures are planned.'],
  ['SEO / content owner', 'Uses domain roadmap for metadata, canonical, sitemap, structured data and AI-search readiness.', 'Search visibility and AI citation hygiene on static docs.', 'Pays through marketing, growth or docs platform budget.', 'Before content migration, launch or traffic remediation.', 'SEO/AIEO/GEO are mapped as roadmap domains.'],
  ['Legal / compliance reviewer', 'Receives a stable evidence URL, raw files and blocker notes.', 'Knows what is implemented, blocked and planned.', 'Pays indirectly through compliance operations.', 'Supplier questionnaires, procurement review and audit evidence requests.', 'Report artifact is implemented; retention/access control is not.'],
  ['Agency / consultancy', 'Bundles `zola-ariada` into client static-site maintenance packages.', 'Lower delivery friction and more defensible review packets.', 'Pays for team plan or passes cost through client projects.', 'When multiple client Zola sites need recurring checks.', 'Open wrapper supports services; partner packaging is planned.'],
];

const domainRows = [
  ['Accessibility', 'implemented through shared CLI invocation', 'Rendered fixture includes missing alt text and empty button risk.', 'Zola Markdown, Tera templates and themes can hide accessibility defects until final HTML exists.', 'Keep wrapper thin; add Zola-aware source hints later.'],
  ['Security', 'available through shared domain model, not Zola-specific yet', 'Current fixture does not prove headers, CSP, mixed content or security.txt.', 'Static docs often add third-party search, analytics, comments and embeds.', 'Add preview-server header fixture and security.txt checks.'],
  ['Privacy / GDPR', 'available through shared domain model, planned fixture depth', 'No cookies or analytics in fixture.', 'Public docs sites frequently add analytics and newsletter forms.', 'Add consent, third-party inventory and privacy notice tests.'],
  ['Performance', 'planned domain', 'No Core Web Vitals run is performed by this wrapper.', 'Zola users expect fast static output, so performance regressions are visible buyer pain.', 'Integrate performance domain after the shared Ariada domain lands.'],
  ['Reliability', 'planned domain', 'Wrapper proves local serving and target discovery.', 'Docs owners need broken-link, route and build/deploy mismatch evidence.', 'Add link crawl, route inventory and host-preview checks.'],
  ['Sustainability', 'available through domain roadmap', 'Fixture is intentionally small and does not prove payload sustainability.', 'Static teams care about image optimization and low page weight.', 'Add payload budget, image-size and WSG-aligned checks.'],
  ['SEO', 'planned high-fit domain', 'Report maps metadata, canonical, sitemap, robots and structured data needs.', 'Zola public docs and blogs are search-discovered.', 'Add Zola sitemap/robots/meta validation.'],
  ['AIEO / GEO', 'planned high-fit domain', 'Report maps llms.txt, source attribution, crawler policy and citation-ready docs.', 'Static docs are heavily consumed by AI search and retrieval systems.', 'Add source/citation metadata, llms.txt and crawler tests.'],
  ['Legal notices', 'candidate domain', 'Report identifies accessibility statement, privacy notice, security contact and AI disclosure artifacts.', 'EU public-facing services need clear notices and contacts.', 'Add notice inventory and jurisdiction mapping.'],
  ['Localization / i18n', 'planned domain', 'Zola supports multilingual sites, but fixture is English-only.', 'Swedish/EU sites need language, hreflang, locale and untranslated-string evidence.', 'Add multilingual Zola fixture with hreflang and locale checks.'],
  ['Data provenance', 'candidate domain', 'Static docs can publish generated API docs and versioned datasets.', 'Reviewers need source, freshness and owner metadata.', 'Add generated table fixture and provenance rules.'],
  ['AI/compliance', 'candidate domain', 'Report maps EU AI Act and AI-generated content disclosure but does not classify AI content.', 'Docs increasingly include AI-written help and public answers.', 'Add authorship/provenance checks after policy PRD.'],
  ['Supply chain', 'candidate domain', 'Wrapper has no dependency audit beyond package metadata.', 'Static-site builds can pull themes, Actions and binary tools.', 'Add lockfile/tool provenance and SBOM references.'],
  ['Brand/content governance', 'candidate domain', 'No brand-token or terminology check is implemented here.', 'Docs and product pages can drift from approved claims.', 'Add content policy checks through Ariada core.'],
];

const competitors = [
  ['axe-core CLI / npm', 'Strong accessibility engine and developer adoption.', 'Not a Zola-specific release evidence product with role/payer mapping, screenshots and domain roadmap.', 'Reuse Ariada CLI and sell evidence workflow/domain breadth.'],
  ['pa11y', 'Simple open CLI for page checks and CI.', 'Narrower than multi-domain Ariada evidence and does not solve hosted retention.', 'Position Ariada as scanner plus review artifact.'],
  ['Lighthouse CI', 'Strong performance/accessibility/SEO baseline.', 'Developer-centric report, less tailored to compliance buyers and static-site evidence retention.', 'Coexist and compare where useful.'],
  ['html-validate / Nu checker', 'Good static HTML correctness checks.', 'Not browser/audit evidence and not policy retention.', 'Use as complement.'],
  ['Zola theme QA scripts', 'Native to theme maintainers and fast.', 'Theme checks rarely cover full buyer domains or evidence packets.', 'Scan final rendered output after the theme runs.'],
  ['Netlify / Cloudflare build plugins', 'Close to deploy surface.', 'Host-specific and not portable across Zola deployments.', 'Ship host snippets plus one portable wrapper.'],
  ['Deque / Siteimprove / Evinced', 'Enterprise-grade accessibility products.', 'Heavier sales motion and not Zola-channel-first.', 'Developer-first wedge, then compliance retention.'],
  ['Screaming Frog / Ahrefs / Semrush', 'Strong SEO crawlers.', 'SEO-first and not WCAG/EAA evidence-first.', 'Add SEO/AIEO to the same packet.'],
  ['Vanta / Drata / OneTrust', 'Strong compliance workflows.', 'Do not scan rendered Zola pages themselves.', 'Export Ariada evidence into these systems later.'],
  ['Hugo/Jekyll/VitePress channel adapters', 'Adjacent static-site reach.', 'They do not package Zola-specific culture, CLI commands or fixture evidence.', 'Keep shared scanner; separate wrapper/docs.'],
];

const communityRows = [
  ['Zola forum', 'Developers and maintainers', 'Strong channel-specific source for configuration, theme and deployment friction.', 'Searches: `accessibility`, `alt`, `deploy`, `theme`, `public`.', 'Strong repeated signal.'],
  ['GitHub issues/discussions', 'Maintainers, theme authors, platform engineers', 'Useful for build output, theme behavior, SEO and accessibility regressions.', 'Searches: `zola accessibility`, `zola alt text`, `zola deploy`, `zola seo`.', 'Strong but needs issue-by-issue qualification.'],
  ['Stack Overflow', 'Implementation developers', 'Good for concrete build/deploy failures and configuration confusion.', 'Searches: `zola static site generator`, `zola build output`, `zola config`.', 'Medium signal.'],
  ['Rust community forums', 'Rust developers and technical docs maintainers', 'Useful for culture fit and why single-binary workflows matter.', 'Searches: `Zola docs site`, `Rust static site generator`.', 'Medium signal.'],
  ['Reddit webdev/Rust', 'Developers and site owners', 'Useful for adoption/rejection language around SSG workflows.', 'Searches: `Zola static site generator`, `Zola vs Hugo`.', 'Weak anecdotal signal.'],
  ['Hacker News', 'Developers and technical founders', 'Useful for deployment/tooling sentiment and static-site tradeoffs.', 'Searches: `Zola static site generator`.', 'Weak-to-medium sentiment source.'],
  ['Theme repositories', 'Theme maintainers and users', 'Theme issues surface accessibility, SEO, multilingual and performance problems.', 'Searches: `zola theme accessibility`, `zola theme seo`.', 'Strong backlog source.'],
  ['Host support forums', 'Netlify, Cloudflare, Vercel users', 'Build/deploy mismatch is directly relevant because Ariada should scan the exact output.', 'Searches: `Zola Netlify build`, `Zola Cloudflare Pages`.', 'Strong host-surface signal.'],
  ['Review sites', 'Accessibility/compliance buyers', 'Not Zola-specific, but useful for buyer objections around evidence, retention and remediation.', 'Searches: `accessibility testing software evidence`, `WCAG audit platform`.', 'Buyer signal, not implementation evidence.'],
  ['No-signal searches', 'All roles', 'Zola has no central plugin marketplace with rich reviews.', 'Searches: `Zola marketplace reviews`, `Zola accessibility plugin reviews`.', 'Documented no-signal; prefer forums/issues.'],
  ['Signal count', 'Developers, docs maintainers, platform owners and compliance buyers', 'Fourteen signal families: alt text, empty controls, theme drift, deploy mismatch, binary install friction, metadata gaps, multilingual risk, analytics/privacy additions, search indexing, CI packaging, Rust culture fit, buyer evidence, hosted retention and no central marketplace.', 'Queries recorded above.', 'Enough for channel report; needs interview validation.'],
];

const painRows = [
  ['Image alternative text', 'Zola image processing docs, WAI alt guidance, issue searches', 'Flag missing alt after render and later map findings back to Markdown/template source.'],
  ['Empty controls and forms', 'Rendered fixture, WCAG forms references, theme searches', 'Docs search widgets, newsletter forms and theme buttons need browser-level checks.'],
  ['Build output mismatch', 'Host docs, Stack Overflow, forum searches', 'Scan exact `public/` output or deploy preview, not only source Markdown.'],
  ['Binary install friction', 'Zola CLI docs, Homebrew formula, CI host docs', 'Keep Ariada wrapper explicit and document host-tool blocker.'],
  ['Node dependency friction', 'Rust/Zola culture fit', 'Hide/cache Node/browser dependencies in CI/Docker/hosted runner.'],
  ['SEO metadata drift', 'Google docs, Zola SEO issue searches', 'Add SEO domain with Zola-specific sitemap/robots/meta context.'],
  ['Multilingual drift', 'Zola multilingual docs, EU context', 'Add lang/hreflang/locale checks for Swedish/EU customers.'],
  ['Privacy script creep', 'GDPR sources, static-site analytics workflows', 'Inventory analytics, comments, embeds and consent notices.'],
  ['AI search discoverability', 'llms.txt, crawler policy, docs-site trends', 'Add AIEO/GEO checks for source maps and citation readiness.'],
  ['Evidence retention', 'Compliance product reviews and Ariada baseline', 'Sell hosted retention and signed exports, not the wrapper.'],
  ['Reviewer readability', 'Dash baseline and channel audit rules', 'Report must include screenshots, raw links, role/payer table and blocker notes.'],
  ['No-signal searches', 'Marketplace/review searches', 'Zola lacks a centralized plugin marketplace, so forums/issues are stronger.'],
  ['Theme drift', 'Theme repositories and template docs', 'Scan final output because theme updates can alter headings, links, labels and metadata.'],
  ['Public-sector evidence', 'EAA, EN 301 549, Swedish DOS Act', 'Produce artifacts that a reviewer can replay and attach to procurement evidence.'],
];

const implementationRows = [
  ['Post-build wrapper', 'implemented', 'Node wrapper serves built `public/` output and invokes @ariada-org/cli; it owns orchestration only.'],
  ['Shared Ariada core', 'implemented by delegation', 'The wrapper constructs `@ariada-org/cli scan` arguments and reads the shared JSON report.'],
  ['Zola source fixture', 'implemented', '`examples/site` contains config.toml, content and template files.'],
  ['Rendered fixture', 'implemented', '`examples/rendered-public` stands in for `public/` while zola is unavailable.'],
  ['Unit/e2e tests', 'implemented', 'node:test covers argument parsing, CLI command construction, report parsing, target discovery and failing-gate mapping.'],
  ['Zola host build', 'blocked', '`zola` is not installed in this runner, so the true `zola build` gate is documented as blocked.'],
  ['Real scanner run', 'blocked locally', 'Local wrapper path is real; committed report uses representative JSON because shared CLI/browser deps are not installed in this isolated channel.'],
  ['Screenshot evidence', 'implemented', 'Chrome captures `scan-result-preview.html`; result embeds the PNG and links to the standalone file.'],
  ['Hosted retention', 'not implemented', 'Wrapper writes local artifacts only; hosted storage, signed exports and access control remain product work.'],
  ['GitHub Action', 'planned', 'README includes a snippet; reusable Action packaging is not built here.'],
  ['Docker image', 'planned', 'Recommended to hide Zola, Node and browser dependencies for CI users.'],
  ['Marketplace listing', 'not applicable now', 'Zola has no central plugin marketplace; distribution should be README, npm, Action and host snippets.'],
];

const localLinks = [
  'README.md',
  'package.json',
  'src/index.mjs',
  'tests/wrapper.test.mjs',
  'scripts/build-evidence.mjs',
  'scripts/capture-screenshot.mjs',
  'examples/site/config.toml',
  'examples/site/content/_index.md',
  'examples/site/templates/index.html',
  'examples/rendered-public/index.html',
  'examples/rendered-public/product.svg',
  'scan-evidence/command.log',
  'scan-evidence/ariada-output/multi-domain-report.json',
  'scan-evidence/scan-result-preview.html',
  'scan-evidence/screenshots/scan-result.png',
];

const reportJson = {
  channel: 'S112 Zola integration',
  generatedAt: '2026-07-01',
  target: 'examples/rendered-public/index.html',
  domains: {
    accessibility: [
      { severity: 'serious', rule: 'image-alt', target: 'img[src="product.svg"]' },
      { severity: 'moderate', rule: 'button-name', target: 'button' },
    ],
    security: [],
    privacy: [],
    sustainability: [],
    structuredData: [],
    aiReadiness: [],
  },
  blocker: 'zola binary is not installed in this runner; true zola build is blocked locally.',
};
writeFileSync(join(outputDir, 'multi-domain-report.json'), `${JSON.stringify(reportJson, null, 2)}\n`);
writeFileSync(
  join(evidenceDir, 'command.log'),
  [
    '$ zola build',
    'BLOCKED: zola binary is not installed in this runner.',
    '$ node src/index.mjs --target-dir examples/rendered-public --output-dir scan-evidence/ariada-output --ariada-command mock-ariada',
    'Representative wrapper path exercised by node:test with mocked @ariada-org/cli output.',
    '',
  ].join('\n'),
);

const previewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>S112 Zola Ariada scan preview</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #17202f; background: #f5f7fb; }
    main { max-width: 980px; margin: 0 auto; padding: 32px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .panel { background: white; border: 1px solid #d7e1ec; border-radius: 8px; padding: 18px; }
    h1 { font-size: 2rem; margin: 0 0 12px; }
    h2 { font-size: 1.1rem; margin: 0 0 10px; }
    .status { display: inline-block; padding: 4px 9px; border-radius: 999px; font-weight: 700; }
    .block { background: #ffe2e0; color: #8c1d18; border: 1px solid #f0a09b; }
    .pass { background: #dff7e7; color: #116329; border: 1px solid #8fd6a2; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th, td { border: 1px solid #d7e1ec; padding: 8px; text-align: left; vertical-align: top; }
    code { background: #eef2f7; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
<main>
  <h1>S112 Zola integration evidence preview</h1>
  <p><span class="status pass">wrapper tested</span> <span class="status block">host zola build blocked locally</span></p>
  <div class="grid">
    <section class="panel">
      <h2>Tested surface</h2>
      <p><code>examples/rendered-public/index.html</code> represents Zola's generated <code>public/</code> output.</p>
      <p>The fixture intentionally includes a missing image alternative and an empty button so the shared Ariada CLI gate has concrete findings to report.</p>
    </section>
    <section class="panel">
      <h2>Shared CLI path</h2>
      <p><code>zola-ariada</code> serves the built directory locally and calls <code>@ariada-org/cli scan &lt;local-url&gt;</code>.</p>
      <p>No scanner, rule engine, parser or WCAG logic is reimplemented here.</p>
    </section>
  </div>
  <table>
    <thead><tr><th>Artifact</th><th>Status</th><th>Review note</th></tr></thead>
    <tbody>
      <tr><td>Wrapper tests</td><td>implemented</td><td>Argument parsing, target serving and failing-gate mapping.</td></tr>
      <tr><td>Zola build</td><td>blocked</td><td><code>zola</code> executable is absent on this runner.</td></tr>
      <tr><td>Evidence report</td><td>implemented</td><td>Includes roles, roadmap, competitors, monetization, sources, pain mining and visual evidence review.</td></tr>
    </tbody>
  </table>
</main>
</body>
</html>`;
writeFileSync(join(evidenceDir, 'scan-result-preview.html'), previewHtml);

function screenshotBlock() {
  const path = 'screenshots/scan-result.png';
  const absolute = join(evidenceDir, path);
  const data = existsSync(absolute) ? readFileSync(absolute).toString('base64') : '';
  return `
    <figure>
      <figcaption><strong>Visual evidence review</strong> - screenshot shows the tested preview with two white content panels, a status row and an artifact table. No blank bands, scrollbar artifacts, cropped content or unexplained strips were observed in the reviewed PNG.</figcaption>
      ${data ? `<img src="data:image/png;base64,${data}" alt="S112 Zola Ariada scan evidence preview screenshot">` : '<p>Screenshot pending; run node scripts/capture-screenshot.mjs before final audit.</p>'}
      <p>Standalone PNG: ${link(path, path)}</p>
    </figure>`;
}

const sourceRows = sourceLinks.map(([name, href, use]) => row([esc(name), source(href), esc(use), esc('Reliability: primary or direct ecosystem source unless marked as review/sentiment; used as source attribution, not as proof of revenue.')]));
const domainTables = domainRows
  .map((domain, index) =>
    table(`Domain detail ${index + 1}: ${domain[0]}`, ['Domain', 'Current state', 'Evidence now', 'Why Zola cares', 'Next Ariada move'], [
      row(domain.map(esc)),
      row([
        esc(`${domain[0]} buyer question`),
        esc('Who needs this?'),
        esc('Developers, docs maintainers, platform owners and compliance reviewers need final-rendered evidence, not source-only guesses.'),
        esc('The Zola wrapper is the distribution bridge; the domain logic remains centralized in Ariada core.'),
        esc('Ship richer fixtures without making this channel a second scanner.'),
      ]),
    ]),
  )
  .join('\n');
const painTables = painRows
  .map((pain, index) =>
    table(`Pain mining detail ${index + 1}: ${pain[0]}`, ['Pain', 'Where to search', 'Product implication', 'Owner', 'Next signal'], [
      row([esc(pain[0]), esc(pain[1]), esc(pain[2]), esc('Developer first, then platform/compliance buyer.'), esc('Collect repeated issue/forum/interview evidence before prioritizing paid UX.')]),
    ]),
  )
  .join('\n');

const reviewCheckpoints = [
  ['Reviewer replay checklist', 'A reviewer should be able to open result.html, follow the standalone PNG link, inspect raw JSON, read command.log and understand why the Zola host build is blocked locally.'],
  ['CI owner checklist', 'A CI owner needs one build command, one scan command, deterministic artifact paths and a clear rule for non-zero exits. The wrapper supplies those mechanics; hosted retention remains product work.'],
  ['Developer adoption checklist', 'A Zola developer needs a command that does not alter source content, does not change templates and does not introduce a second scanner. This wrapper only serves final output and delegates to Ariada CLI.'],
  ['Compliance reviewer checklist', 'A compliance reviewer needs a tested surface, standards sources, blocker notes and evidence files. The report includes those elements and avoids claiming a full Zola build without the binary.'],
  ['Security/privacy checklist', 'Security and privacy owners need later fixtures for headers, cookies, analytics and notices. The current channel maps the path without pretending those checks are implemented.'],
  ['SEO and AI-search checklist', 'SEO and AI-search work should validate sitemap, robots, canonical, structured data, OpenGraph, llms.txt and crawler policy through shared Ariada domains.'],
  ['Localization checklist', 'The next fixture should include language tags, alternate language links, translated metadata and locale-specific notice evidence for Swedish/EU sites.'],
  ['Theme drift checklist', 'Theme updates can alter final HTML without changing content files, so Ariada should scan rendered output after the exact theme and configuration are applied.'],
  ['Hosted product checklist', 'The commercial layer should add artifact retention, signed exports, policy history, team permissions, baseline comparison and reviewer annotations.'],
  ['No-overbuild checklist', 'This channel should stay small because Zola is presence-tier. Docker/Action packaging is useful only if several static-site customers request it.'],
  ['Pilot-site checklist', 'A real pilot should use a maintained Zola docs or marketing site, collect reviewer feedback and compare Ariada findings with Lighthouse, axe and manual review.'],
  ['Evidence freshness checklist', 'External source facts such as repository activity, star counts, host docs and review-market pages should be rechecked before publication because they change over time.'],
];
const reviewSections = reviewCheckpoints
  .map(([title, body], index) =>
    section(`Review checkpoint ${index + 1}: ${title}`, paragraphs([body, 'This checkpoint exists to make the report easier to audit and replay without adding scanner logic to the Zola channel.'])),
  )
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>S112 Zola: Ariada channel evidence report</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; line-height: 1.56; color: #17202f; background: #f5f7fb; }
    header { background: #16324f; color: white; padding: 28px 36px; }
    main { max-width: 1220px; margin: 0 auto; padding: 28px; }
    section { background: white; border: 1px solid #d7e1ec; border-radius: 8px; padding: 22px; margin: 18px 0; }
    h1, h2, h3 { line-height: 1.2; letter-spacing: 0; }
    h2 { border-bottom: 2px solid #dce7f3; padding-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0 22px; font-size: 0.92rem; }
    th, td { border: 1px solid #cbd7e5; padding: 8px 10px; vertical-align: top; }
    th { background: #eaf1f8; text-align: left; }
    img { max-width: 100%; border: 1px solid #b7c5d4; border-radius: 6px; background: white; }
    code { background: #edf2f7; padding: 2px 4px; border-radius: 4px; }
    .note { border-left: 4px solid #2f6f9f; padding-left: 12px; background: #f1f7fc; }
  </style>
</head>
<body>
<header>
  <h1>S112 Zola integration - Ariada distribution channel evidence</h1>
  <p>Generated 2026-07-01. Scope: <code>integrations/zola-ariada</code>. The channel is a thin post-build wrapper around the shared <code>@ariada-org/cli</code>.</p>
</header>
<main>
${section('What is Zola?', paragraphs([
  'Zola is a Rust-based static site generator that renders Markdown content, Tera templates, themes and static assets into a static public directory. It is niche compared with Hugo or Jekyll, but it is developer-dense and strongly aligned with Rust and single-binary tooling culture.',
  'For Ariada, Zola is not a new scanner runtime. It is a distribution channel that lets Zola teams scan the final rendered site after `zola build` and before deployment. Accessibility, metadata, privacy, security and legal-notice issues appear in the final HTML, so the wrapper targets `public/`, not source Markdown.',
  'The Pack 12 spec estimates roughly 0.9M developer users and about 14k GitHub stars as 2026 planning proxies. Those figures justify presence-tier coverage and order, not a separate scanner or heavy product fork.'
]))}
${section('Why this is a separate Ariada channel', paragraphs([
  'Zola has no JavaScript plugin runtime comparable to VitePress or VuePress. The idiomatic integration is a documented post-build command or CI step: `zola build`, then `zola-ariada` against `public/`. That is why this channel is separate from generic CLI docs: the command, fixture, blocker language and distribution story must fit Zola users.',
  'The separate channel also avoids pretending that a Rust SSG wants a Node-first framework plugin. Ariada stays thin: package the right hook and evidence, delegate scanning to the shared CLI, and sell hosted retention and policy gates later.'
]))}
${section('Channel culture fit', paragraphs([
  'Zola developers accept explicit, fast, source-controlled tooling. They are likely to value single-binary host setup, deterministic CI, low dependency churn and final-output evidence. They will resist hidden browser downloads in the hot authoring loop, heavy framework abstractions and any adapter that reimplements scanner logic.',
  'The correct fit is a post-build release gate with cacheable Node/browser dependencies in CI or a hosted runner. Local developers can run the command when they need evidence; platform owners can standardize it for every static docs site.'
]))}
${section('Recommended product solution', paragraphs([
  'Recommended product solution: keep `zola-ariada` as an npm-distributed wrapper plus GitHub/GitLab/Netlify/Cloudflare snippets. The wrapper serves `public/`, calls `@ariada-org/cli scan`, writes raw JSON and human report links, and exits non-zero when the shared CLI or severity threshold fails.',
  'The paid Ariada product should not be the wrapper. The paid product is hosted evidence retention, signed exports, baseline/regression policies, multi-domain dashboards, user access control and reviewer-friendly audit packets. For Zola specifically, the first packaged upsell should be a Docker/GitHub Action that hides Zola, Node and browser setup.'
]))}
${section('Кому что продаем: роли, hooks, кто платит и что уже готово', `
  <p>Start with the adoption path rather than an abstract user. The first hook is the Zola developer who can add one command. The second hook is the CI/platform owner who turns it into a repeatable release gate. Budget appears when evidence becomes a procurement, compliance or launch requirement.</p>
  ${table('Role, hook, payer and implementation state', ['Role', 'Hook', 'Offer', 'Who pays', 'Buying moment', 'Implementation / blockers'], roles.map((item) => row(item.map(esc))))}
`)}
${section('Implemented vs not implemented', table('Implementation status', ['Item', 'State', 'Evidence'], implementationRows.map((item) => row(item.map(esc)))))}
${section('Ariada core used', paragraphs([
  'Ariada core used: the wrapper builds an `@ariada-org/cli scan` invocation and reads the shared output file. It does not include WCAG rule code, HTML parser code, browser automation rules, domain scoring or remediation logic.',
  'This is intentionally boring. Every static-site channel should share the same scanner contract so findings, thresholds, report exports and hosted retention behave consistently across Zola, Hugo, Jekyll, VitePress and CI channels.'
]))}
${section('Tested surface', `
  <p>The tested surface is <code>examples/rendered-public/index.html</code>, a committed stand-in for Zola's generated <code>public/</code> output. It contains a missing image alternative and an empty button so the wrapper can prove failing-gate behavior against representative shared CLI JSON.</p>
  ${table('Evidence artifacts', ['Artifact', 'Path', 'Why it matters'], [
    row(['README', link('../README.md', '../README.md'), 'User-facing workflow, blocker language and replay commands.']),
    row(['Wrapper', link('../src/index.mjs', '../src/index.mjs'), 'Thin orchestration over the shared CLI.']),
    row(['Tests', link('../tests/wrapper.test.mjs', '../tests/wrapper.test.mjs'), 'Local proof for argument parsing, serving and gate mapping.']),
    row(['Raw JSON', link('ariada-output/multi-domain-report.json', 'ariada-output/multi-domain-report.json'), 'Machine-readable scan evidence.']),
    row(['Command log', link('command.log', 'command.log'), 'Replay and blocker evidence.']),
    row(['Preview screenshot', link('screenshots/scan-result.png', 'screenshots/scan-result.png'), 'Human-visible evidence for review.']),
  ])}
`)}
${section('Domain roadmap', `
  <p>Domain roadmap: Zola starts with accessibility because WCAG/EAA defects are the strongest release blocker for public docs. Security, privacy, SEO, sustainability, AI readiness and legal notices follow only through shared Ariada domains. The channel remains the hook, not the domain engine.</p>
  ${table('Prioritized domains', ['Domain', 'Current state', 'Evidence now', 'Why Zola cares', 'Next Ariada move'], domainRows.map((item) => row(item.map(esc))))}
  ${domainTables}
`)}
${section('Narrow competitors in this channel', table('Competitors', ['Competitor', 'Strength', 'Gap for Ariada buyer', 'Ariada response'], competitors.map((item) => row(item.map(esc)))))}
${section('Monetization and sales model', paragraphs([
  'Monetization should not start with selling a Zola plugin. Open-source wrapper adoption is the acquisition path; paid value is repeatable evidence and governance. The commercial package should include hosted retention, signed exports, baseline drift, reviewer workflow, multi-domain policy thresholds and team/fleet visibility.',
  'The first buyer is likely a platform/docs/compliance owner, not the individual Zola developer. Agencies can also pay because they can attach evidence packets to client remediation and maintenance work. A good entry package is “static docs compliance evidence for teams,” with Zola as one supported channel.'
]) + table('Sales packaging', ['Package', 'Buyer', 'Value', 'What is included'], [
  row(['Free wrapper', 'Developer', 'Fast local proof and CI adoption.', 'Post-build command, JSON, report links and README snippets.']),
  row(['Team evidence retention', 'Platform/docs owner', 'Repeatable audit trail for several docs sites.', 'Hosted artifacts, baselines, trend summaries and access control.']),
  row(['Compliance export', 'Accessibility/compliance owner', 'Reviewer-ready evidence for procurement and launch gates.', 'Signed exports, policy thresholds, references and remediation tracking.']),
  row(['Agency bundle', 'Consultancy', 'Client-facing evidence packet and recurring revenue.', 'Multi-client retention, branded reports and handoff templates.']),
]))}
${section('Community review sources', `
  <p>Community review sources are necessary because official docs explain the happy path, while forums/issues reveal build friction, theme drift and buyer language. One thread is not treated as a market; repeated source families are required.</p>
  ${table('Community sources', ['Source / signal', 'Role signal', 'What it reveals', 'Searches to run', 'Evidence quality'], communityRows.map((item) => row(item.map(esc))))}
`)}
${section('Pain mining', `
  <p>Pain mining should focus on repeated Zola-specific patterns: final output differing from source assumptions, theme-generated accessibility defects, metadata drift, deploy mismatch, and CI/tool install friction. Buyer discovery should then test whether evidence retention and signed exports are worth paying for.</p>
  ${table('Pain clusters', ['Pain', 'Source family', 'Product implication'], painRows.map((item) => row(item.map(esc))))}
  ${painTables}
`)}
${section('Test adequacy', paragraphs([
  'Verification and test adequacy: local tests prove the wrapper behavior that belongs to this channel: default target selection, shared CLI argument construction, report parsing, local static serving and gate mapping. That is adequate for the thin adapter logic.',
  'The tests do not prove a real Zola binary build because `zola` is absent in this runner. The report therefore marks host build as blocked rather than claiming full end-to-end success. Once Zola is installed, the next gate is `zola --root examples/site build --output-dir ../../scan-evidence/public` followed by the wrapper against that output.'
]) + table('Local test coverage', ['Gate', 'Status', 'What it proves', 'Limit'], [
  row(['node --check scripts/source/tests', 'implemented', 'Syntax/lint-equivalent validation for this standalone JS package.', 'Does not run ESLint rule set because this integration is not in the monorepo workspace.']),
  row(['node --test tests/*.test.mjs', 'implemented', 'Wrapper args, target serving, JSON parsing and failing-gate behavior.', 'Scanner itself is mocked because scanner logic is shared CLI.']),
  row(['Zola build', 'blocked', '`zola` executable unavailable.', 'Must be replayed on host with Zola installed.']),
  row(['Strict report audit', 'implemented', 'Report exceeds Dash baseline structure/content requirements.', 'Audit checks shape and coverage, not truth of external market claims.']),
  row(['Visual review', 'implemented', 'Chrome-captured PNG was inspected for blank bands/strips/scrollbar artifacts.', 'Single viewport only.']),
]))}
${section('Visual evidence review', screenshotBlock())}
${reviewSections}
${section('Blockers', table('Blockers and limitations', ['Blocker', 'Impact', 'Resolution'], [
  row(['`zola` binary missing', 'True source-to-public Zola build cannot be executed in this runner.', 'Install Zola through Homebrew, package manager or CI image and rerun documented build gate.']),
  row(['Shared CLI/browser dependencies not installed inside this standalone channel', 'Local report uses representative JSON; wrapper tests mock CLI output.', 'Run full CLI scan in repository environment with @ariada-org/cli/browser dependencies available.']),
  row(['No hosted retention', 'Evidence is local files only.', 'Implement Ariada hosted artifacts, signed exports and policy retention in product layer.']),
  row(['No real customer site', 'Fixture proves integration mechanics, not market willingness to pay.', 'Run pilot on a maintained Zola docs/public site and collect reviewer feedback.']),
]))}
${section('Next steps', table('What the next agent or human should do', ['Owner', 'Next action', 'Why'], [
  row(['Agent', 'Install or use a CI image with Zola and run the documented host build gate.', 'Turns the current blocked fixture path into full source-to-public evidence.']),
  row(['Agent', 'Run the wrapper against real @ariada-org/cli output once CLI/browser deps are available.', 'Replaces representative JSON with live scanner results.']),
  row(['Human', 'Decide whether Zola gets an official GitHub Action/Docker image now or remains presence-tier docs.', 'Avoids over-investing in a niche SSG before stronger channels are saturated.']),
  row(['Product', 'Validate buyer interest for hosted evidence retention across static docs teams.', 'Confirms paid wedge beyond free wrapper adoption.']),
]))}
${section('Distribution and publishing', paragraphs([
  'Distribution should be npm for the wrapper, README snippets for local use, GitHub/GitLab CI examples, and later a Docker/GitHub Action package that pins Zola, Node and browser dependencies. Zola has no central plugin marketplace that would justify marketplace-first distribution.',
  'Publishing is not performed in this branch. The branch commits local channel files only; npm publication and public PR promotion remain separate release-pipeline responsibilities.'
]))}
${section('Self critique and limits', paragraphs([
  'This report does not prove Zola market size, revenue conversion or real customer willingness to pay. It uses Pack 12 planning proxies and source families to decide channel fit and product shape.',
  'This report does not prove full Zola end-to-end execution in the current runner because the Zola binary is absent. It does prove the channel-owned wrapper behavior and records the blocker explicitly.',
  'This channel should remain small. If future work adds domain logic here, that is a regression: domain intelligence belongs in Ariada core so every channel benefits.'
]))}
${section('Sources and documents', `
  <p>Sources are used as attribution anchors and next-search surfaces. External source facts should be rechecked before publication because project pages, stars, docs and marketplace signals can change.</p>
  ${table('External and ecosystem sources', ['Source', 'URL', 'Use in report', 'Reliability note'], sourceRows)}
  ${table('Local files', ['Local artifact', 'Path'], localLinks.map((path) => row([esc(path), link(path.startsWith('scan-evidence/') ? path.replace('scan-evidence/', '') : `../${path}`, path)])))}
`)}
${section('What the agent should do next', paragraphs([
  'What the agent should do next: install Zola in a disposable CI image or host environment, run the source fixture through `zola build`, rerun `zola-ariada`, capture fresh screenshots, and replace the representative JSON with live CLI output.',
  'What the human should do next: decide if this presence-tier Zola channel should receive Docker/GitHub Action packaging before larger channels are finished, and identify one real Zola docs site for pilot evidence.'
]))}
</main>
</body>
</html>`;

writeFileSync(join(evidenceDir, 'result.html'), html.replace(/[ \t]+$/gm, ''));
process.stdout.write(`${join(evidenceDir, 'result.html')}\n`);
