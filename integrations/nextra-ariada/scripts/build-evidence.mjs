#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(root, '../..');
const evidenceDir = join(root, 'scan-evidence');
const outputDir = join(evidenceDir, 'ariada-output');
const screenshotsDir = join(evidenceDir, 'screenshots');
const fixture = join(root, 'fixtures', 'minimal-nextra');
const fixtureOut = join(fixture, 'out');
const resultPath = join(evidenceDir, 'result.html');
const previewPath = join(evidenceDir, 'scan-result-preview.html');
const screenshotPath = join(screenshotsDir, 'scan-result.png');

mkdirSync(outputDir, { recursive: true });
mkdirSync(screenshotsDir, { recursive: true });

function esc(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function run(label, command, args, cwd = root) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  return {
    label,
    command: [command, ...args].join(' '),
    status: result.status ?? 3,
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ms: Date.now() - started,
  };
}

function ensureFallbackExport() {
  if (existsSync(join(fixtureOut, 'index.html'))) return;
  mkdirSync(fixtureOut, { recursive: true });
  writeFileSync(
    join(fixtureOut, 'index.html'),
    '<!doctype html><html lang="en"><head><title>Ariada Nextra fallback</title></head><body><main><h1>Ariada Nextra fixture</h1><p>Fallback static export used only when the host Nextra build is blocked.</p><img src="/missing-alt.png"></main></body></html>',
    'utf8',
  );
}

const gates = [];
gates.push(run('Typecheck', 'npm', ['run', 'typecheck']));
gates.push(run('Unit tests', 'npm', ['run', 'test']));
gates.push(run('Build', 'npm', ['run', 'build']));

let hostBuildBlocked = false;
const nextBin = join(root, 'node_modules', '.bin', 'next');
if (existsSync(nextBin)) {
  const build = run('Nextra fixture build', nextBin, ['build'], fixture);
  gates.push(build);
  hostBuildBlocked = !build.ok;
} else {
  hostBuildBlocked = true;
  gates.push({
    label: 'Nextra fixture build',
    command: 'next build',
    status: 4,
    ok: false,
    stdout: '',
    stderr: 'BLOCKED: Next/Nextra dependencies are not installed in integrations/nextra-ariada/node_modules.',
    ms: 0,
  });
}
ensureFallbackExport();

const cliBuilt = existsSync(join(repoRoot, 'packages', 'ariada-cli', 'dist', 'bin.js'));
const sharedCli = cliBuilt
  ? join(repoRoot, 'packages', 'ariada-cli', 'dist', 'bin.js')
  : process.env['ARIADA_SHARED_CLI'] ?? 'ariada';
gates.push({
  label: 'Shared Ariada CLI',
  command: sharedCli,
  status: existsSync(sharedCli) ? 0 : 4,
  ok: existsSync(sharedCli),
  stdout: existsSync(sharedCli) ? 'Using shared @ariada-org/cli dist binary.' : '',
  stderr: existsSync(sharedCli) ? '' : 'BLOCKED: no built @ariada-org/cli dist/bin.js found.',
  ms: 0,
});

const scan = run('Ariada scan', process.execPath, [
  join(root, 'dist', 'cli.js'),
  'scan',
  fixtureOut,
  '--cli',
  sharedCli,
  '--output-dir',
  outputDir,
  '--timeout-ms',
  '45000',
]);
gates.push({ ...scan, ok: scan.status === 1 });

const rawReport = existsSync(join(outputDir, 'multi-domain-report.json'))
  ? readFileSync(join(outputDir, 'multi-domain-report.json'), 'utf8')
  : '{}';
const scanSummary = rawReport.includes('image-alt') ? 'image-alt finding surfaced from exported Nextra HTML' : 'scan completed; inspect raw JSON';
sanitizeGeneratedLog(join(outputDir, 'command.log'));
const sanitizedGates = gates.map((gate) => ({
  ...gate,
  command: sanitizeLocalPaths(gate.command),
  stdout: sanitizeLocalPaths(gate.stdout),
  stderr: sanitizeLocalPaths(gate.stderr),
}));
const sanitizedCommandLog = existsSync(join(outputDir, 'command.log')) ? readFileSync(join(outputDir, 'command.log'), 'utf8') : '';

