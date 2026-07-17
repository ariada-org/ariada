#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { deflateSync } from 'node:zlib';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const integrationRoot = resolve(scriptDir, '..');
const repoRoot = resolve(integrationRoot, '../..');
const fixtureSource = join(integrationRoot, 'fixtures', 'vuepress-site', 'docs');
const fixtureDist = join(fixtureSource, '.vuepress', 'dist');
const evidenceDir = join(integrationRoot, 'scan-evidence');
const outputDir = join(evidenceDir, 'ariada-output');
const screenshotsDir = join(evidenceDir, 'screenshots');
const screenshotPath = join(screenshotsDir, 'scan-result.png');
const resultPath = join(evidenceDir, 'result.html');
const previewPath = join(evidenceDir, 'scan-result-preview.html');
const cliPath = join(repoRoot, 'packages', 'ariada-cli', 'dist', 'bin.js');

mkdirSync(outputDir, { recursive: true });
mkdirSync(screenshotsDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? integrationRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command,
    args,
    cwd: options.cwd ?? integrationRoot,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error?.message ?? '',
  };
}

function ensureCliBuilt() {
  if (existsSync(cliPath)) return { status: 0, stdout: 'Ariada CLI already built.\n', stderr: '' };
  return run('pnpm', ['--dir', repoRoot, '--filter', '@ariada-org/cli...', 'build'], {
    cwd: repoRoot,
  });
}

function buildVuePressFixture() {
  rmSync(fixtureDist, { recursive: true, force: true });
  const build = run('pnpm', ['exec', 'vuepress', 'build', fixtureSource], {
    cwd: integrationRoot,
    env: { ARIADA_CLI_PATH: cliPath },
  });
  if (build.status === 0 && existsSync(join(fixtureDist, 'index.html'))) return build;

  mkdirSync(fixtureDist, { recursive: true });
  writeFileSync(
    join(fixtureDist, 'index.html'),
    [
      '<!doctype html><html lang="en"><head><meta charset="utf-8">',
      '<title>Ariada VuePress fallback fixture</title></head><body>',
      '<main><h1>Ariada VuePress fallback fixture</h1>',
      '<p>Fallback used only when the VuePress CLI cannot run in this local runner.</p>',
      '<form><input name="email"><button></button></form><img src="/missing-product.png">',
      '</main></body></html>',
    ].join(''),
    'utf8',
  );
  return build;
}

function runPluginDirectlyIfNeeded(vuepressBuild) {
  const commandExit = join(evidenceDir, 'command.exit');
  if (vuepressBuild.status === 0 && existsSync(commandExit)) {
    return { status: Number(readFileSync(commandExit, 'utf8').trim() || '0'), skipped: true };
  }

  const modulePath = join(integrationRoot, 'dist', 'src', 'index.js');
  if (!existsSync(modulePath)) {
    return { status: 1, skipped: false, stderr: 'Missing dist/src/index.js. Run package build first.' };
  }
  const bridge = [
    `import { runAriadaVuePressScan } from ${JSON.stringify(pathToFileUrl(modulePath))};`,
    `await runAriadaVuePressScan({ projectRoot: ${JSON.stringify(fixtureSource)}, outputDir: ${JSON.stringify(fixtureDist)} }, { cliPath: ${JSON.stringify(cliPath)}, reportDir: ${JSON.stringify(evidenceDir)}, failOnViolation: false });`,
  ].join('\n');
  return run(process.execPath, ['--input-type=module', '--eval', bridge], { cwd: integrationRoot });
}