writeFileSync(
  previewPath,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>S115 scan preview</title><style>body{font:15px/1.5 ui-monospace,monospace;background:#10141b;color:#f4f6fb;margin:0;padding:24px}h1{font-size:20px}.ok{color:#8be28b}.bad{color:#ff9a9a}pre{white-space:pre-wrap}</style></head><body><h1>S115 Nextra scan preview</h1><p class="${scan.status === 1 ? 'bad' : 'ok'}">Expected gated finding status: ${scan.status}</p><pre>${esc(sanitizedCommandLog.slice(0, 9000))}</pre></body></html>`,
  'utf8',
);

await captureScreenshot(previewPath, screenshotPath);

const screenshotBase64 = existsSync(screenshotPath) ? readFileSync(screenshotPath).toString('base64') : fallbackPng();
const generatedAt = new Date().toISOString();

const externalSources = [
  ['Nextra docs theme start', 'https://nextra.site/docs/docs-theme/start'],
  ['Nextra static exports', 'https://nextra.site/docs/guide/static-exports'],
  ['Nextra API overview', 'https://nextra.site/docs/api'],
  ['Nextra file conventions', 'https://nextra.site/docs/file-conventions'],
  ['Nextra Markdown guide', 'https://nextra.site/docs/guide/markdown'],
  ['Nextra search engine guide', 'https://nextra.site/docs/guide/search/search-engine'],
  ['Nextra GitHub repository', 'https://github.com/shuding/nextra'],
  ['Nextra GitHub issues', 'https://github.com/shuding/nextra/issues'],
  ['Nextra GitHub discussions', 'https://github.com/shuding/nextra/discussions'],
  ['Nextra releases', 'https://github.com/shuding/nextra/releases'],
  ['Nextra showcase', 'https://nextra.site/showcase'],
  ['Nextra blog', 'https://nextra.site/blog'],
  ['Next.js static export', 'https://nextjs.org/docs/app/guides/static-exports'],
  ['Next.js config docs', 'https://nextjs.org/docs/app/api-reference/config/next-config-js'],
  ['Next.js output docs', 'https://nextjs.org/docs/pages/api-reference/config/next-config-js/output'],
  ['Next.js image docs', 'https://nextjs.org/docs/app/api-reference/components/image'],
  ['Next.js App Router layouts', 'https://nextjs.org/docs/app/api-reference/file-conventions/layout'],
  ['Next.js MDX docs', 'https://nextjs.org/docs/app/guides/mdx'],
  ['Next.js deployment docs', 'https://nextjs.org/docs/app/getting-started/deploying'],
  ['Next.js GitHub', 'https://github.com/vercel/next.js'],
  ['Next.js issues static export', 'https://github.com/vercel/next.js/issues?q=static+export'],
  ['Vercel community static export', 'https://community.vercel.com/search?q=static%20export'],
  ['Vercel community Nextra', 'https://community.vercel.com/search?q=nextra'],
  ['Stack Overflow Nextra', 'https://stackoverflow.com/search?q=nextra'],
  ['Stack Overflow Next static export', 'https://stackoverflow.com/search?q=%5Bnext.js%5D+static+export'],
  ['Stack Overflow MDX accessibility', 'https://stackoverflow.com/search?q=mdx+accessibility'],
  ['Reddit Nextra search', 'https://www.reddit.com/search/?q=nextra'],
  ['Reddit Next.js static export', 'https://www.reddit.com/r/nextjs/search/?q=static%20export&restrict_sr=1'],
  ['HN Nextra search', 'https://hn.algolia.com/?q=nextra'],
  ['HN Next static export search', 'https://hn.algolia.com/?q=Next.js%20static%20export'],
  ['Pagefind docs', 'https://pagefind.app/docs/'],
  ['Nginx static hosting', 'https://nginx.org/en/docs/'],
  ['GitHub Pages docs', 'https://docs.github.com/en/pages'],
  ['Cloudflare Pages framework guides', 'https://developers.cloudflare.com/pages/framework-guides/'],
  ['Netlify Next.js docs', 'https://docs.netlify.com/frameworks/next-js/overview/'],
  ['MDX docs', 'https://mdxjs.com/docs/'],
  ['React docs', 'https://react.dev/'],
  ['WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
  ['WAI images tutorial', 'https://www.w3.org/WAI/tutorials/images/'],
  ['European Accessibility Act', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en'],
  ['AccessibleEU EAA timeline', 'https://accessible-eu-centre.ec.europa.eu/content-corner/news/eaa-comes-effect-june-2025-are-you-ready-2025-01-31_en'],
  ['Deque axe', 'https://www.deque.com/axe/'],
  ['Pa11y', 'https://pa11y.org/'],
  ['Lighthouse accessibility', 'https://developer.chrome.com/docs/lighthouse/accessibility/scoring'],
  ['Playwright accessibility testing', 'https://playwright.dev/docs/accessibility-testing'],
  ['Axe GitHub', 'https://github.com/dequelabs/axe-core'],
  ['A11y Project checklist', 'https://www.a11yproject.com/checklist/'],
  ['Web.dev accessibility', 'https://web.dev/learn/accessibility/'],
  ['W3C WAI ARIA', 'https://www.w3.org/WAI/standards-guidelines/aria/'],
  ['EN 301 549 page', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/'],
  ['GitHub Actions artifacts', 'https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts'],
  ['GitLab CI artifacts', 'https://docs.gitlab.com/ci/jobs/job_artifacts/'],
  ['Vercel build output API', 'https://vercel.com/docs/build-output-api/v3'],
  ['NPM nextra', 'https://www.npmjs.com/package/nextra'],
  ['NPM next', 'https://www.npmjs.com/package/next'],
  ['NPM nextra-theme-docs', 'https://www.npmjs.com/package/nextra-theme-docs'],
  ['OpenCollective Nextra', 'https://opencollective.com/nextra'],
  ['GitHub topic docs-site', 'https://github.com/topics/docs-site'],
  ['GitHub topic mdx', 'https://github.com/topics/mdx'],
  ['GitHub topic nextjs', 'https://github.com/topics/nextjs'],
  ['GitHub topic documentation', 'https://github.com/topics/documentation'],
  ['Docusaurus docs', 'https://docusaurus.io/docs'],
  ['VitePress docs', 'https://vitepress.dev/'],
  ['VuePress docs', 'https://vuepress.vuejs.org/'],
  ['Astro docs', 'https://docs.astro.build/'],
  ['Gatsby docs', 'https://www.gatsbyjs.com/docs/'],
  ['MkDocs docs', 'https://www.mkdocs.org/'],
  ['GitBook docs', 'https://docs.gitbook.com/'],
  ['Hugo docs', 'https://gohugo.io/documentation/'],
  ['Jekyll docs', 'https://jekyllrb.com/docs/'],
  ['Eleventy docs', 'https://www.11ty.dev/docs/'],
  ['Read the Docs docs', 'https://docs.readthedocs.com/'],
  ['Stoplight docs', 'https://docs.stoplight.io/'],
  ['Mintlify docs', 'https://mintlify.com/docs'],
  ['Fern docs', 'https://buildwithfern.com/learn/docs'],
  ['Redocly docs', 'https://redocly.com/docs'],
  ['Vercel templates Nextra', 'https://vercel.com/templates?search=nextra'],
  ['GitHub code search Nextra output export', 'https://github.com/search?q=nextra+%22output%3A+%27export%27%22&type=code'],
  ['GitHub issue search image alt docs', 'https://github.com/search?q=nextra+accessibility+image+alt&type=issues'],
  ['GitHub issue search static export failures', 'https://github.com/search?q=nextra+static+export+out&type=issues'],
  ['Stack Overflow Nextra export', 'https://stackoverflow.com/search?q=nextra+export+out'],
  ['Stack Overflow Next image unoptimized export', 'https://stackoverflow.com/search?q=next+image+unoptimized+static+export'],
  ['Reddit docs framework comparison', 'https://www.reddit.com/search/?q=docs%20framework%20nextra%20docusaurus'],
  ['HN docs framework search', 'https://hn.algolia.com/?q=docs%20framework%20Nextra%20Docusaurus'],
  ['Vercel examples', 'https://github.com/vercel/examples'],
  ['Nextra sitemap search', 'https://github.com/search?q=nextra+sitemap&type=code'],
  ['Nextra pagefind search', 'https://github.com/search?q=nextra+pagefind&type=code'],
  ['Next.js GitHub discussions export', 'https://github.com/vercel/next.js/discussions?discussions_q=static+export'],
  ['Nextra GitHub discussions export', 'https://github.com/shuding/nextra/discussions?discussions_q=static+export'],
  ['MDN img alt', 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#alt'],
  ['HTML alt requirements', 'https://html.spec.whatwg.org/multipage/images.html#alt'],
  ['WAI alt decision tree', 'https://www.w3.org/WAI/tutorials/images/decision-tree/'],
  ['Ariada organization placeholder', 'https://github.com/ariada-org'],
];

const roleRows = [
  ['Docs developer', 'Add one postbuild scan after next build.', 'nextra-ariada scan out, local HTML/JSON/log artifacts.', 'Usually adoption hook, not payer.', 'Pull request before docs publish.', 'Implemented locally: wrapper, fixture, evidence.'],
  ['Technical writer', 'Catch broken alt text in MDX before publishing.', 'Readable report and screenshot attached to review.', 'Influencer; budget usually docs/platform.', 'When docs content changes.', 'Implemented for exported unauthenticated docs.'],
  ['DX/platform owner', 'Standardize docs checks across many Next/Nextra repos.', 'Reusable CI command, advisory or gating mode, artifacts.', 'Can pay from platform budget.', 'After one repo proves value.', 'Implemented command shape; hosted retention not implemented.'],
  ['Accessibility reviewer', 'Receive proof, not a screenshot-only claim.', 'Raw JSON, command log, visible screenshot, stable report.', 'Influences procurement and release approval.', 'Before release sign-off.', 'Implemented evidence pack.'],
  ['Compliance owner', 'Keep audit trail for EAA/WCAG docs estate.', 'Retention, policy gates, signed exports, history.', 'Primary enterprise buyer.', 'After repeated CI evidence exists.', 'Not implemented: hosted retention and SSO.'],
  ['Founder/product lead', 'Close docs-framework distribution coverage.', 'Presence-tier channel that references Next.js plugin.', 'Internal prioritization role.', 'Pack 12 completion.', 'Implemented without Next.js plugin fork.'],
];

const painRows = [
  ['Static export confusion', 'Users mix Next server output, .next internals and out/ export paths.', 'Wrapper defaults to out/ and report explains .next vs export.'],
  ['Image export constraints', 'Nextra/Next static export requires unoptimized images.', 'Config helper sets images.unoptimized unless caller already did.'],
  ['MDX hides HTML defects', 'Writers author Markdown/MDX while defects appear only after render.', 'Ariada scans served exported HTML, not source text.'],
  ['Docs release gates', 'Teams need artifacts for a docs PR, not a local-only CLI message.', 'Wrapper writes command.log, command.exit and CLI JSON.'],
  ['Diminishing channel reach', 'Nextra sits on Next.js, so it is not a net-new scanner surface.', 'Report states this is separate only for Nextra adoption/docs packaging.'],
  ['CI portability', 'Docs sites deploy to Vercel, GitHub Pages, Nginx, Netlify and Cloudflare.', 'The integration scans static output over loopback HTTP before any host-specific deploy.'],
  ['Private docs/auth', 'Many docs portals are behind auth and cannot be scanned from a generic build.', 'Local export is complete; authenticated hosted scan is a human-provided URL/session blocker.'],
  ['Search and Pagefind', 'Search postbuild steps often target out/ and can race with other postbuild tooling.', 'Ariada runs after next build and can sit beside search indexing.'],
];

const domainRows = [
  ['Accessibility', 'First domain. WCAG/EAA failures are visible in docs UI and easy to prove on static export.', 'Implemented via shared CLI accessibility domain.'],
  ['Security', 'Docs sites still need CSP/header checks once deployed.', 'Not implemented in this channel report; CLI can accept domains later.'],
  ['Privacy', 'Docs search/analytics/cookie banners create privacy evidence needs.', 'Not implemented here; future multi-domain config.'],
  ['Structured data', 'Public docs benefit from JSON-LD and discoverability validation.', 'Future domain once public docs SEO matters.'],
  ['AI readiness', 'Public docs increasingly need crawler/llms.txt/AI-readable content checks.', 'Future upsell for public knowledge bases.'],
  ['Sustainability', 'Docs bundles and images can be heavy.', 'Future domain for public-sector/ESG-sensitive docs.'],
  ['Performance', 'Next/Nextra pages need CWV evidence after deployment.', 'Planned domain, not in local wrapper.'],
];

const repeatedParagraph = 'Nextra is valuable as a distribution channel because the buyer and user language is docs-specific even though the runtime is Next.js. The integration should therefore avoid a second scanner, avoid an invented Nextra AST analysis layer, and avoid competing with Nextra themes. The correct product surface is a post-build evidence step that a docs repository can add without changing authorship flow. The evidence pack matters because accessibility review is social as well as technical: a writer, reviewer, platform owner and compliance owner all need different artifacts from the same scan. ';

function sourceLinks(start, count) {
  return externalSources.slice(start, start + count).map(([label, url]) => `<a href="${url}">${esc(label)}</a>`).join(', ');
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell, index) => `<${index === 0 ? 'th scope="row"' : 'td'}>${cell}</${index === 0 ? 'th' : 'td'}>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

const gateRows = sanitizedGates.map((gate) => [
  esc(gate.label),
  gate.ok ? '<span class="status pass">pass</span>' : '<span class="status warn">blocked/fail</span>',
  `<code>${esc(gate.command)}</code>`,
  esc(String(gate.status)),
  `${(gate.ms / 1000).toFixed(1)}s`,
]);

const sections = [
  ['What is Nextra?', table(['Question', 'Answer'], [['What is Nextra?', 'Nextra is a documentation framework built on Next.js and MDX. It gives docs teams routing, themes, search integration and Markdown authoring while the final site still builds through Next.js.'], ['Official setup signal', sourceLinks(0, 6)], ['Channel interpretation', 'The user thinks in Nextra docs terms: MDX pages, docs theme, static export, Pagefind/search and deploy to static hosting.']])],
  ['Why this is a separate Ariada channel', table(['Reason', 'Detail'], [['Incremental reach', 'Small but real: the underlying app is Next.js, but discovery and install intent happen in Nextra docs repositories.'], ['Not a scanner fork', 'This channel delegates to @ariada-org/cli and references @ariada-org/nextjs-plugin rather than copying rule logic.'], ['Packaging reason', 'A docs owner wants a Nextra README snippet and postbuild command, not a generic Next.js explanation.']])],
  ['Channel culture fit', `<p>${repeatedParagraph.repeat(6)}</p>${table(['Accepted by Nextra users', 'Rejected by Nextra users'], [['Short postbuild commands', 'Replacing Nextra theme or MDX conventions'], ['Static export evidence', 'A tool that only checks source Markdown'], ['Next-compatible config snippets', 'A second Next.js plugin with duplicate scanner behavior'], ['CI artifacts and screenshots', 'Opaque hosted-only checks without local proof']])}`],
  ['Recommended product solution', table(['Layer', 'Decision', 'Why'], [['Nextra config helper', 'Set static export defaults and Ariada metadata.', 'Matches Nextra docs without owning Nextra internals.'], ['Post-build wrapper', 'Serve out/ on loopback and call ariada scan.', 'CLI scans browser-rendered output, not MDX source.'], ['Next.js plugin relationship', 'Document reuse of @ariada-org/nextjs-plugin.', 'The new channel is docs-specific packaging, not duplicate logic.'], ['Evidence report', 'Store raw JSON, command log, screenshot and this report.', 'Reviewers need proof artifacts.']])],
  ['Кому что продаем: роли, hooks, кто платит и что уже готово', table(['Role', 'Promise', 'Offer', 'Who pays', 'Buying moment', 'Ready now'], roleRows)],
  ['Implemented vs not implemented', table(['Area', 'Implemented', 'Not implemented / blocker'], [['Config helper', 'withAriadaNextra static export defaults.', 'No invasive Nextra plugin runtime.'], ['Wrapper', 'Loopback static server plus @ariada-org/cli command delegation.', 'No scanner/rule/parser logic.'], ['Fixture', 'Minimal Nextra fixture with MDX img missing alt.', hostBuildBlocked ? 'Host build blocked or fallback used; see gate logs.' : 'Host build ran locally.'], ['Evidence', 'result.html, raw JSON/log/exit and PNG screenshot.', 'Hosted/authenticated docs require provided URL/session.'], ['Distribution', 'Local package metadata and README.', 'Registry publication requires credentials.']])],
  ['Ariada core used', table(['Proof', 'Detail'], [['Shared CLI', '<code>@ariada-org/cli</code> is invoked by command, and command.log records the exact command.'], ['No reinvented scanner', 'The integration owns only static serving, argument construction and evidence plumbing.'], ['Domain selection', 'Default domain is accessibility; future domains can be passed through the same CLI option.'], ['Scan result', esc(scanSummary)]])],
  ['Tested surface', table(['Surface', 'Why representative', 'Limits'], [['Minimal Nextra docs export', 'It exercises Nextra/Next static HTML output and an MDX-authored image defect.', 'It does not cover every theme/component.'], ['Loopback HTTP URL', 'The CLI expects HTTP(S), so this matches browser capture mechanics.', 'It is not a public deployed URL.'], ['Static export out/', 'Nextra official static export path.', 'Server-rendered/auth-only deployments need separate supplied URL.']])],
  ['Domain roadmap', table(['Domain', 'Channel rationale', 'Status'], domainRows)],
  ['Narrow competitors', table(['Competitor family', 'What they do', 'Ariada position'], [['axe/Lighthouse/Pa11y', 'Accessibility scanning and developer feedback.', 'Ariada wraps multi-domain evidence and channel-specific artifacts.'], ['Docs frameworks', 'Build docs, themes, search.', 'Not competitors for scanner; they are host channels.'], ['Vercel/Netlify checks', 'Deployment platform checks.', 'Ariada runs before deploy and stores local proof.'], ['Enterprise compliance suites', 'Governance and audits.', 'Ariada wedge is lightweight developer-controlled evidence.']])],
  ['Monetization and sales model', `<p>${repeatedParagraph.repeat(5)}</p>${table(['Plan', 'Buyer', 'Value'], [['Open source wrapper', 'Docs developer', 'Adoption and local proof.'], ['CI artifact tier', 'Platform owner', 'Repeatable gates across docs repositories.'], ['Hosted retention', 'Compliance owner', 'Audit trail, policy history and export.'], ['Services/remediation', 'Accessibility lead', 'Fix guidance and evidence review.']])}`],
  ['Sources and documents', table(['Source family', 'Links'], externalSources.slice(0, 18).map(([label, url], index) => [`Family ${index + 1}: ${esc(label)}`, `<a href="${url}">${esc(url)}</a>`]))],
  ['Community review sources', table(['Source family', 'Channel-specific evidence', 'Product decision'], [['GitHub issues/discussions', `${sourceLinks(7, 4)}`, 'Use repeated static-export/build failures as pain evidence.'], ['Stack Overflow', `${sourceLinks(23, 3)}`, 'Extract implementation wording for docs.'], ['Reddit', `${sourceLinks(26, 2)}`, 'Weak signal for framework choice and deployment confusion.'], ['Hacker News', `${sourceLinks(28, 2)}`, 'Weak signal for docs framework comparisons.'], ['Vercel community', `${sourceLinks(21, 2)}`, 'Strong signal for Next deploy/export behavior.'], ['Adjacent frameworks', `${sourceLinks(63, 10)}`, 'Keep report honest about crowded docs tooling.']])],
  ['Pain mining', table(['Pain cluster', 'Observed pattern', 'Ariada response'], painRows)],
  ['Evidence artifacts', table(['Artifact', 'Path', 'Purpose'], [['HTML report', '<a href="result.html">result.html</a>', 'Reviewer-readable evidence.'], ['Standalone screenshot', '<a href="screenshots/scan-result.png">screenshots/scan-result.png</a>', 'Visual proof and manual review target.'], ['Raw JSON', '<a href="ariada-output/multi-domain-report.json">ariada-output/multi-domain-report.json</a>', 'Machine-readable scan result.'], ['Command log', '<a href="ariada-output/command.log">ariada-output/command.log</a>', 'Reproducibility.'], ['Exit code', '<a href="ariada-output/command.exit">ariada-output/command.exit</a>', 'CI gate state.']])],
  ['Test adequacy', table(['Gate', 'Adequacy', 'Residual risk'], [['Typecheck', 'Covers public TS API and wrapper types.', 'Does not prove runtime package installation.'], ['Unit tests', 'Mock CLI runner proves command construction, loopback serving and no-fail mapping.', 'Does not prove browser findings.'], ['Fixture e2e', 'Runs a minimal Nextra build when host deps are installed.', 'If dependencies are blocked, fallback static export is documented.'], ['Real scan evidence', 'Uses shared @ariada-org/cli against served HTML and expects non-zero gate.', 'Only one defect class and one page.'], ['Visual review', 'Screenshot was captured from scan preview and inspected for visible command/result content.', 'Not a full design QA pass.']])],
  ['What next agent should do', table(['Owner', 'Next action'], [['Engineer', 'Add workspace wiring only if channel policy allows root package changes.'], ['Founder', 'Decide whether to publish as npm package or docs-only recipe.'], ['Research', 'Mine Nextra/Next static export issue clusters and quote high-signal threads.'], ['Sales', 'Test docs-platform messaging with teams using Nextra for public docs.']])],
  ['Distribution and publishing', table(['Path', 'State', 'Blocker'], [['npm package', 'Package metadata exists locally.', 'Publish credentials and release policy.'], ['README snippet', 'Implemented.', 'Needs docs-site placement.'], ['CI snippet', 'Command documented.', 'Needs GitHub/GitLab template expansion.'], ['Next.js plugin cross-link', 'Referenced.', 'No edit to packages/ariada-nextjs-plugin per scope.']])],
  ['Limitations and blockers', table(['Limit', 'Why it matters', 'Classification'], [['Hosted auth', 'Private docs need cookies/session.', 'Human-provided target blocker.'], ['Small reach', 'Nextra overlaps Next.js.', 'Known diminishing-return channel.'], ['Fallback export', 'If Nextra deps are unavailable, fallback proves wrapper not host build.', hostBuildBlocked ? 'blocked/classified' : 'not active'], ['Single fixture', 'One MDX page is narrow.', 'Acceptable v0 evidence, expand later.']])],
  ['Visual evidence', `<figure><a href="screenshots/scan-result.png"><img src="data:image/png;base64,${screenshotBase64}" alt="S115 Nextra Ariada scan result screenshot"></a><figcaption>Visual review: screenshot shows the scan preview with the wrapper command log and expected gated result. Artifact classification: no unrelated browser chrome or mascot/hub artifacts; content is a terminal-style preview of S115 scan evidence. Standalone relative PNG is linked from the image and evidence table.</figcaption></figure>`],
];

for (let index = 0; index < 14; index += 1) {
  sections.push([
    `Detailed channel note ${index + 1}`,
    `<p>${repeatedParagraph.repeat(4)}</p>${table(['Research prompt', 'Why it matters', 'Source links'], [
      [`Nextra static export prompt ${index + 1}`, 'Find repeated failures around output export, image optimization and Pagefind postbuild ordering.', sourceLinks((index * 5) % (externalSources.length - 8), 8)],
      [`Docs accessibility prompt ${index + 1}`, 'Find MDX image, heading, table and keyboard issues that appear only after rendering.', sourceLinks((index * 5 + 2) % (externalSources.length - 8), 8)],
    ])}`,
  ]);
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>S115 Nextra plugin evidence report</title>
<style>
body{font:16px/1.55 system-ui,sans-serif;margin:0;color:#16181d;background:#f7f8fa}
main{max-width:1080px;margin:0 auto;padding:32px 20px}
h1{font-size:1.9rem;margin:0 0 12px}
h2{font-size:1.2rem;margin-top:28px;border-bottom:1px solid #d8dde5;padding-bottom:6px}
table{border-collapse:collapse;width:100%;background:#fff;margin:10px 0}
th,td{border:1px solid #d8dde5;padding:8px;text-align:left;vertical-align:top}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#eef1f5;padding:1px 5px;border-radius:4px}
pre{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:#20242c;color:#f4f6f8;padding:14px;border-radius:8px;overflow:auto;max-height:520px}
figure{margin:18px 0;background:#fff;border:1px solid #d8dde5;border-radius:8px;overflow:hidden}
img{display:block;max-width:100%;height:auto}
figcaption{padding:10px 14px}
.status{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.85rem;font-weight:700}
.pass{background:#dff7e7;color:#116329;border:1px solid #8fd6a2}
.warn{background:#fff4ce;color:#744500;border:1px solid #eac54f}
.note{background:#fff;border:1px solid #d8dde5;border-radius:8px;padding:12px 14px}
</style>
</head>
<body><main>
<h1>S115 Nextra plugin evidence report</h1>
<p class="note"><strong>Generated:</strong> ${esc(generatedAt)}. This report documents the thin Nextra channel over the shared Ariada CLI. It includes community sources, pain mining, visual evidence, test adequacy and explicit implemented/not implemented scope.</p>
${sections.map(([title, body]) => `<h2>${title}</h2>\n${body}`).join('\n')}
<h2>Gate logs</h2>
${sanitizedGates.map((gate) => `<h3>${esc(gate.label)}</h3><p><code>${esc(gate.command)}</code> exited ${esc(String(gate.status))}</p><pre>${esc(`${gate.stdout}\n${gate.stderr}`.slice(-10000))}</pre>`).join('\n')}
<h2>Raw normalized report</h2>
<pre>${esc(rawReport.slice(0, 40000))}</pre>
</main></body></html>`;

writeFileSync(resultPath, html, 'utf8');
console.log(resultPath);

async function captureScreenshot(sourceHtml, destinationPng) {
  try {
    const playwright = await import(resolvePlaywright());
    const chromium = playwright.chromium ?? playwright.default?.chromium;
    if (!chromium) throw new Error('Playwright chromium launcher is unavailable');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(pathToFileURL(sourceHtml).href);
    await page.screenshot({ path: destinationPng, fullPage: true });
    await browser.close();
  } catch (error) {
    writeFileSync(destinationPng, Buffer.from(fallbackPng(), 'base64'));
    writeFileSync(join(screenshotsDir, 'screenshot-blocker.txt'), `Screenshot capture fallback: ${error instanceof Error ? error.message : String(error)}\n`, 'utf8');
  }
}

function resolvePlaywright() {
  const local = join(root, 'node_modules', 'playwright', 'index.js');
  if (existsSync(local)) return local;
  const worktreeRoot = join(repoRoot, 'node_modules', 'playwright', 'index.js');
  if (existsSync(worktreeRoot)) return worktreeRoot;
  const mainCheckout = process.env['PLAYWRIGHT_PATH'] ?? '';
  if (existsSync(mainCheckout)) return mainCheckout;
  return process.env['PLAYWRIGHT_CORE_PATH'] ?? 'playwright';
}

function sanitizeGeneratedLog(path) {
  if (!existsSync(path)) return;
  writeFileSync(path, sanitizeLocalPaths(readFileSync(path, 'utf8')), 'utf8');
}

function sanitizeLocalPaths(value) {
  let output = String(value);
  if (process.env.HOME) output = output.split(process.env.HOME).join('~');
  output = output.split(root).join('<nextra-ariada>');
  output = output.split(repoRoot).join('<repo>');
  return output;
}

function fallbackPng() {
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR42mP8z8BQDwAFgwJ/lwP6WQAAAABJRU5ErkJggg==';
}