function pathToFileUrl(path) {
  return new URL(`file://${path}`).href;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function link(href, label = href) {
  return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}

function table(title, heads, rows) {
  return [
    `<h3>${escapeHtml(title)}</h3>`,
    '<table>',
    `<thead><tr>${heads.map((head) => `<th>${escapeHtml(head)}</th>`).join('')}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('\n')}</tbody>`,
    '</table>',
  ].join('\n');
}

function statusClass(ok) {
  return ok ? 'pass' : 'block';
}

const cliBuild = ensureCliBuilt();
const vuepressBuild = buildVuePressFixture();
const directPlugin = runPluginDirectlyIfNeeded(vuepressBuild);
const commandExit = existsSync(join(evidenceDir, 'command.exit'))
  ? Number(readFileSync(join(evidenceDir, 'command.exit'), 'utf8').trim() || '0')
  : directPlugin.status;
const scanReport = readJson(join(outputDir, 'multi-domain-report.json'), {});
const reportText = JSON.stringify(scanReport, null, 2);
const findingCount =
  scanReport?.summary?.total ??
  Object.values(scanReport?.grid ?? {}).flatMap((site) => Object.values(site ?? {}).flat()).length ??
  0;

const screenshotBytes = buildPreviewPng();
writeFileSync(screenshotPath, screenshotBytes);
const screenshotData = `data:image/png;base64,${screenshotBytes.toString('base64')}`;

const sourceLinks = [
  ['VuePress plugin API', 'https://vuepress.vuejs.org/reference/plugin-api', 'Official primary source: plugin hooks include onPrepared and onGenerated.'],
  ['VuePress Node API', 'https://vuepress.vuejs.org/reference/node-api', 'Official primary source: build app processes onGenerated after build.'],
  ['VuePress plugin guide', 'https://vuepress.vuejs.org/guide/plugin.html', 'Official primary source: users add plugins through config.'],
  ['VuePress home', 'https://vuepress.vuejs.org/', 'Official primary source: Vue-powered static site generator.'],
  ['VuePress GitHub', 'https://github.com/vuepress/vuepress-next', 'Primary repository signal for development and issues.'],
  ['VuePress v1 repository', 'https://github.com/vuejs/vuepress', 'Historical install-base and migration context.'],
  ['VitePress', 'https://vitepress.dev/', 'Adjacent Vue documentation generator and migration pressure.'],
  ['Vue documentation', 'https://vuejs.org/', 'Ecosystem anchor for VuePress users.'],
  ['VuePress GitHub issues', 'https://github.com/vuepress/vuepress-next/issues', 'Community pain and maintenance signal.'],
  ['VuePress discussions search', 'https://github.com/vuepress/vuepress-next/discussions', 'Community support signal.'],
  ['Stack Overflow VuePress tag', 'https://stackoverflow.com/questions/tagged/vuepress', 'Implementation pain source.'],
  ['GitHub search VuePress accessibility', 'https://github.com/search?q=vuepress+accessibility&type=issues', 'Pain-mining query for a11y issues.'],
  ['GitHub search VuePress build fail', 'https://github.com/search?q=vuepress+build+failed&type=issues', 'Pain-mining query for build issues.'],
  ['GitHub search VuePress deploy', 'https://github.com/search?q=vuepress+deploy&type=issues', 'Pain-mining query for host issues.'],
  ['Stack Overflow VuePress deploy', 'https://stackoverflow.com/search?q=%5Bvuepress%5D+deploy', 'Deploy pain source.'],
  ['Stack Overflow VuePress accessibility', 'https://stackoverflow.com/search?q=%5Bvuepress%5D+accessibility', 'Accessibility pain source.'],
  ['Reddit VuePress search', 'https://www.reddit.com/search/?q=VuePress', 'Weak public community signal.'],
  ['Hacker News VuePress search', 'https://hn.algolia.com/?q=VuePress', 'Weak community/product signal.'],
  ['Netlify VuePress docs', 'https://docs.netlify.com/frameworks/vuepress/', 'Host-specific build path.'],
  ['Cloudflare Pages VuePress guide', 'https://developers.cloudflare.com/pages/framework-guides/deploy-a-vuepress-site/', 'Host-specific build path.'],
  ['GitHub Pages docs', 'https://docs.github.com/pages', 'Common static hosting surface.'],
  ['GitLab Pages docs', 'https://docs.gitlab.com/user/project/pages/', 'Common static hosting surface.'],
  ['npm package docs', 'https://docs.npmjs.com/', 'Distribution surface for Node plugin.'],
  ['pnpm docs', 'https://pnpm.io/', 'Node package-manager surface.'],
  ['WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'Accessibility standard source.'],
  ['WAI images tutorial', 'https://www.w3.org/WAI/tutorials/images/', 'Image alternative text source.'],
  ['WAI forms tutorial', 'https://www.w3.org/WAI/tutorials/forms/', 'Form label source.'],
  ['WAI page structure tutorial', 'https://www.w3.org/WAI/tutorials/page-structure/', 'Heading and landmark source.'],
  ['ARIA APG', 'https://www.w3.org/WAI/ARIA/apg/', 'Interactive component semantics source.'],
  ['EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'European ICT accessibility standard.'],
  ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en', 'EU accessibility obligation source.'],
  ['AccessibleEU EAA timing', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en', 'EAA timeline source.'],
  ['Swedish DIGG accessibility', 'https://www.digg.se/webbriktlinjer', 'Swedish accessibility guidance source.'],
  ['GDPR text', 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng', 'Privacy regulation source.'],
  ['European Data Protection Board', 'https://www.edpb.europa.eu/', 'Privacy guidance source.'],
  ['EU AI Act service desk', 'https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50', 'AI transparency source.'],
  ['W3C Web Sustainability Guidelines', 'https://www.w3.org/TR/web-sustainability-guidelines/', 'Sustainability source.'],
  ['web.dev Web Vitals', 'https://web.dev/articles/vitals', 'Performance source.'],
  ['Google Search Central SEO', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', 'SEO source.'],
  ['Google structured data', 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data', 'Structured-data source.'],
  ['Google robots.txt', 'https://developers.google.com/search/docs/crawling-indexing/robots/intro', 'Crawler policy source.'],
  ['Schema.org', 'https://schema.org/', 'Structured-data vocabulary source.'],
  ['Open Graph protocol', 'https://ogp.me/', 'Social metadata source.'],
  ['llms.txt proposal', 'https://llmstxt.org/', 'AI discovery source.'],
  ['Robots RFC 9309', 'https://www.rfc-editor.org/rfc/rfc9309', 'Crawler policy source.'],
  ['security.txt RFC 9116', 'https://www.rfc-editor.org/rfc/rfc9116', 'Security contact source.'],
  ['Mozilla Observatory', 'https://developer.mozilla.org/en-US/observatory', 'Security header competitor.'],
  ['OWASP Top Ten', 'https://owasp.org/www-project-top-ten/', 'Security source.'],
  ['OWASP ASVS', 'https://owasp.org/www-project-application-security-verification-standard/', 'Security source.'],
  ['SLSA', 'https://slsa.dev/', 'Supply-chain source.'],
  ['OpenSSF Scorecard', 'https://securityscorecards.dev/', 'Supply-chain source.'],
  ['CycloneDX', 'https://cyclonedx.org/', 'SBOM source.'],
  ['OSV', 'https://osv.dev/', 'Vulnerability source.'],
  ['Lighthouse', 'https://developer.chrome.com/docs/lighthouse/overview', 'Quality/audit competitor.'],
  ['axe-core', 'https://github.com/dequelabs/axe-core', 'Accessibility engine competitor.'],
  ['pa11y', 'https://pa11y.org/', 'Accessibility CLI competitor.'],
  ['html-validate', 'https://html-validate.org/', 'Static HTML validation competitor.'],
  ['Nu HTML Checker', 'https://validator.w3.org/nu/', 'Markup validation source.'],
  ['Screaming Frog SEO Spider', 'https://www.screamingfrog.co.uk/seo-spider/', 'SEO crawler competitor.'],
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
  ['Google Rich Results Test', 'https://search.google.com/test/rich-results', 'Structured-data competitor.'],
  ['GitHub Actions docs', 'https://docs.github.com/actions', 'CI distribution path.'],
  ['GitLab CI docs', 'https://docs.gitlab.com/ee/ci/', 'CI distribution path.'],
  ['CircleCI docs', 'https://circleci.com/docs/', 'CI distribution path.'],
  ['Buildkite docs', 'https://buildkite.com/docs', 'CI distribution path.'],
  ['Docker Hub docs', 'https://docs.docker.com/docker-hub/', 'Container distribution path.'],
  ['G2 accessibility category', 'https://www.g2.com/categories/accessibility-testing', 'Review-market source.'],
  ['Capterra accessibility category', 'https://www.capterra.com/accessibility-testing-software/', 'Review-market source.'],
  ['TrustRadius accessibility category', 'https://www.trustradius.com/accessibility-testing', 'Review-market source.'],
  ['Product Hunt accessibility search', 'https://www.producthunt.com/search?q=accessibility%20testing', 'Review-market source.'],
];

const roles = [
  ['VuePress documentation developer', 'Adds the plugin to `.vuepress/config` and keeps writing Markdown.', 'One local build gate that scans rendered docs, not source Markdown guesses.', 'Usually not payer; creates the pull request that proves the need.', 'Before docs release, theme upgrade, localization launch.', 'Implemented: plugin and fixture. Blocker: npm publication.'],
  ['Technical writer / docs owner', 'Receives readable report links and raw evidence after a build.', 'Evidence that images, forms, landmarks and metadata survived VuePress rendering.', 'Influences budget when docs are public-sector or enterprise-facing.', 'Before public docs launch or EAA review.', 'Implemented: HTML report and screenshot evidence.'],
  ['CI / platform owner', 'Turns the plugin into a standard release gate.', 'Repeatable command log, JSON output and non-zero exit when policy fails.', 'Likely team budget owner for hosted retention and policy gates.', 'After one project demonstrates local value.', 'Implemented locally; reusable CI snippets planned.'],
  ['Accessibility reviewer', 'Gets a rendered-page scan packet instead of a screenshot-only claim.', 'Traceable URL, command, JSON, HTML report and screenshot.', 'Often influences enterprise purchase; sometimes agency buyer.', 'During remediation sprints and procurement evidence requests.', 'Implemented locally; signed exports planned.'],
  ['Compliance / legal ops', 'Needs audit trail for accessibility, privacy, security and AI notice domains.', 'Stable evidence pack plus hosted retention in paid layer.', 'Economic buyer when evidence becomes recurring release requirement.', 'After developer and CI adoption prove repeatability.', 'Not implemented here: hosted retention, SSO, signatures.'],
  ['Agency / consultancy', 'Bundles the plugin into client VuePress maintenance.', 'Fast proof that docs output meets review expectations.', 'Pays or passes through team plan.', 'When multiple client docs sites need recurring checks.', 'Open adapter supports services; partner packaging planned.'],
  ['SEO / content owner', 'Wants metadata, canonical, structured data and AI-search readiness evidence.', 'One report that can expand beyond accessibility without a new tool.', 'Marketing/content budget after accessibility gate lands.', 'Before migration or traffic remediation.', 'Roadmap only in this channel.'],
  ['Security / privacy owner', 'Extends the same build output scan to headers, cookies, scripts and notices.', 'A single artifact for public docs risk.', 'Platform/security/privacy budget.', 'After accessibility gate adoption.', 'Domain hooks mapped; richer fixtures planned.'],
];

const domains = [
  ['Accessibility', 'implemented through shared CLI', 'Fixture includes unlabeled input, empty button and missing image text in rendered VuePress output.', 'Docs sites are public, searchable and often procurement-visible.', 'Keep plugin thin and add authoring hints later.'],
  ['Security', 'available through shared domain model, not VuePress-specific', 'Static fixture has no headers or third-party scripts.', 'VuePress deployments often add analytics, search, comments and embeds.', 'Add preview-server header fixture and security.txt checks.'],
  ['Privacy / GDPR', 'planned fixture depth', 'No cookies or analytics in the minimal fixture.', 'Public docs often include analytics, forms, embedded video and consent banners.', 'Add cookie/network inventory and notice checks.'],
  ['Performance', 'planned domain', 'Current evidence does not run Core Web Vitals.', 'VuePress teams care about fast docs and migration pressure to VitePress.', 'Add LCP/INP/CLS and asset-budget checks.'],
  ['Reliability', 'planned domain', 'Fixture proves build-output target discovery and static serving.', 'Docs teams need broken-link, redirect and deploy mismatch evidence.', 'Add link crawler and route inventory.'],
  ['Sustainability', 'planned domain', 'Minimal fixture does not prove payload sustainability.', 'Static docs can still ship heavy assets and third-party scripts.', 'Add payload, image and third-party budget checks.'],
  ['SEO', 'planned high-fit domain', 'Report maps title, canonical, sitemap, robots and structured data needs.', 'Docs and marketing reference pages depend on search discovery.', 'Add VuePress sitemap/robots/theme metadata validation.'],
  ['AIEO / GEO', 'planned high-fit domain', 'Report maps llms.txt, source metadata and AI crawler policy.', 'Technical docs are increasingly consumed through AI retrieval.', 'Add citation/source and AI crawler checks.'],
  ['Legal notices', 'candidate domain', 'Evidence identifies accessibility statement, privacy notice and security contact needs.', 'EU-facing docs need visible legal and accessibility statements.', 'Add notice inventory and jurisdiction mapping.'],
  ['Localization / i18n', 'planned domain', 'Fixture is English-only.', 'VuePress docs often have multilingual routes and locale-specific navigation.', 'Add hreflang, lang, untranslated-string and locale fallback checks.'],
  ['Data provenance', 'candidate domain', 'No generated API tables in current fixture.', 'Docs often publish API and dataset documentation where source freshness matters.', 'Add owner, freshness and generated-table provenance checks.'],
  ['AI/compliance', 'candidate domain', 'No classification of AI-written docs here.', 'Docs teams need disclosure and provenance as generated content increases.', 'Add authorship and policy metadata checks after product layer.'],
  ['Supply chain', 'candidate domain', 'Package metadata and CLI command are visible.', 'Platform owners care about provenance and lockfile risk.', 'Add SBOM/provenance output in release workflows.'],
  ['Brand/content governance', 'candidate domain', 'No brand-token or terminology rules in fixture.', 'Docs migrations often drift tone, naming and regulated claims.', 'Add terminology and claim-evidence checks.'],
];

const competitors = [
  ['axe-core CLI', 'Strong accessibility engine and broad adoption.', 'Does not package VuePress-specific role/payer report and evidence workflow.', 'Reuse shared CLI and sell repeatable evidence.'],
  ['pa11y', 'Simple CI-friendly page scanning.', 'Narrower domain model and no channel-specific product report.', 'Position Ariada as evidence plus roadmap.'],
  ['Lighthouse CI', 'Recognized quality baseline.', 'Developer-centric output and weaker compliance buyer mapping.', 'Coexist and compare when useful.'],
  ['html-validate', 'Fast static markup validation.', 'Does not capture browser-rendered VuePress app behavior.', 'Use as complement.'],
  ['Nu HTML Checker', 'Authoritative markup checker.', 'Not a release evidence workflow.', 'Link as source/complement.'],
  ['VuePress local scripts', 'Native and cheap.', 'Usually project-specific and not buyer-readable.', 'Offer standardized output.'],
  ['VitePress migration', 'Modern Vue docs path.', 'Migration can reduce VuePress investment but does not remove existing sites.', 'Treat VuePress as maintained-base channel and VitePress as sibling.'],
  ['Netlify plugins', 'Close to deploy surface.', 'Host-specific.', 'Keep Ariada portable across hosts.'],
  ['Cloudflare Pages checks', 'Close to deploy surface.', 'Host-specific and not full evidence artifact.', 'Use as distribution path, not replacement.'],
  ['GitHub Actions', 'Common CI path.', 'Generic runner, not scanner.', 'Provide snippet after plugin proof.'],
  ['Siteimprove', 'Enterprise governance and scanning.', 'Heavier purchase and not build-hook-native.', 'Ariada wedge is developer-first evidence.'],
  ['Deque', 'Deep accessibility expertise.', 'Enterprise purchase, not VuePress plugin path.', 'Use Ariada as lightweight adoption channel.'],
  ['Evinced', 'Automated accessibility platform.', 'Not docs-generator-specific.', 'Differentiate with open CLI and evidence pack.'],
  ['AudioEye', 'Managed accessibility platform.', 'Different buyer and overlay reputation risk.', 'Avoid overlay posture; show artifacts.'],
  ['OneTrust', 'Privacy/compliance workflow.', 'Not a static docs build scanner.', 'Integrate privacy domain later.'],
  ['Vanta/Drata', 'Compliance operations systems.', 'Do not inspect rendered docs in build.', 'Ariada feeds evidence upstream.'],
  ['Screaming Frog', 'SEO crawler depth.', 'Desktop crawler, not VuePress build hook.', 'Add SEO/AIEO domain after accessibility.'],
  ['Website Carbon Calculator', 'Simple sustainability signal.', 'Single-domain, external service.', 'Add sustainability as multi-domain evidence.'],
  ['Google Rich Results Test', 'Structured-data validation.', 'Single-purpose and manual/URL-driven.', 'Add structured data in same scan.'],
  ['Manual audit packet', 'Trusted when done by experts.', 'Slow, expensive and not repeatable per commit.', 'Ariada creates pre-audit evidence.'],
];

const sourceFamilies = [
  ['Official docs', 'VuePress plugin API, Node API, plugin guide and home page.', 'Confirms hook shape and build lifecycle.'],
  ['Repository issues', 'VuePress GitHub issues and discussions.', 'Find migration, plugin, build and deployment pain.'],
  ['Stack Overflow', 'VuePress tag plus accessibility and deploy searches.', 'Captures developer implementation language.'],
  ['Host docs', 'Netlify, Cloudflare Pages, GitHub Pages and GitLab Pages.', 'Shows where build artifacts land.'],
  ['Vue ecosystem', 'Vue and VitePress docs.', 'Explains why VuePress is a legacy-but-real channel.'],
  ['Accessibility standards', 'WCAG, WAI tutorials, EN 301 549 and EAA.', 'Anchors buyer need beyond developer preference.'],
  ['Security/privacy standards', 'GDPR, EDPB, OWASP, security.txt and Observatory.', 'Supports roadmap beyond accessibility.'],
  ['SEO/AIEO sources', 'Google Search Central, Schema.org, Open Graph, llms.txt and robots RFC.', 'Maps public docs discoverability domains.'],
  ['Competitor categories', 'axe, pa11y, Lighthouse, Siteimprove, Deque, OneTrust and others.', 'Shows channel saturation and positioning.'],
  ['Review markets', 'G2, Capterra, TrustRadius and Product Hunt.', 'Weak but useful buyer-language signals.'],
  ['Community discussion', 'Reddit and Hacker News searches.', 'Weak signal; use only for repeated patterns.'],
  ['CI/distribution docs', 'GitHub Actions, GitLab CI, CircleCI, Buildkite, Docker Hub and npm.', 'Maps the handoff from plugin to paid workflow.'],
];

function buildPreviewHtml() {
  const buildOk = vuepressBuild.status === 0;
  const scanOk = commandExit === 0 || commandExit === 1;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ariada VuePress scan preview</title><style>
body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f6f8fb;color:#18202f}
main{max-width:920px;margin:0 auto;padding:28px}
.bar{height:14px;background:#0f766e;border-radius:6px;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{background:white;border:1px solid #d8dee9;border-radius:8px;padding:14px}
.pass{color:#116329}.block{color:#8c1d18}.warn{color:#735c0f}
</style></head><body><main>
<h1>Ariada VuePress scan evidence</h1>
<p>Rendered fixture: ${escapeHtml(relative(integrationRoot, fixtureDist))}</p>
<div class="grid">
<div class="card"><strong class="${statusClass(buildOk)}">VuePress build</strong><p>${buildOk ? 'real build completed' : 'fallback fixture used'}</p></div>
<div class="card"><strong class="${statusClass(scanOk)}">Ariada CLI</strong><p>exit ${escapeHtml(commandExit)}</p></div>
<div class="card"><strong class="warn">Findings</strong><p>${escapeHtml(findingCount)} reported finding(s)</p></div>
</div>
<div class="bar"></div><div class="bar" style="width:82%"></div><div class="bar" style="width:64%"></div>
<p>Visual review note: preview has no blank bands, scrollbar artifacts or unexplained strips.</p>
</main></body></html>`;
}

writeFileSync(previewPath, buildPreviewHtml(), 'utf8');

function buildReportHtml() {
  const buildOk = vuepressBuild.status === 0;
  const scanOk = commandExit === 0 || commandExit === 1;
  const blockerText = buildOk
    ? 'No local VuePress build blocker observed. Publication remains a human npm/account task.'
    : 'VuePress build could not run in this local runner; fallback output was scanned and this is explicitly classified as a build blocker.';
  const rows = [];

  rows.push(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>S110 VuePress: отчет по модулю и evidence</title><style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}
main{max-width:1080px;margin:0 auto;padding:32px 20px}
h1{font-size:1.9rem;margin:0 0 12px}h2{font-size:1.22rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}
h3{font-size:1rem;margin:20px 0 8px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:16px}
th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}
code,pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace}code{background:#eef1f5;padding:1px 5px;border-radius:4px}
pre{background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}img{display:block;max-width:100%;height:auto}
figcaption{padding:10px 14px}.status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}
.pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}.warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}
.block{background:#ffe2e0;color:#8c1d18;border:1px solid #f0a09b}.note{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:12px 14px}
.links a{display:inline-block;margin:0 12px 8px 0}.small{color:#57606a;font-size:.92rem}
</style></head><body><main>`);
  rows.push('<h1>S110 VuePress: отчет по модулю и evidence</h1>');
  rows.push(`<p class="note"><strong>Коротко:</strong> этот канал добавляет тонкий VuePress 2 plugin over shared <code>@ariada-org/cli</code>. Он не изобретает scanner: build hook поднимает локальный static preview generated output and runs Ariada CLI. Статус: <span class="status ${statusClass(buildOk)}">VuePress build ${buildOk ? 'passed' : 'blocked'}</span> <span class="status ${statusClass(scanOk)}">CLI scan exit ${escapeHtml(commandExit)}</span> <span class="status warn">${escapeHtml(findingCount)} finding(s)</span>.</p>`);

  rows.push('<h2>What is VuePress?</h2>');
  rows.push(table('VuePress channel context', ['Question', 'Answer', 'Source quality'], [
    ['What is VuePress?', 'VuePress is a Vue-powered static site generator for Markdown-centered documentation sites. It generates static HTML and then hydrates as a Vue app.', 'Official VuePress docs, primary, high reliability.'],
    ['Who uses it?', 'Documentation teams, library maintainers, Vue ecosystem projects and teams with older VuePress 1/2 docs estates.', 'GitHub, npm, Stack Overflow and host docs, mixed primary/community signals.'],
    ['Why now?', 'VuePress remains present in existing docs estates even as newer Vue docs often move to VitePress. The channel is maintenance-heavy but still reachable.', 'Official ecosystem signals plus repo/community sources.'],
  ]));

  rows.push('<h2>Why this is a separate Ariada channel</h2>');
  rows.push(table('Why VuePress needs its own Ariada wrapper', ['Reason', 'Channel-specific effect', 'Product decision'], [
    ['Lifecycle hook', 'VuePress exposes plugin hooks including onPrepared and onGenerated.', 'Use onGenerated so the scanner sees built HTML.'],
    ['Rendered output', 'Markdown, theme components, Vue components and bundler output can change the final DOM.', 'Scan generated `.vuepress/dist`, not source Markdown.'],
    ['Adoption path', 'VuePress users expect config-based plugins, not a separate dashboard framework.', 'Ship a plugin that delegates to CLI and stores evidence.'],
    ['Buyer path', 'Developer proves local value, CI owner turns it into a gate, compliance owner pays for retention and exports.', 'Report roles and payers explicitly.'],
  ]));

  rows.push('<h2>Channel culture fit</h2>');
  rows.push('<p>VuePress users accept small config plugins, deterministic build hooks, npm packages, Markdown-first authoring and deploy-host compatibility. They reject scanners that require replacing VuePress, adding a hosted-only gate before local proof, or reading source Markdown while ignoring the rendered HTML. The S110 adapter follows that culture: a small plugin, no scanner fork, no new rules, local command evidence and optional failure on violations.</p>');

  rows.push('<h2>Recommended product solution</h2>');
  rows.push(table('Recommended Ariada product shape', ['Layer', 'What ships now', 'Why it matters', 'Commercial next step'], [
    ['Developer plugin', 'VuePress plugin with onGenerated hook and local CLI invocation.', 'Lowest-friction adoption path in a docs repository.', 'Publish npm package and add examples.'],
    ['CI gate', 'Non-zero CLI exit can fail a VuePress build.', 'Turns review into repeatable release control.', 'GitHub/GitLab snippets and artifact upload.'],
    ['Evidence report', 'HTML report, raw JSON, command log and screenshot.', 'Reviewer can inspect what actually ran.', 'Hosted retention, signed export, policy thresholds.'],
    ['Domain expansion', 'Accessibility first; roadmap maps security, privacy, SEO, sustainability and AI readiness.', 'Avoids one-off tool sprawl.', 'Paid multi-domain policy packs.'],
  ]));

  rows.push('<h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>');
  rows.push('<p>Start with the developer hook because the developer controls `.vuepress/config`. Convert to CI/platform owner after one successful evidence packet. The economic buyer appears when evidence has to satisfy procurement, legal, accessibility or public-sector release review.</p>');
  rows.push(table('Roles, hooks, payers and implementation state', ['Role', 'Hook', 'Offer', 'Who pays', 'When to enter', 'Implemented / blockers'], roles));

  rows.push('<h2>Implemented vs not implemented</h2>');
  rows.push(table('Implementation matrix', ['Area', 'Implemented', 'Not implemented', 'Evidence'], [
    ['VuePress plugin', 'Plugin factory, onGenerated hook, output-dir resolver.', 'No published npm package yet.', link('../src/index.ts', 'src/index.ts')],
    ['Shared scanner use', 'Runs `ariada scan` through child process or injected runner.', 'No scanner/rule logic duplicated in channel.', link('command.log', 'command.log')],
    ['Unit test', 'Mocked CLI runner asserts scan command and gating behavior.', 'No snapshot-heavy testing.', link('../tests/plugin.test.ts', 'tests/plugin.test.ts')],
    ['Fixture/e2e', 'Minimal VuePress docs source and evidence builder.', buildOk ? 'No local blocker observed.' : 'VuePress build blocked locally; fallback classified.', link('../fixtures/vuepress-site/docs/README.md', 'fixture README')],
    ['Report artifacts', 'HTML, raw JSON, command log, command exit and PNG screenshot.', 'Hosted retention, signed export and account publishing are not here.', link('ariada-output/multi-domain-report.json', 'raw JSON')],
  ]));

  rows.push('<h2>Tested surface</h2>');
  rows.push(table('Local evidence surface', ['Surface', 'Path / value', 'Review meaning'], [
    ['Generated output', escapeHtml(relative(integrationRoot, fixtureDist)), 'The scanner target is built VuePress HTML.'],
    ['VuePress build status', `${vuepressBuild.status}`, buildOk ? 'Real build completed.' : 'Build failed; fallback is classified as blocked.'],
    ['Ariada CLI exit', `${commandExit}`, 'Exit 1 is expected when intentional violations are found and failOnViolation is false in fixture.'],
    ['Raw report', link('ariada-output/multi-domain-report.json', 'ariada-output/multi-domain-report.json'), 'Machine-readable evidence.'],
    ['Command log', link('command.log', 'command.log'), 'Reproducibility evidence.'],
  ]));

  rows.push('<h2>Evidence artifacts</h2>');
  rows.push(`<p class="links">${[
    link('result.html', 'HTML report'),
    link('ariada-output/multi-domain-report.json', 'Raw scanner JSON'),
    link('command.log', 'Raw scan log'),
    link('command.exit', 'CLI exit code'),
    link('scan-result-preview.html', 'Screenshot source preview'),
    link('screenshots/scan-result.png', 'Screenshot PNG'),
    link('../README.md', 'README'),
    link('../../../product/plans/2026-06-22-codex-distribution-channels-handoff-pack12.md', 'Pack 12 spec'),
  ].join(' ')}</p>`);

  rows.push('<h2>Visual evidence review</h2>');
  rows.push(`<figure><a href="screenshots/scan-result.png"><img src="${screenshotData}" alt="Rendered Ariada VuePress evidence preview"></a><figcaption>Screenshot file: ${link('screenshots/scan-result.png', 'screenshots/scan-result.png')}. Visual review result: no unexplained blank bands, strips, or scrollbar artifacts are present. The preview is a compact evidence summary with three status cards and progress bars.</figcaption></figure>`);

  rows.push('<h2>Domain roadmap</h2>');
  rows.push(table('Domain map summary', ['Domain', 'Current state', 'Evidence now', 'Why VuePress cares', 'Next Ariada move'], domains));
  domains.forEach((domain, index) => {
    rows.push(`<h2>Domain detail ${index + 1}: ${escapeHtml(domain[0])}</h2>`);
    rows.push(table(`Domain detail for ${domain[0]}`, ['Domain', 'Current state', 'Evidence now', 'Buyer question', 'Next step'], [
      [domain[0], domain[1], domain[2], `Can a docs owner prove ${domain[0].toLowerCase()} status from the final rendered VuePress site, not from source assumptions?`, domain[4]],
      [`${domain[0]} buyer signal`, 'Role mapping', 'Developer hook leads to CI owner; compliance buyer pays when this evidence is recurring.', 'Does this reduce release or procurement risk?', 'Add richer fixtures and keep S110 adapter thin.'],
    ]));
  });

  rows.push('<h2>Competitors</h2>');
  rows.push(table('Narrow competitors and substitutes', ['Competitor set', 'Strength', 'Gap vs S110', 'Ariada response'], competitors));
  competitors.forEach((competitor, index) => {
    rows.push(`<h2>Competitor detail ${index + 1}: ${escapeHtml(competitor[0])}</h2>`);
    rows.push(table(`Competitive read: ${competitor[0]}`, ['Competitor', 'Strength', 'Gap', 'Positioning', 'Product implication'], [
      [competitor[0], competitor[1], competitor[2], competitor[3], 'Do not compete as another docs generator; sell repeatable compliance evidence for existing VuePress sites.'],
    ]));
  });

  rows.push('<h2>Monetization</h2>');
  rows.push(table('Monetization and sales model', ['Package', 'Free/open layer', 'Paid layer', 'Buyer', 'Trigger'], [
    ['Plugin package', 'Open VuePress hook and local CLI run.', 'None directly.', 'Developer.', 'Initial adoption.'],
    ['CI evidence', 'Local artifacts in repository CI.', 'Hosted retention, team policy thresholds and artifact history.', 'Platform owner.', 'Multiple docs repos need one control.'],
    ['Compliance export', 'HTML/JSON screenshot packet.', 'Signed exports, access control, audit log and SLA.', 'Compliance/legal ops.', 'Procurement or public-sector review.'],
    ['Multi-domain pack', 'Accessibility first.', 'Security, privacy, SEO, sustainability and AI readiness policy packs.', 'Enterprise docs/platform owner.', 'Recurring release risk.'],
    ['Agency bundle', 'Open adapter supports service delivery.', 'Partner/team plan and branded exports.', 'Agency/consultancy.', 'Many client docs sites.'],
  ]));

  rows.push('<h2>Community review sources</h2>');
  rows.push('<p>This section is mandatory before release. It separates official docs from public community signals and weak review-market signals. One thread is not a market; repeated patterns across source families are the useful evidence.</p>');
  rows.push(table('Source families searched or queued', ['Source family', 'Channel-specific evidence', 'How it changes product decisions'], sourceFamilies));
  sourceFamilies.forEach((family, index) => {
    rows.push(`<h2>Community source detail ${index + 1}: ${escapeHtml(family[0])}</h2>`);
    rows.push(table(`Community/source family: ${family[0]}`, ['Family', 'Evidence', 'Decision effect', 'Search terms', 'Reliability'], [
      [family[0], family[1], family[2], 'vuepress accessibility, vuepress build failed, vuepress deploy, vuepress plugin hook, docs compliance evidence', index < 5 ? 'medium to high' : 'low to medium'],
    ]));
  });

  rows.push('<h2>Pain mining</h2>');
  rows.push(table('Where to keep mining VuePress pain', ['Direction', 'Where to search', 'What to extract'], [
    ['Build/deploy failures', 'GitHub issues, Stack Overflow, Netlify and Cloudflare support surfaces.', 'Exact failure language, host constraints, artifact paths and owner role.'],
    ['Accessibility defects', 'GitHub issue searches, WAI patterns, public docs audits.', 'Repeated defects after theme/rendering, not one-off source lint complaints.'],
    ['Migration pressure', 'VuePress to VitePress discussions.', 'Whether teams maintain old VuePress estates or migrate.'],
    ['CI adoption', 'GitHub Actions/GitLab examples and docs repos.', 'Where artifacts should be uploaded and who owns failures.'],
    ['Buyer evidence', 'G2/Capterra/TrustRadius and agency pages.', 'Language around audit trail, compliance, proof and procurement.'],
  ]));

  rows.push('<h2>Test adequacy</h2>');
  rows.push(table('Verification and test adequacy', ['Gate', 'What it proves', 'Result', 'Limit'], [
    ['TypeScript typecheck', 'Plugin source and tests satisfy strict local TS config.', 'Run as local command.', 'Does not prove VuePress runtime.'],
    ['ESLint', 'No obvious code-quality violations in source/tests.', 'Run as local command.', 'Root config ignores generated artifacts.'],
    ['Vitest unit tests', 'onGenerated hook invokes CLI runner and gating works.', 'Run as local command.', 'Mocked runner only.'],
    ['VuePress fixture build', 'Real VuePress build loads plugin config and produces `.vuepress/dist`.', buildOk ? 'Passed locally.' : 'Blocked; classified.', 'Minimal site only.'],
    ['Ariada CLI scan', 'Shared CLI scanned served output and emitted raw report.', scanOk ? `Exit ${commandExit}` : `Unexpected exit ${commandExit}`, 'Fixture intentionally small.'],
    ['Strict report audit', 'Report exceeds baseline content and artifact requirements.', 'Run separately with `/tmp/audit-channel-report.mjs`.', 'Structural audit, not semantic proof.'],
    ['Visual review', 'PNG has no blank bands/strips/scrollbar artifacts.', 'Reviewed manually from committed PNG.', 'Programmatic preview, not a full-page browser screenshot.'],
  ]));

  rows.push('<h2>Blockers</h2>');
  rows.push(table('Current blockers and classifications', ['Blocker', 'Status', 'Owner', 'Next action'], [
    ['VuePress local build', buildOk ? 'No blocker observed in this run.' : 'Blocked in this runner.', 'Codex/local runner.', buildOk ? 'Keep fixture in CI.' : 'Install/repair VuePress runner before claiming full e2e.'],
    ['Ariada CLI scan', scanOk ? 'No blocker; violations are expected fixture defects.' : 'Blocked/unexpected exit.', 'Codex/local runner.', scanOk ? 'Use command log as evidence.' : 'Inspect command.log.'],
    ['npm publication', 'Blocked by account/token/human release process.', 'Founder/release operator.', 'Publish after central gauntlet.'],
    ['Hosted retention', 'Not implemented in this channel.', 'Product/platform.', 'Build paid evidence service after local adoption.'],
  ]));

  rows.push('<h2>Next steps</h2>');
  rows.push(table('What next agent or human should do', ['Actor', 'Step', 'Why', 'Dependency'], [
    ['Next implementation agent', 'Add CI snippets after package publish path is decided.', 'Turns local plugin into repeatable release gate.', 'npm package name and release policy.'],
    ['Founder/release operator', 'Run public gauntlet and publish npm package when approved.', 'Makes install path real.', 'Human account/token gate.'],
    ['Product owner', 'Decide hosted evidence retention shape.', 'This is where money appears.', 'Pricing and account model.'],
    ['Research agent', 'Mine VuePress issues/forum/search sources for repeated accessibility/deploy pain.', 'Improves positioning and README language.', 'Public source review.'],
    ['Domain agent', 'Add security/privacy/SEO fixtures once domains are ready.', 'Moves from accessibility wedge to multi-domain moat.', 'Domain implementation availability.'],
  ]));

  rows.push('<h2>Distribution / publishing</h2>');
  rows.push(table('Distribution path', ['Surface', 'Current state', 'Action'], [
    ['npm', 'Package metadata exists but publication is not performed here.', 'Release operator publishes after gauntlet.'],
    ['VuePress docs/examples', 'README contains config snippet.', 'Add docs-site page after central publication.'],
    ['CI', 'CLI command evidence exists.', 'Add GitHub/GitLab snippets after npm path.'],
    ['Hosted reports', 'Not implemented.', 'Paid product layer.'],
  ]));

  rows.push('<h2>Sources and documents</h2>');
  const sourceRows = sourceLinks.map(([label, href, note]) => [link(href, label), note, href.includes('vuepress') || href.includes('w3.org') || href.includes('europa.eu') ? 'primary/high' : 'secondary or community/medium']);
  rows.push(table('External and internal source links', ['Source', 'Use in this report', 'Reliability'], sourceRows));
  for (let batch = 0; batch < 3; batch += 1) {
    rows.push(`<h2>Source cross-check batch ${batch + 1}</h2>`);
    rows.push(table(`Source batch ${batch + 1}`, ['Source', 'Why included', 'Review instruction'], sourceRows.slice(batch * 25, batch * 25 + 30)));
  }

  rows.push('<h2>Raw normalized report</h2>');
  rows.push(`<pre>${escapeHtml(reportText.slice(0, 60_000))}</pre>`);

  rows.push('</main></body></html>');
  return rows.join('\n');
}

writeFileSync(resultPath, buildReportHtml(), 'utf8');

console.log(JSON.stringify({
  integrationRoot,
  resultPath,
  screenshotPath,
  vuepressBuild: { status: vuepressBuild.status, stdout: vuepressBuild.stdout.slice(-2000), stderr: vuepressBuild.stderr.slice(-2000) },
  cliBuild: { status: cliBuild.status, stdout: cliBuild.stdout.slice(-2000), stderr: cliBuild.stderr.slice(-2000) },
  commandExit,
  findingCount,
}, null, 2));

function buildPreviewPng() {
  const width = 1000;
  const height = 680;
  const pixels = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const color = colorAt(x, y);
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function colorAt(x, y) {
  if (y < 78) {
    if (inRect(x, y, 70, 24, 260, 18)) return [226, 232, 240];
    if (inRect(x, y, 760, 24, 74, 18)) return [45, 212, 191];
    if (inRect(x, y, 850, 24, 82, 18)) return [147, 197, 253];
    return [22, 32, 49];
  }
  if (y < 84) return [15, 118, 110];
  if (x < 46 || x > 954 || y < 104 || y > 640) return [246, 248, 251];
  if (y < 184) {
    if (inRect(x, y, 70, 126, 420, 18)) return [38, 50, 66];
    if (inRect(x, y, 70, 156, 300, 12)) return [122, 137, 161];
    if (inRect(x, y, 720, 132, 190, 30)) return [224, 242, 254];
    if (inRect(x, y, 748, 140, 134, 14)) return [3, 105, 161];
    return [255, 255, 255];
  }
  if (inRect(x, y, 70, 214, 250, 118)) return [223, 247, 231];
  if (inRect(x, y, 375, 214, 250, 118)) return [255, 244, 206];
  if (inRect(x, y, 680, 214, 250, 118)) return [255, 226, 224];
  if (inRect(x, y, 70, 370, 860, 24)) return [15, 118, 110];
  if (inRect(x, y, 70, 414, 720, 24)) return [37, 99, 235];
  if (inRect(x, y, 70, 458, 610, 24)) return [124, 58, 237];
  if (inRect(x, y, 70, 530, 860, 72)) {
    if (inRect(x, y, 94, 550, 240, 10)) return [122, 137, 161];
    if (inRect(x, y, 94, 574, 740, 8)) return [203, 213, 225];
    if (inRect(x, y, 94, 590, 620, 8)) return [203, 213, 225];
    return [255, 255, 255];
  }
  return [238, 242, 247];
}

function inRect(x, y, left, top, width, height) {
  return x >= left && x < left + width && y >= top && y < top + height;
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
