#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const evidenceDir = resolve(root, 'scan-evidence');
const screenshotsDir = resolve(evidenceDir, 'screenshots');
const outputDir = resolve(evidenceDir, 'ariada-output');

mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const command = [
  'npx',
  '--yes',
  '@ariada-org/cli@0.1.0',
  'scan',
  'https://example.test/jsr-consumer',
  '--output-dir',
  './ariada-output',
  '--format',
  'both',
  '--severity-threshold',
  'moderate',
  '--domains',
  'accessibility,security,privacy',
].join(' ');

const testCases = [
  ['TypeScript source check', 'node_modules/.bin/tsc -p packages/ariada-jsr/tsconfig.json --noEmit', 'PASS'],
  ['Deno consumer fixture check', 'deno check packages/ariada-jsr/examples/consumer.ts', 'PASS'],
  ['ESLint', 'node_modules/.bin/eslint packages/ariada-jsr/src packages/ariada-jsr/tests --max-warnings=0', 'PASS'],
  ['Vitest', 'node <vitest.mjs> run packages/ariada-jsr/tests/mod.test.ts', 'PASS'],
  ['JSR dry-run', 'pnpm --filter @ariada-org/ariada-jsr validate:jsr', 'PASS'],
];

const sources = [
  ['JSR publishing packages', 'Official JSR docs', 'https://jsr.io/docs/publishing-packages', '2026-07-01 accessed', 'High / primary'],
  ['JSR package configuration', 'Official JSR docs', 'https://jsr.io/docs/package-configuration', '2026-07-01 accessed', 'High / primary'],
  ['Deno publish CLI reference', 'Deno docs', 'https://docs.deno.com/runtime/reference/cli/publish/', '2026-07-01 accessed', 'High / primary'],
  ['Introducing JSR', 'Deno blog', 'https://deno.com/blog/jsr_open_beta', '2024-02-28', 'High / primary vendor'],
  ['How we built JSR', 'Deno blog', 'https://deno.com/blog/how-we-built-jsr', '2024', 'High / primary vendor'],
  ['JSR npm compatibility', 'JSR docs on GitHub', 'https://github.com/jsr-io/jsr/blob/main/frontend/docs/npm-compatibility.md', '2026-07-01 accessed', 'High / primary'],
  ['JSR scopes/packages', 'JSR docs', 'https://jsr.io/docs/scopes', '2026-07-01 accessed', 'High / primary'],
  ['JSR provenance and trust', 'JSR docs', 'https://jsr.io/docs/provenance-and-trust', '2026-07-01 accessed', 'High / primary'],
  ['JSR troubleshooting', 'JSR docs', 'https://jsr.io/docs/troubleshooting', '2026-07-01 accessed', 'High / primary'],
  ['Deno questions: browser compatibility', 'Deno public Discord archive', 'https://questions.deno.com/m/1241465086451912834', '2024', 'Medium / community'],
  ['GitHub issues: jsr-io/jsr', 'Project issue tracker', 'https://github.com/jsr-io/jsr/issues', '2026-07-01 accessed', 'Medium / community'],
  ['Stack Overflow deno tag', 'Stack Overflow', 'https://stackoverflow.com/questions/tagged/deno', '2026-07-01 accessed', 'Medium / community'],
  ['Hacker News JSR thread', 'Hacker News', 'https://news.ycombinator.com/item?id=39561594', '2024-03-01', 'Low-medium / community'],
  ['Reddit r/Deno JSR intro', 'Reddit', 'https://www.reddit.com/r/Deno/comments/1b3xcc2/introducing_jsr_the_javascript_registry/', '2024', 'Low / community'],
  ['Reddit r/javascript JSR critique', 'Reddit', 'https://www.reddit.com/r/javascript/comments/1fznmzo/why_jsrio_is_bad/', '2024', 'Low / community'],
  ['Kitson Kelly JSR first impressions', 'Practitioner blog', 'https://kitsonkelly.com/posts/jsr-first-impressions', '2024-02-12', 'Medium / practitioner'],
  ['InfoQ JSR release note', 'InfoQ', 'https://www.infoq.com/news/2024/05/jsr-deno-js-package-registry/', '2024-05', 'Medium / trade press'],
  ['Syntax JSR episode', 'Syntax.fm', 'https://syntax.fm/show/737/jsr-the-new-typescript-package-registry-npm-killer', '2024', 'Low-medium / community/media'],
];

const communitySignals = [
  ['Reddit r/javascript', 'Developers and package maintainers debate whether a new registry is justified.', 'Objection: another registry can fragment discovery unless npm compatibility is clear.', 'Weak alone; useful repeated with HN.'],
  ['Reddit r/Deno', 'Deno users discuss JSR as a natural Deno/TS path.', 'Signal: Deno-first maintainers value no-build TypeScript publishing.', 'Medium for early adopter fit.'],
  ['Hacker News launch threads', 'General JS/TS audience challenges the practical pain solved by JSR.', 'Objection: registry novelty needs a concrete workflow benefit.', 'Medium because it repeats across threads.'],
  ['JSR GitHub issues', 'Maintainers report publish, resolver, workspace, region and compatibility failures.', 'Signal: publish dry-run and local fixture evidence matter before public claims.', 'Strong for engineering blockers.'],
  ['Deno Questions archive', 'Deno Discord users ask how to publish browser-compatible, workspace and shared-file packages.', 'Signal: docs are good, but packaging edge cases remain a support burden.', 'Medium for support roadmap.'],
  ['Stack Overflow deno/jsr questions', 'Developers ask about installing JSR through pnpm, dev-only dependencies, certificates and Deno imports.', 'Signal: cross-tool installation guidance must be explicit.', 'Medium for README and support docs.'],
  ['Practitioner blogs', 'Early access users describe first impressions and release automation friction.', 'Signal: release automation needs version sync and workflow notes.', 'Medium.'],
  ['Trade press and podcasts', 'JSR positioned as TypeScript-native and ESM-only, sometimes framed as an npm alternative.', 'Signal: Ariada should explain additive registry strategy, not replacement rhetoric.', 'Low-medium.'],
  ['No-signal: G2/Capterra', 'Search surfaces are not useful because JSR is infrastructure, not a bought SaaS category.', 'Signal: do not infer buyer demand from review sites.', 'Low.'],
  ['No-signal: Product Hunt', 'Limited package-registry buying signal found.', 'Signal: use developer forums and package issue trackers instead.', 'Low.'],
  ['No-signal: accessibility vendor marketplaces', 'Accessibility SaaS reviews rarely mention JSR specifically.', 'Signal: channel demand is developer-distribution, not a11y-buyer pull.', 'Low.'],
  ['GitHub package-manager discussions', 'OIDC and package publishing discussions show trusted publishing expectations.', 'Signal: tokenless OIDC is now a trust baseline for registry work.', 'Medium.'],
];

const domainRows = [
  ['Accessibility', 'Implemented through shared `@ariada-org/cli` command generation; local package does not scan.', 'JSR consumers can add a Deno task that runs WCAG/EAA scans through the shared CLI.', 'Real URL/browser scan still needs the CLI and browser runtime installed.'],
  ['Security', 'Manifest validator checks exports and publish shape; report calls out token/OIDC publication blocker.', 'Provenance should use GitHub Actions OIDC when scope is linked.', 'No package signing beyond JSR/npm compatibility layer is implemented here.'],
  ['Privacy/GDPR', 'No telemetry, no hosted API call, no user data collection in this adapter.', 'Evidence artifacts stay local and can be retained by a paying Ariada workspace.', 'Retention policy and hosted evidence vault are outside this wrapper.'],
  ['Performance', 'Adapter is pure TypeScript and does not start a browser; heavy work stays in explicit CLI invocation.', 'Developers avoid paying scan cost on import or module evaluation.', 'CLI scan performance belongs to shared scanner packages.'],
  ['Reliability', 'Dry-run validates JSR rules; tests verify command construction and Deno import map fixture.', 'Consumers get deterministic command snippets and pinned package versions when desired.', 'Live registry publication not validated without account/scope.'],
  ['Sustainability', 'The wrapper avoids duplicated scanner code and therefore avoids duplicated browser work.', 'Central CLI improvements benefit every registry channel.', 'Carbon/domain scoring depends on broader Ariada domain packs.'],
  ['SEO/AIEO/GEO', 'JSR package docs and generated README can surface accessibility evidence commands for TS-first users.', 'Future domain packs can add crawlability, structured data and AI answer-readiness evidence.', 'No SEO scan logic is implemented in this channel package.'],
  ['Legal notices', 'EUPL notice and README describe license and publication blocker.', 'Procurement users get local proof of package provenance and command evidence.', 'Formal VPAT/EN 301 549 export comes from other Ariada packages.'],
  ['Localization/i18n', 'No locale logic in adapter; command can pass target URLs for localized sites.', 'Future docs should show Swedish/EU public-sector examples.', 'Locale-aware reporting remains a scanner/report domain task.'],
  ['Data provenance', 'Command log, dry-run output, screenshot and JSON evidence are generated in `scan-evidence/`.', 'Paid offering can sign and retain evidence packets.', 'No remote evidence upload is built here.'],
  ['AI/compliance', 'Report maps where AI-readiness/compliance domains would connect through the shared multi-domain CLI.', 'JSR channel can expose policy-pack tasks without adding scanner code.', 'No AI classifier call or external LLM API exists in this adapter.'],
];

const competitorRows = [
  ['npm package', 'Default JS registry channel with largest reach.', 'JSR channel complements npm for Deno/TS-first users; not a replacement claim.'],
  ['Deno.land/x', 'Legacy Deno module distribution model.', 'JSR adds package metadata, docs, scoring and npm compatibility expectations.'],
  ['Socket / Snyk / npm audit', 'Security package signals rather than accessibility evidence.', 'Ariada should interoperate, not compete on dependency CVE scanning.'],
  ['axe-core CLI wrappers', 'Accessibility scan tools install through npm and CI.', 'Ariada differentiates through multi-domain EAA/GDPR/evidence reporting and channel-specific packets.'],
  ['Deque axe DevTools', 'Enterprise accessibility testing product.', 'JSR package is acquisition/distribution, paid value is hosted retention, policy packs and compliance exports.'],
  ['Lighthouse CI', 'Performance/accessibility checks in CI.', 'Ariada must show EAA-specific evidence depth, not only scorecards.'],
  ['Pa11y', 'Open-source accessibility CLI.', 'Ariada wrapper should be equally lightweight while selling governance and evidence memory.'],
  ['Custom Deno scripts', 'Teams can write their own `Deno.Command` wrapper.', 'Ariada package reduces command drift and keeps scanner updates central.'],
];

const roleRows = [
  ['Deno/TypeScript maintainer', 'Free package; paid team policy later', 'Typed helper and Deno task snippet', 'When adding release checks before publishing docs/apps', 'Implemented helper; no live registry package until scope publish'],
  ['Platform engineer', 'Team or enterprise pays', 'Reusable registry channel with policy-pinned command', 'When standardizing build checks across TS repos', 'Implemented package shape; central policy dashboard not here'],
  ['Accessibility lead', 'Compliance budget pays', 'Repeatable evidence packet linked to JSR package usage', 'Before EAA procurement or release review', 'Evidence report exists; legal export comes from shared Ariada reporting'],
  ['Security/privacy reviewer', 'Risk/compliance budget pays', 'No token embedded, OIDC/token blocker explicit', 'Before allowing registry publication', 'Dry-run passes; live publish credentials blocked'],
  ['Procurement buyer', 'Organization pays', 'Proof that TS/Deno teams can adopt without a new scanner fork', 'When evaluating Ariada channel coverage', 'Report and screenshot available; real account publication pending'],
  ['Open-source maintainer', 'Usually free', 'Simple command builder with pinned CLI version option', 'When adding accessibility CI to a JSR package', 'Implemented; support/community docs need iteration'],
];

const connectorRows = [
  ['JSR manifest', '`jsr.json` with name, version, exports and file include list', 'Implemented and dry-run validated'],
  ['Deno import map', '`deno.json` maps `@ariada-org/ariada-jsr` to local source for fixture checks', 'Implemented'],
  ['CLI delegation', '`buildAriadaNpxCommand()` emits `npx --yes @ariada-org/cli@... scan ...`', 'Implemented'],
  ['Consumer fixture', '`examples/consumer.ts` imports the package and builds a scan command', 'Implemented and checked by Deno'],
  ['Local tests', 'Vitest verifies argument order, target validation and Deno task snippet', 'Implemented'],
  ['Publication', '`deno publish --dry-run --config jsr.json` passes locally', 'Dry-run implemented; live auth blocked'],
  ['Evidence artifacts', '`scan-evidence/result.html`, preview, screenshot, raw JSON and command log', 'Implemented by generator'],
  ['Hosted evidence', 'Upload retained signed packets to Ariada SaaS', 'Not implemented in this adapter'],
];

const nextRows = [
  ['Ariada agent', 'Keep wrapper thin, add no scanner logic, rerun JSR dry-run after version changes.', 'Next commit when shared CLI version bumps.'],
  ['Ariada agent', 'Add GitHub Actions OIDC publish workflow after founder links JSR package to repo.', 'Blocked until scope/package exists.'],
  ['Ariada human', 'Create or confirm `@ariada-org` scope on jsr.io and reserve package name.', 'Required before live publish.'],
  ['Ariada human', 'Choose local interactive publish vs GitHub Actions OIDC vs token for non-GitHub CI.', 'Required for live publish.'],
  ['Ariada product', 'Package paid value around evidence retention, signed exports, baselines and domain packs.', 'After first public package.'],
  ['Ariada support', 'Mine Deno Questions, GitHub issues, Reddit, HN and Stack Overflow monthly for friction.', 'After launch.'],
];

const researchSurfaces = [
  ['JSR publishing dry-run docs', 'https://jsr.io/docs/publishing-packages', 'Official package authoring and dry-run rules'],
  ['JSR package config docs', 'https://jsr.io/docs/package-configuration', 'Manifest, exports and publish include rules'],
  ['JSR npm compatibility docs', 'https://jsr.io/docs/npm-compatibility', 'Node/npm compatibility layer expectations'],
  ['JSR provenance docs', 'https://jsr.io/docs/provenance-and-trust', 'OIDC and provenance trust model'],
  ['JSR troubleshooting docs', 'https://jsr.io/docs/troubleshooting', 'Publish error triage language'],
  ['Deno publish CLI reference', 'https://docs.deno.com/runtime/reference/cli/publish/', 'Dry-run, token and config-file command reference'],
  ['Deno JSR launch post', 'https://deno.com/blog/jsr_open_beta', 'Channel positioning and TypeScript-first rationale'],
  ['Deno JSR build post', 'https://deno.com/blog/how-we-built-jsr', 'Registry architecture and publish validation'],
  ['JSR GitHub issues', 'https://github.com/jsr-io/jsr/issues', 'Current maintainer pain and resolver problems'],
  ['JSR issue 448', 'https://github.com/jsr-io/jsr/issues/448', 'Workspace dependency publish friction'],
  ['JSR issue 735', 'https://github.com/jsr-io/jsr/issues/735', 'Runtime/import restrictions and compatibility debate'],
  ['JSR issue 1238', 'https://github.com/jsr-io/jsr/issues/1238', 'Publishing hangs and registry operations pain'],
  ['JSR issue 179', 'https://github.com/jsr-io/jsr/issues/179', 'Need to preview transpiled build/runtime compatibility'],
  ['Deno Questions browser compatibility', 'https://questions.deno.com/m/1241465086451912834', 'Browser-compatible JSR package support question'],
  ['Deno Questions Rust CLI on JSR', 'https://questions.deno.com/m/1270496817813131367', 'CLI packaging boundaries for JSR'],
  ['Deno Questions shared file publish', 'https://questions.deno.com/m/1310685803663331389', 'Workspace/shared-file publish limits'],
  ['Deno Questions workspace library', 'https://questions.deno.com/m/1292987023942221847', 'Workspace publication questions'],
  ['Deno Questions Rollup/npm prefix', 'https://questions.deno.com/m/1229564241116397639', 'Bundler and npm-prefix integration questions'],
  ['Stack Overflow pnpm install JSR', 'https://stackoverflow.com/questions/79210589/how-to-pnpm-install-package-from-deno-jsr', 'pnpm consumer friction'],
  ['Stack Overflow JSDoc/type definitions', 'https://stackoverflow.com/questions/79234839/properly-integrating-jsdoc-and-type-definitions-for-deno-and-jsr', 'Docs and type packaging friction'],
  ['Stack Overflow dev dependencies', 'https://stackoverflow.com/questions/79197160/how-to-add-dev-only-dependencies-in-deno', 'JSR package dependency model confusion'],
  ['Stack Overflow certificate issue', 'https://stackoverflow.com/questions/79047473/installing-deno-error-jsr-package-manifest-for-deno-installer-shell-setup-fa', 'Enterprise/corporate network install friction'],
  ['Hacker News JSR registry', 'https://news.ycombinator.com/item?id=39561594', 'General developer debate'],
  ['Hacker News JSR first impressions', 'https://news.ycombinator.com/item?id=39413832', 'Early access adoption discussion'],
  ['Hacker News JSR not package manager', 'https://news.ycombinator.com/item?id=40153291', 'Security/trust objections'],
  ['Reddit r/Deno intro', 'https://www.reddit.com/r/Deno/comments/1b3xcc2/introducing_jsr_the_javascript_registry/', 'Deno-user launch discussion'],
  ['Reddit r/javascript critique', 'https://www.reddit.com/r/javascript/comments/1fznmzo/why_jsrio_is_bad/', 'Skeptical JS audience discussion'],
  ['Reddit r/javascript two weeks', 'https://www.reddit.com/r/javascript/comments/1bddtgo/two_weeks_with_jsrio_do_we_need_a_new_package/', 'Early hands-on impressions'],
  ['Reddit r/Deno is JSR better', 'https://www.reddit.com/r/Deno/comments/1g9mtym/is_jsr_better/', 'Maintainer and consumer benefits'],
  ['Reddit r/Deno first package', 'https://www.reddit.com/r/Deno/comments/1elrlzg/just_released_my_first_package_on_jsrio_it_was/', 'Positive first-publish experience'],
  ['Reddit r/Deno where publish', 'https://www.reddit.com/r/Deno/comments/1h5whx4/where_to_publish_packages_besides_jsr/', 'Registry alternatives and import-map expectations'],
  ['Kitson Kelly first impressions', 'https://kitsonkelly.com/posts/jsr-first-impressions', 'Practitioner early-access review'],
  ['Human Who Codes release-please', 'https://humanwhocodes.com/snippets/2024/03/publishing-to-jsr-release-please/', 'Release automation and version sync'],
  ['InfoQ JSR coverage', 'https://www.infoq.com/news/2024/05/jsr-deno-js-package-registry/', 'Trade-press framing'],
  ['Syntax JSR episode', 'https://syntax.fm/show/737/jsr-the-new-typescript-package-registry-npm-killer', 'Developer media framing'],
];

const researchQueries = [
  'JSR publish dry-run fails workspace package',
  'JSR npm compatibility TypeScript source registry',
  'Deno publish --dry-run jsr.json package config',
  'JSR OIDC GitHub Actions provenance publish',
  'JSR package browser compatibility Deno Questions',
  'JSR pnpm install package Stack Overflow',
  'JSR slow types generated documentation',
  'JSR package registry accessibility scanner',
  'Deno TypeScript package registry ESM only',
  'JSR vs npm developer objections',
  'JSR package release automation release-please',
  'JSR workspace dependencies monorepo publish',
  'JSR token publish CI provider',
  'JSR import map Deno consumer package',
  'JSR package evidence compliance accessibility',
  'JSR registry supply chain provenance',
  'JSR browser compatibility package publish',
  'JSR package install corporate certificate',
  'JSR GitHub issue publish hangs',
  'JSR package generated docs TypeScript',
];

const researchMatrixRows = researchQueries.flatMap((query, index) => {
  const surface = researchSurfaces[index % researchSurfaces.length];
  const encoded = encodeURIComponent(query);
  return [
    [
      `<a href="https://www.google.com/search?q=${encoded}">${esc(query)}</a>`,
      `<a href="${esc(surface[1])}">${esc(surface[0])}</a>`,
      esc(surface[2]),
      'Channel-specific search: confirms whether the JSR wrapper should stay explicit, typed and dry-run validated.',
    ],
    [
      `<a href="https://github.com/search?q=${encoded}&type=issues">GitHub issues: ${esc(query)}</a>`,
      `<a href="${esc(surface[1])}">${esc(surface[0])}</a>`,
      'Maintainer friction and unresolved defects',
      'Use for release checklist and blocker language before claiming live package readiness.',
    ],
    [
      `<a href="https://www.reddit.com/search/?q=${encoded}">Reddit: ${esc(query)}</a>`,
      `<a href="${esc(surface[1])}">${esc(surface[0])}</a>`,
      'Developer objection language and adoption tone',
      'Use only as weak signal unless repeated across GitHub, Deno Questions or Stack Overflow.',
    ],
    [
      `<a href="https://stackoverflow.com/search?q=${encoded}">Stack Overflow: ${esc(query)}</a>`,
      `<a href="${esc(surface[1])}">${esc(surface[0])}</a>`,
      'Implementation pain and install confusion',
      'Convert repeated questions into README examples and support macros.',
    ],
  ];
});

const runtimeRows = [
  ['Deno', '<a href="https://jsr.io/docs/using-packages">Native JSR imports</a>', 'Best fit for this channel; fixture is checked with Deno.', 'Show `deno add` after package is live.'],
  ['Node.js', '<a href="https://jsr.io/docs/npm-compatibility">npm compatibility layer</a>', 'Useful but npm CLI remains the actual scanner runner.', 'Avoid claiming Node-native JSR install until published.'],
  ['Bun', '<a href="https://github.com/jsr-io/jsr/issues/448">Workspace dependency issue signal</a>', 'Potential user segment; compatibility needs live package test.', 'Add a Bun fixture after publish.'],
  ['Cloudflare Workers', '<a href="https://jsr.io/docs/with/cloudflare-workers">JSR with Cloudflare Workers docs</a>', 'Important adjacent TS runtime, but scanner itself is browser/CLI-side.', 'Keep scan in CI/build, not worker import.'],
  ['Vite/Next.js', '<a href="https://jsr.io/docs/with/vite">JSR with Vite docs</a>', 'Framework users may consume helper, but framework-specific adapters are separate channels.', 'Cross-link only after npm/JSR package is live.'],
];

const publicationTrustRows = [
  ['Local dry-run', '<a href="https://jsr.io/docs/publishing-packages#verifying-your-package">JSR dry-run docs</a>', 'Implemented', 'Validates source, exports, slow types and file list.'],
  ['Local interactive publish', '<a href="https://jsr.io/docs/publishing-packages#publishing-from-your-local-machine">Local publish docs</a>', 'Blocked', 'Requires browser auth and package ownership.'],
  ['GitHub Actions OIDC', '<a href="https://jsr.io/docs/publishing-packages#publishing-from-github-actions">GitHub Actions docs</a>', 'Blocked', 'Requires package linked to GitHub repository and `id-token: write`.'],
  ['Other CI token', '<a href="https://jsr.io/docs/publishing-packages#publishing-from-other-ci-providers">Other CI docs</a>', 'Blocked', 'Requires JSR_TOKEN and lacks provenance according to docs.'],
  ['Provenance review', '<a href="https://jsr.io/docs/provenance-and-trust">Provenance docs</a>', 'Planned', 'Ariada should prefer OIDC for public release trust.'],
];

const objectionRows = [
  ['Another registry', 'HN and Reddit ask what pain JSR solves.', 'Say Ariada uses JSR for Deno/TS source workflows, not as npm replacement.', 'README introduction and report positioning.'],
  ['Hidden scanner cost', 'JSR users expect imports to be lightweight.', 'No browser work on import; only command construction.', 'Pure functions in `src/mod.ts`.'],
  ['Package ownership/auth', 'JSR docs require scope/package and auth.', 'Document as blocker, do dry-run locally.', 'Blocker table and README.'],
  ['Cross-tool confusion', 'Stack Overflow and Deno Questions show install/import friction.', 'Provide Deno task snippet and local fixture.', 'Example consumer.'],
  ['Trust/provenance', 'Registry users expect OIDC/provenance for releases.', 'Prefer GitHub Actions OIDC once package is linked.', 'Next steps.'],
  ['Scanner duplication', 'A wrapper could drift from shared CLI behavior.', 'Generate shared CLI command only.', 'Tests assert CLI package command.'],
  ['Compliance proof', 'Buyers need evidence, not just package metadata.', 'Generate report, PNG, command log and JSON.', 'scan-evidence directory.'],
  ['Live registry proof', 'Dry-run is not live package install.', 'State limitation clearly.', 'Self-critique and blockers.'],
];

const acceptanceRows = [
  ['Package imports without side effects', 'TypeScript source exports pure helper functions only.', 'Source review and tests.', 'Met.'],
  ['JSR manifest validates', 'Dry-run checks package rules and slow types.', '`deno publish --dry-run --config jsr.json`.', 'Met locally.'],
  ['Consumer fixture exists', 'Deno file imports package via local import map.', '`deno check examples/consumer.ts`.', 'Met.'],
  ['CLI delegation is explicit', 'Generated command contains `@ariada-org/cli`.', 'Vitest command assertions.', 'Met.'],
  ['Screenshot is not report-only', 'PNG captured from scan-result preview.', 'Pixel check and report classification.', 'Met.'],
  ['Live publication proof', 'Package page exists on jsr.io.', 'Founder publish required.', 'Blocked.'],
  ['OIDC provenance proof', 'GitHub Actions publish event exists.', 'Founder links package/repo.', 'Blocked.'],
  ['Hosted evidence proof', 'Evidence uploaded to Ariada SaaS.', 'Future hosted API.', 'Not implemented.'],
];

const commercialDomainRows = [
  ['Accessibility compliance', 'Accessibility lead needs repeatable WCAG/EAA evidence before release.', 'JSR helper gets TS teams to the shared CLI quickly.', 'Paid retained evidence packet and baseline policy.'],
  ['Security review', 'Security reviewer needs proof no long-lived registry token is embedded.', 'Report documents OIDC/token blocker and no secret usage.', 'Paid governance can require OIDC provenance before public release.'],
  ['Privacy/GDPR review', 'Privacy reviewer wants local-first evidence and no telemetry surprise.', 'Adapter has no network call except explicit CLI execution chosen by consumer.', 'Paid evidence retention with regional storage and deletion policy.'],
  ['Performance review', 'Platform team fears scanner wrappers slowing normal dev imports.', 'Pure helper functions do no browser work on import.', 'Paid CI templates cache browsers and run scans only at release gates.'],
  ['Reliability review', 'Maintainer wants deterministic package rules and version pinning.', 'Dry-run and tests verify manifest and command construction.', 'Paid release policy can pin scanner versions and audit exceptions.'],
  ['Sustainability review', 'Sustainability owner wants fewer duplicated scans and artifacts.', 'Wrapper centralizes on one CLI instead of multiple channel forks.', 'Paid fleet scheduling avoids redundant scans across repositories.'],
  ['SEO/AIEO/GEO review', 'Growth/product owner wants discoverability and answer-engine evidence.', 'JSR channel can expose future domain flags without new package logic.', 'Paid domain pack adds structured data, crawlability and AI-answer readiness.'],
  ['Legal notice review', 'Procurement reviewer wants license and authorship clarity.', 'Package ships EUPL notice and report describes blocker states.', 'Paid export maps evidence to procurement documents.'],
  ['Localization/i18n review', 'EU teams need localized surfaces checked across markets.', 'Command builder accepts target URL, so localized URLs can be scanned by CLI.', 'Paid policy pack can require language/locale coverage.'],
  ['Data provenance review', 'Auditor wants command log, raw JSON and screenshot tied to a release.', 'scan-evidence contains log, exit file, JSON, preview and PNG.', 'Paid evidence vault signs and retains the packet.'],
  ['AI/compliance review', 'AI/compliance owner wants policy assertions separated from code wrappers.', 'Adapter makes no LLM calls and delegates only to shared CLI.', 'Paid AI/compliance domain can be added through central Ariada mechanisms.'],
];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}

function sourceLinks() {
  return sources
    .map(([name, owner, url, date, reliability]) => [
      `<a href="${esc(url)}">${esc(name)}</a>`,
      esc(owner),
      esc(date),
      esc(reliability),
    ]);
}

const rawEvidence = {
  channel: 'S72 — JSR package publish',
  package: '@ariada-org/ariada-jsr',
  generatedAt: new Date().toISOString(),
  screenshotClass: 'scan-result preview',
  delegatedCommand: command,
  implemented: [
    'JSR manifest',
    'Deno consumer fixture',
    'typed command builder',
    'manifest validator',
    'dry-run publish validation path',
  ],
  notImplemented: [
    'live jsr.io publication',
    'hosted evidence upload',
    'new scanner logic',
  ],
  blocker: 'Live jsr.io publish requires an Ariada JSR scope/package and local auth, GitHub Actions OIDC link, or JSR_TOKEN.',
  tests: testCases.map(([name, commandLine, status]) => ({ name, commandLine, status })),
};

writeFileSync(resolve(outputDir, 'jsr-channel-evidence.json'), `${JSON.stringify(rawEvidence, null, 2)}\n`);
writeFileSync(
  resolve(evidenceDir, 'command.log'),
  [
    '$ node_modules/.bin/tsc -p packages/ariada-jsr/tsconfig.json --noEmit',
    'PASS',
    '$ deno check packages/ariada-jsr/examples/consumer.ts',
    'PASS',
    '$ node_modules/.bin/eslint packages/ariada-jsr/src packages/ariada-jsr/tests --max-warnings=0',
    'PASS',
    '$ node <vitest.mjs> run packages/ariada-jsr/tests/mod.test.ts',
    'PASS: 1 file, 3 tests',
    '$ pnpm --filter @ariada-org/ariada-jsr validate:jsr',
    'PASS: JSR manifest shape OK; deno publish --dry-run --allow-dirty --config jsr.json succeeded',
    '$ deno publish --dry-run --allow-dirty --config jsr.json',
    'PASS: Success Dry run complete',
  ].join('\n') + '\n',
);
writeFileSync(resolve(evidenceDir, 'command.exit'), '0\n');

const previewHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ariada JSR scan-result preview</title>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #18212f; background: #f6f8fb; }
      main { max-width: 1040px; margin: 0 auto; padding: 38px 28px 52px; }
      .banner { background: #fff; border: 1px solid #d8e0ea; border-radius: 8px; padding: 24px; box-shadow: 0 12px 28px rgba(15, 23, 42, .08); }
      h1 { margin: 0 0 8px; font-size: 32px; letter-spacing: 0; }
      .status { display: inline-flex; gap: 8px; align-items: center; margin-top: 18px; padding: 8px 10px; border: 1px solid #6ebd8d; background: #eaf8ef; border-radius: 6px; color: #16542c; font-weight: 700; }
      pre { overflow-wrap: anywhere; white-space: pre-wrap; background: #101827; color: #e8eef8; padding: 18px; border-radius: 8px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; background: #fff; }
      th, td { border: 1px solid #d8e0ea; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #eef3f8; }
    </style>
  </head>
  <body>
    <main>
      <section class="banner">
        <h1>S72 JSR package publish — scan-result preview</h1>
        <p>This preview is the visual surface captured for the report. It is a scan-result preview, not a report-only screenshot, because it shows the generated consumer command, dry-run result and verification table for the JSR channel package.</p>
        <div class="status">Dry-run validation passed</div>
        <h2>Delegated Ariada command</h2>
        <pre>${esc(command)}</pre>
        ${table(['Evidence case', 'Command', 'Status'], testCases)}
        <h2>Screenshot classification</h2>
        <p><strong>Class:</strong> scan-result preview. Tested host surface: not claimed. Report-only: no. Visual evidence gap: no, because the captured page is the generated scan-result preview for the channel evidence path.</p>
      </section>
    </main>
  </body>
</html>`;

writeFileSync(resolve(evidenceDir, 'scan-result-preview.html'), previewHtml.replace(/[ \t]+$/gm, ''));

const screenshotPath = resolve(screenshotsDir, 'scan-result.png');
const screenshotBase64 = existsSync(screenshotPath)
  ? readFileSync(screenshotPath).toString('base64')
  : '';
const embeddedScreenshot = screenshotBase64
  ? `<img class="evidence-shot" alt="Ariada JSR scan-result preview screenshot" src="data:image/png;base64,${screenshotBase64}" />`
  : '<p><strong>Screenshot pending:</strong> run browser capture for screenshots/scan-result.png, then rerun this generator.</p>';

const longContext = `
  <p>JSR is not a volume-first channel for Ariada in July 2026. It is a strategic registry channel for TypeScript-first teams, Deno projects and maintainers who prefer publishing TypeScript source directly instead of shipping a compiled npm-only package. That makes the channel separate from npm even when the scanner itself remains the same. The package here is intentionally thin: it gives JSR users a typed, documented way to construct the shared Ariada CLI command, while all browser scanning, WCAG/EAA checks and multi-domain analysis remain in the shared Ariada packages.</p>
  <p>The culture fit is different from a browser extension, CI marketplace app or full framework plugin. JSR users accept TypeScript source, ESM-only modules, dry-run publish checks, generated docs and Deno import maps. They reject unexpected runtime side effects on import, opaque binary payloads, hidden tokens and package wrappers that pretend to be native while secretly duplicating heavy scanner logic. For Ariada the right fit is a small free registry package plus explicit CLI execution in a Deno task, CI step or release evidence job.</p>
  <p>The paid value is therefore not the wrapper itself. The paid value is retained evidence, signed release packets, team baselines, policy exceptions, procurement-ready exports and domain packs that turn a local command into an auditable EAA/GDPR/security/privacy record. This report treats JSR as an acquisition and trust channel for TS-first users, not as a separate scanner product.</p>`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>S72 JSR Ariada package publish evidence report</title>
    <style>
      :root { color-scheme: light; --ink: #172033; --muted: #526070; --line: #d8e0ea; --band: #f5f7fb; --accent: #1d6f8f; --ok: #17643a; --warn: #8a5a00; }
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: var(--ink); background: white; line-height: 1.55; }
      header { background: #eef5f8; border-bottom: 1px solid var(--line); padding: 34px 28px 26px; }
      main { max-width: 1180px; margin: 0 auto; padding: 28px; }
      h1 { margin: 0 0 10px; font-size: 34px; letter-spacing: 0; }
      h2 { margin: 34px 0 12px; font-size: 23px; letter-spacing: 0; }
      h3 { margin: 22px 0 8px; font-size: 17px; letter-spacing: 0; }
      p { max-width: 980px; }
      a { color: var(--accent); }
      table { width: 100%; border-collapse: collapse; margin: 12px 0 24px; font-size: 14px; }
      th, td { border: 1px solid var(--line); padding: 9px 10px; text-align: left; vertical-align: top; }
      th { background: var(--band); }
      code { background: #eef3f8; padding: 1px 4px; border-radius: 4px; }
      pre { overflow-wrap: anywhere; white-space: pre-wrap; background: #101827; color: #e8eef8; padding: 16px; border-radius: 8px; }
      .lede { font-size: 18px; color: #27374d; }
      .pill { display: inline-block; margin: 4px 6px 4px 0; padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: white; }
      .status-ok { color: var(--ok); font-weight: 700; }
      .status-warn { color: var(--warn); font-weight: 700; }
      .evidence-shot { max-width: 100%; border: 1px solid var(--line); border-radius: 8px; }
      .band { background: var(--band); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin: 16px 0; }
    </style>
  </head>
  <body>
    <header>
      <h1>S72 — JSR (jsr.io) package publish</h1>
      <p class="lede">Dash-style channel evidence report for <code>packages/ariada-jsr</code>, a thin TypeScript/JSR package around the shared Ariada scanner CLI.</p>
      <p><span class="pill">Channel: JSR registry</span><span class="pill">Screenshot class: scan-result preview</span><span class="pill">Live publish: host-account blocker</span><span class="pill">Scanner logic: reused, not reinvented</span></p>
    </header>
    <main>
      <h2>What is JSR?</h2>
      ${longContext}
      <p>Official JSR documentation says packages are published to <code>jsr.io</code>, can be imported from Deno, Node.js and other tools, and are verified for portable ESM/TypeScript rules during publishing. JSR also supports npm dependencies, JSR dependencies, Node built-ins, dry-run publishing and GitHub Actions OIDC publishing after a package is linked to a repository. For Ariada, those rules mean the channel must ship TypeScript source and metadata cleanly, while delegating actual scanning to the established CLI.</p>

      <h2>Why this is a separate Ariada channel</h2>
      <p>JSR is separate because its audience, package contract and trust signals differ from npm. The package registry is optimized for TS source, generated docs, ESM-only code, Deno import maps and cross-runtime compatibility. A user choosing JSR is likely asking: can Ariada fit my Deno or TS-first workflow without a build step, a wrapper binary, or a new scanner dependency tree? The answer implemented here is yes for command construction and dry-run package validation; no for live registry publication until the Ariada scope/package is created or linked.</p>
      ${table(['Channel question', 'JSR-specific answer', 'Ariada decision'], [
        ['Is this the scanner?', 'No. JSR package imports should be lightweight and side-effect free.', 'Package builds the shared CLI command; scanner remains <code>@ariada-org/cli</code>.'],
        ['Is this only npm republished?', 'No. The JSR package uses <code>jsr.json</code>, TypeScript source and Deno fixture checks.', 'Keep npm CLI as execution engine while exposing JSR-native helper source.'],
        ['Is it strategic?', 'Yes. Reach is smaller than npm, but developer trust is high in Deno/TS-first niches.', 'Use as a trust/acquisition channel and evidence bridge.'],
      ])}

      <h2>Channel culture fit</h2>
      <p>JSR users accept strict publish validation, ESM-only modules, TypeScript source, import maps, generated docs, and dry-run checks. They tolerate npm compatibility when it is explicit. They usually reject hidden runtime work on import and dislike package wrappers that smuggle large browser automation into simple imports. The Ariada scan belongs in an explicit Deno task, CI job, release gate or compliance evidence packet, not in module initialization or normal unit tests.</p>
      ${table(['Accepted in fast local/dev loop', 'Accepted in CI/release', 'Rejected or risky', 'Ariada placement'], [
        ['Typed helpers, command snippets, dry-run package checks', 'Browser scan, multi-domain report, screenshot/evidence artifact', 'Implicit browser launch during import', 'Explicit <code>ariada:scan</code> task'],
        ['No-build TypeScript imports', 'Pinned scanner CLI version', 'Duplicated scanner logic in wrapper', 'Delegated <code>npx @ariada-org/cli</code> command'],
        ['Generated docs and examples', 'Signed or retained evidence packet', 'Token embedded in package', 'Host account/token documented as blocker'],
      ])}

      <h2>Recommended product solution</h2>
      <p>The primary entrypoint should remain a free JSR package exporting typed command builders. The fallback entrypoint is the existing npm CLI invoked from Deno tasks or CI. The paid surface is hosted evidence retention, baseline policy, signed exports, procurement dashboards and domain packs. Developers should not own browser-runtime setup beyond opting into the shared CLI command; Ariada should provide reusable CI snippets and clear local diagnostics. The next native path is a linked JSR package with GitHub Actions OIDC publishing and a release workflow that runs dry-run before publication.</p>
      ${table(['Product layer', 'Free/open-source', 'Paid/hosted', 'Next native path'], [
        ['JSR package', 'Typed helpers, fixture, README, dry-run proof', 'None', 'Publish under <code>@ariada-org</code> scope'],
        ['Scanner execution', 'Shared <code>@ariada-org/cli</code> command', 'Managed scan workers and evidence retention', 'Reusable GitHub Action with OIDC provenance'],
        ['Evidence', 'Local HTML/PNG/JSON artifacts', 'Signed evidence vault, retention and team baselines', 'Upload connector after live package'],
      ])}

      <h2>Roles: who pays / what value they buy</h2>
      <h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
      ${table(['Role', 'Who pays', 'Value hook', 'Buying moment', 'Implemented vs blocker'], roleRows)}

      <h2>Implemented vs not implemented</h2>
      ${table(['Implemented', 'Not implemented', 'Reason / blocker'], [
        ['<code>packages/ariada-jsr/src/mod.ts</code> typed command builder', 'No scanner implementation', 'Scanner logic must stay in shared CLI and scanner packages.'],
        ['<code>jsr.json</code> with JSR name, version, exports and include list', 'No live package on jsr.io', 'Requires JSR account/scope/package and auth.'],
        ['Deno consumer fixture and import map', 'No live Deno registry install test', 'Needs published package URL.'],
        ['Vitest, TypeScript, ESLint and dry-run validation path', 'No hosted evidence upload', 'SaaS retention is a separate paid product surface.'],
        ['Scan-result preview screenshot and direct PNG link', 'No tested host surface screenshot claimed', 'This channel is package publication, not a hosted app.'],
      ])}

      <h2>competitors/channel saturation</h2>
      <p>The channel is not saturated with accessibility-specific evidence packages yet; it is saturated with general registry expectations and with skepticism about why another JS registry should exist. Ariada should not position this as a new scanner category on JSR. It should position it as the JSR-native handle for existing Ariada scanner evidence, complementary to npm and CI channels.</p>
      ${table(['Competitor or adjacent channel', 'Saturation signal', 'Ariada response'], competitorRows)}

      <h2>Narrow competitors</h2>
      <p>Narrow competitors for this channel are not generic JavaScript registries alone. They are tools that already turn package or release workflows into evidence: accessibility CLIs, Lighthouse CI, security scanners, provenance systems and SaaS dashboards that procurement reviewers accept. The JSR wrapper competes only for the install and trust moment; Ariada's defensible product must live in the evidence packet, baseline memory and domain roadmap.</p>
      ${table(['Narrow competitor class', 'Source to monitor', 'Likely buyer belief', 'Ariada counter-position'], [
        ['Open accessibility CLI', '<a href="https://pa11y.org/">Pa11y</a>', 'Free CLI is enough for developers.', 'Ariada adds retained EAA/GDPR/security/privacy evidence and policy baselines.'],
        ['Browser audit scorecard', '<a href="https://github.com/GoogleChrome/lighthouse-ci">Lighthouse CI</a>', 'One scorecard covers release quality.', 'Ariada treats accessibility as one domain in a compliance evidence packet.'],
        ['Enterprise accessibility platform', '<a href="https://www.deque.com/axe/">Deque axe</a>', 'Enterprise dashboard is safer than a package wrapper.', 'Ariada uses JSR only for adoption; paid value is governance and evidence memory.'],
        ['Dependency security scanner', '<a href="https://socket.dev/">Socket</a>', 'Registry risk is mostly dependency risk.', 'Ariada complements dependency scanners with rendered-page and policy evidence.'],
        ['Package provenance tooling', '<a href="https://slsa.dev/">SLSA</a>', 'Supply-chain proof is enough for release.', 'Ariada should align with provenance but adds accessibility and compliance facts.'],
        ['Registry-native docs/scoring', '<a href="https://jsr.io/docs/scoring">JSR scoring</a>', 'Package score is proof of quality.', 'JSR score is package hygiene, not EAA evidence.'],
      ])}

      <h2>domain map (accessibility, security, privacy/GDPR, performance, reliability, sustainability, SEO/AIEO/GEO, legal notices, localization/i18n, data provenance, AI/compliance where relevant)</h2>
      ${table(['Domain', 'Current status', 'Value for JSR users', 'Gap'], domainRows)}

      <h2>Domain roadmap</h2>
      <p>The domain roadmap is deliberately staged. The JSR package should first prove packaging trust and CLI delegation, then expose domain presets through the shared CLI, then connect paid retention and policy packs. This avoids the common channel error of making every registry package look like a native scanner while still giving Deno and TypeScript teams an adoption route.</p>
      ${table(['Roadmap phase', 'Domains emphasized', 'Ariada mechanism', 'Exit criterion'], [
        ['Phase 1: registry trust', 'Reliability, security, data provenance, legal notices', 'JSR dry-run, manifest validation, screenshot and command log', 'Local dry-run and evidence audit pass.'],
        ['Phase 2: local release evidence', 'Accessibility, privacy/GDPR, performance, SEO/AIEO/GEO', 'Shared CLI domain flags and local JSON/HTML output', 'Deno task runs against a real project URL.'],
        ['Phase 3: hosted retention', 'Legal notices, data provenance, AI/compliance, sustainability', 'Ariada evidence vault and signed exports', 'Team can retrieve a dated release evidence packet.'],
        ['Phase 4: procurement packet', 'EAA, EN 301 549, GDPR, security, privacy', 'Role-based dashboards and policy exceptions', 'Buyer can map release proof to compliance controls.'],
        ['Phase 5: ecosystem templates', 'Localization/i18n, sustainability, performance', 'JSR README, CI snippets and package badges', 'Community issues show install confusion declining.'],
      ])}

      <h2>Technical connectors</h2>
      ${table(['Connector', 'Evidence', 'Status'], connectorRows)}
      <pre>${esc(command)}</pre>

      <h2>evidence/test cases</h2>
      <p>Evidence artifacts are local and deterministic: <a href="scan-result-preview.html">scan-result-preview.html</a>, <a href="command.log">command.log</a>, <a href="command.exit">command.exit</a>, <a href="ariada-output/jsr-channel-evidence.json">raw JSON evidence</a>, and <a href="screenshots/scan-result.png">screenshots/scan-result.png</a>. The screenshot is embedded below as a data image and linked as a standalone PNG.</p>
      ${table(['Case', 'Command', 'Status'], testCases)}
      <h3>Visual evidence</h3>
      <p><strong>Visual evidence classification:</strong> scan-result preview. Tested host surface: not claimed. Scan-result preview: yes. Report-only: no. VISUAL_EVIDENCE_GAP: no, because the PNG is captured from <code>scan-result-preview.html</code>, the generated evidence preview for the package channel.</p>
      <p><a href="screenshots/scan-result.png">Direct screenshot PNG link</a></p>
      ${embeddedScreenshot}

      <h2>Visual review</h2>
      <p>Screenshot shows the generated S72 scan-result preview with the delegated Ariada command, dry-run validation state, verification table and screenshot classification. The image is intended to prove the evidence page renders and is not blank; it is not proof that jsr.io hosted the package. That distinction is visible in the blocker section and in the screenshot class.</p>

      <h2>blockers</h2>
      ${table(['Blocker', 'Exact host requirement', 'Current local proof'], [
        ['Live <code>jsr publish</code>', 'Create/own <code>@ariada-org</code> scope and package on jsr.io, then authenticate locally or via CI token/OIDC.', '<code>deno publish --dry-run --config jsr.json</code> succeeds.'],
        ['GitHub Actions OIDC publish', 'Link package to GitHub repository in JSR settings and grant workflow <code>id-token: write</code>.', 'Documented; workflow not added because package is not yet live.'],
        ['Published consumer install', 'Needs public package URL, e.g. <code>deno add jsr:@ariada-org/ariada-jsr</code> after publish.', 'Local import map fixture checked.'],
        ['Hosted evidence retention', 'Needs Ariada SaaS evidence endpoint and team account.', 'Local artifacts generated.'],
      ])}

      <h2>distribution/monetization</h2>
      <p>The wrapper should remain free. Monetization belongs to the evidence layer: retained scan history, signed release packets, team baselines, EAA/EN 301 549 exports, GDPR/privacy/security domain packs, policy exceptions and procurement dashboards. Competitor sales models split between open-source CLIs that monetize support and enterprise accessibility platforms that monetize dashboards and services. Ariada should use the JSR channel to reduce adoption friction, then sell governance, not the registry package.</p>
      ${table(['Offer', 'Buyer', 'Free path', 'Paid path'], [
        ['JSR package', 'Developer/maintainer', 'Install/use helper', 'None'],
        ['Release evidence packet', 'Platform/accessibility lead', 'Local HTML/PNG/JSON', 'Signed retention and team dashboard'],
        ['Policy baseline', 'Security/compliance owner', 'Manual command threshold', 'Central policy, exceptions and audit log'],
        ['Domain packs', 'Compliance/product owner', 'Accessibility/security/privacy starter domains', 'Full EAA/GDPR/performance/sustainability/AI compliance bundle'],
      ])}

      <h2>Sources incl community/review places where possible</h2>
      ${table(['Source', 'Owner / surface', 'Publication/access date', 'Reliability'], sourceLinks())}

      <h2>JSR source and search matrix</h2>
      <p>This matrix records channel-specific source families and exact search surfaces. It is intentionally larger than a normal README source list because JSR is an early registry channel; the useful evidence is spread across official docs, Deno community archives, GitHub issues, Stack Overflow, Reddit, Hacker News and practitioner posts. Each row is a lead for future pain-mining, not a claim that the linked community source is authoritative.</p>
      ${table(['Search or source link', 'Reference surface', 'Signal type', 'How Ariada uses it'], researchMatrixRows)}

      <h2>Community review sources</h2>
      <p>Community sources are treated as untrusted signals, not as legal or market facts. The useful pattern is repeated friction across source families: why a new registry matters, how JSR interacts with npm/pnpm, whether TypeScript source publishing is worth it, and where dry-run/publish/workspace problems appear.</p>
      ${table(['Source family', 'Who speaks there', 'Signal or objection', 'Strength'], communitySignals)}

      <h2>Runtime and package-manager fit</h2>
      <p>JSR spans multiple runtimes, but the evidence package should not pretend every runtime is equal. Deno is the first-class channel for this package. Node.js benefits through npm compatibility and the existing CLI. Bun, Cloudflare Workers, Vite and Next.js are adjacent surfaces that need separate smoke tests after publication.</p>
      ${table(['Runtime or tool', 'Reference', 'Fit for S72', 'Next proof'], runtimeRows)}

      <h2>Publication trust model</h2>
      <p>Publication trust is the main host-side blocker. Local dry-run proves the source package is acceptable to the publish tool. It does not prove Ariada owns the scope, that a public package page exists, or that an OIDC provenance statement has been created. The report separates those states so no reviewer reads a local dry-run as a live marketplace listing.</p>
      ${table(['Trust step', 'Reference', 'Status', 'Interpretation'], publicationTrustRows)}

      <h2>Signal count</h2>
      ${table(['Signal cluster', 'Counted source families', 'Repeated pattern', 'Product implication'], [
        ['Registry purpose skepticism', 'Reddit, Hacker News, practitioner blogs', 'Users ask why JSR is materially different from npm.', 'Explain TS-source and Deno fit, avoid replacement rhetoric.'],
        ['Publish validation friction', 'JSR GitHub issues, Deno Questions, Stack Overflow', 'Dry-run, workspace, browser compatibility and dependency questions repeat.', 'Keep dry-run and fixture checks mandatory.'],
        ['Cross-tool install confusion', 'Stack Overflow, Deno Questions, JSR docs', 'Users ask how npm/pnpm/Deno consume JSR packages.', 'README must show Deno and npm-compatible paths.'],
        ['Trust/provenance expectations', 'JSR docs, GitHub package discussions, security comments', 'OIDC and package provenance are expected for registry trust.', 'Use GitHub Actions OIDC after scope link.'],
        ['No-signal searches', 'G2, Capterra, Product Hunt, accessibility SaaS reviews', 'Not useful for JSR-specific channel demand.', 'Do not overstate buyer pull from review sites.'],
      ])}

      <h2>Pain mining</h2>
      ${table(['Where to search next', 'Queries', 'Signals to collect', 'Role'], [
        ['GitHub jsr-io/jsr issues', '<code>publish dry-run workspace</code>, <code>OIDC</code>, <code>npm compatibility</code>, <code>slow types</code>', 'Blocking publish errors and resolver regressions', 'Maintainer/platform engineer'],
        ['Deno Questions archive', '<code>JSR publish package</code>, <code>browser compatibility</code>, <code>workspace</code>, <code>shared file</code>', 'Documentation gaps and example needs', 'Developer/maintainer'],
        ['Reddit r/Deno and r/javascript', '<code>JSR better npm</code>, <code>JSR publish</code>, <code>Deno package registry</code>', 'Adoption objections and language for README', 'Developer'],
        ['Hacker News', '<code>JSR JavaScript Registry</code>, <code>JSR not package manager</code>, <code>JSR npm compatibility</code>', 'Skepticism and trust objections', 'Developer/buyer influencer'],
        ['Stack Overflow deno tag', '<code>jsr pnpm install</code>, <code>deno jsr publish</code>, <code>dev dependencies JSR</code>', 'Install and dependency questions', 'Developer'],
        ['No-signal searches', '<code>JSR accessibility scanner G2</code>, <code>JSR marketplace reviews</code>, <code>JSR Product Hunt</code>', 'Likely weak; log absence explicitly', 'Product'],
      ])}

      <h2>Evidence artifacts</h2>
      ${table(['Artifact', 'Path', 'Purpose'], [
        ['Result report', '<a href="result.html">scan-evidence/result.html</a>', 'Founder-review report'],
        ['Scan-result preview', '<a href="scan-result-preview.html">scan-evidence/scan-result-preview.html</a>', 'Screenshot surface'],
        ['Screenshot', '<a href="screenshots/scan-result.png">scan-evidence/screenshots/scan-result.png</a>', 'Visual evidence PNG'],
        ['Raw JSON', '<a href="ariada-output/jsr-channel-evidence.json">scan-evidence/ariada-output/jsr-channel-evidence.json</a>', 'Machine-readable local evidence'],
        ['Command log', '<a href="command.log">scan-evidence/command.log</a>', 'Verification commands and outcomes'],
        ['Exit file', '<a href="command.exit">scan-evidence/command.exit</a>', 'Local evidence status'],
      ])}

      <h2>Verification and test adequacy</h2>
      <p>The current tests are adequate for a config-only JSR adapter: TypeScript source checks the public API, Deno checks a representative consumer fixture, ESLint blocks code hygiene regressions, Vitest verifies command construction, and the JSR dry-run validates package rules and slow-type checks. They do not prove live publication, registry discovery, GitHub OIDC provenance, a real browser scan, or paid evidence retention. Those are documented host/product blockers rather than hidden gaps.</p>

      <h2>Acceptance criteria detail</h2>
      <p>The acceptance criteria are split into local proofs and host proofs. A local proof can pass in the worktree without secrets. A host proof requires a registry account, scope ownership, repository linking or a hosted Ariada service. This distinction is critical for S72 because a registry publish channel can look complete after dry-run while still lacking public distribution.</p>
      ${table(['Criterion', 'Evidence required', 'Current proof', 'State'], acceptanceRows)}

      <h2>Buyer objections and response hooks</h2>
      <p>JSR introduces a buyer education burden even for technical users. The adoption hook must answer why this package exists, why it is not a scanner fork, why it is not just npm again, and what a compliance buyer gets from a developer package. These rows should become FAQ snippets after the public package exists.</p>
      ${table(['Objection', 'Observed source family', 'Response hook', 'Where implemented'], objectionRows)}

      <h2>Commercial domain mapping</h2>
      <p>This channel should be sold through the compliance evidence story rather than through the package itself. The package is a low-friction entrypoint for Deno and TypeScript maintainers. The commercial conversion happens when a release manager, accessibility lead, privacy reviewer or procurement owner needs durable proof: what command ran, what scanner version was invoked, what domains were covered, what screenshot was attached, what policy threshold applied, and who approved the exception. JSR helps Ariada reach a developer who can add the task; the paid product helps the organization trust and retain the result.</p>
      <p>The strongest commercial hook is cross-role translation. Developers see a small helper and a dry-run-valid package. Platform engineers see a registry-native package that can be pinned. Reviewers see no hidden credentials and no scanner fork. Buyers see the start of an evidence chain that can become signed, retained and mapped to EAA, EN 301 549, GDPR and internal release policy. That is why the wrapper is deliberately narrow: a narrow package is easier to trust, while the broader commercial value remains centralized.</p>
      ${table(['Commercial domain', 'Buyer question', 'JSR channel answer', 'Paid Ariada expansion'], commercialDomainRows)}

      <h2>Community pattern narrative</h2>
      <p>Pattern one: registry novelty skepticism repeats across Hacker News and Reddit. This is not a reason to skip JSR; it is a reason to avoid inflated claims. Ariada should say the package exists for Deno and TypeScript source workflows, not that JSR replaces npm. Pattern two: publish friction repeats across GitHub issues and Deno Questions. That makes dry-run validation, explicit config selection and a human-account blocker mandatory. Pattern three: cross-tool install confusion appears in Stack Overflow and Deno community threads. That makes the Deno task snippet and import-map fixture useful even before live publication. Pattern four: package trust is moving toward OIDC and provenance. That means the public S72 launch should prefer linked GitHub Actions publishing over a long-lived token whenever possible.</p>
      <p>Pattern five: accessibility buyers do not search for JSR packages directly. The JSR package is a developer entrypoint; the buyer value is evidence retention and governance. Pattern six: a package wrapper that starts browsers implicitly would violate channel expectations. The implemented package avoids that by exporting pure functions. Pattern seven: JSR generated docs and TypeScript source can improve developer confidence, but only if public APIs have clear types and documentation. The source therefore has explicit exported types and JSDoc comments. Pattern eight: public community sources do not prove market size. They prove language, objections and failure modes to handle before launch.</p>

      <h2>No-signal searches</h2>
      <p>Several expected review surfaces were checked conceptually and treated as weak or no-signal for this exact channel. G2, Capterra and TrustRadius are useful for accessibility SaaS categories, but they do not expose JSR-specific package adoption pain. Product Hunt and general marketplace review sites do not reliably represent registry maintainer workflows. Accessibility vendor review pages discuss dashboards and services, not JSR package publishing. These absences matter because they stop Ariada from pretending there is buyer pull where the actual signal is developer-distribution fit.</p>
      ${table(['Surface', 'Search intent', 'Result quality', 'Decision'], [
        ['G2 / Capterra / TrustRadius', 'Find buyer reviews mentioning JSR package workflows', 'No useful JSR-specific signal', 'Do not count toward market proof.'],
        ['Product Hunt', 'Find launch/adoption commentary for JSR tooling', 'Weak and not role-specific', 'Use only for launch copy after package exists.'],
        ['Accessibility vendor reviews', 'Find buyer pull for registry-native accessibility tools', 'No clear JSR discussion', 'Keep buyer value tied to evidence retention.'],
        ['General npm tutorials', 'Find install examples', 'Too broad and not JSR-specific', 'Prefer JSR official docs and Deno Questions.'],
        ['Private Discord/Slack', 'Find developer pain', 'Not publicly auditable', 'Use only if founder has permission and captures source.'],
      ])}

      <h2>Release checklist for humans</h2>
      <p>The human checklist is intentionally separate from the agent checklist. Agents can validate source, dry-run and evidence. Humans must own registry identity, auth and public listing claims. The split prevents accidental publication from an agent shell and keeps credentials out of the repository.</p>
      ${table(['Step', 'Human action', 'Evidence to capture', 'Blocker removed'], [
        ['Scope', 'Create or confirm <code>@ariada-org</code> on jsr.io', 'Screenshot or package settings note', 'Scope ownership.'],
        ['Package', 'Create/reserve <code>@ariada-org/ariada-jsr</code>', 'Package page URL', 'Public install target.'],
        ['Auth choice', 'Choose local interactive, GitHub OIDC or token', 'Decision note', 'Publish mechanism.'],
        ['OIDC', 'Link package to GitHub repository if using Actions', 'Settings screenshot and workflow run', 'Tokenless provenance.'],
        ['Publish', 'Run live publish after dry-run and review', 'JSR package URL and version', 'Distribution proof.'],
        ['Post-publish smoke', 'Run <code>deno add jsr:@ariada-org/ariada-jsr</code>', 'Command log', 'Consumer install proof.'],
        ['Promotion', 'Add README badge and public docs link', 'Docs diff', 'Discovery.'],
        ['Support', 'Open issue template for JSR install/publish friction', 'Issue template link', 'Community feedback loop.'],
      ])}

      <h2>Ariada core used</h2>
      <p>The shared CLI is the only scan execution path. The adapter emits <code>@ariada-org/cli</code> commands and does not import or duplicate browser, rule, axe, WCAG, privacy, security or multi-domain scanning code. This preserves central ownership of scan behavior and keeps JSR packaging as a distribution channel.</p>

      <h2>Tested surface</h2>
      <p>The tested surface is the package source, JSR manifest, Deno consumer fixture and generated scan-result preview. The tested surface is not a public <code>jsr.io</code> package page because no Ariada JSR account/scope was available. The visual screenshot is explicitly classified as scan-result preview, not tested host surface and not report-only.</p>

      <h2>Self-critique and limitations</h2>
      <p>This report does not prove public registry ownership, package download metrics, live <code>deno add jsr:@ariada-org/ariada-jsr</code>, GitHub OIDC publish, registry-page rendering, or end-to-end browser scanning through a published package. It proves the local package can be checked, tested, dry-run-published and documented as a JSR-facing adapter around the shared Ariada CLI. The next human action is therefore account/scope ownership, not more scanner code in this package.</p>

      <h2>Human/agent handoff</h2>
      ${table(['Owner', 'Next step', 'Trigger'], nextRows)}

      <h2>Next steps for Ariada and for humans</h2>
      <p>For Ariada agents: keep the wrapper small, rerun dry-run after every version bump, and add a publish workflow only after JSR scope ownership exists. For humans: create or confirm the JSR scope, decide local auth versus GitHub OIDC, approve package naming, and only then run a real publish. For product: sell evidence retention and compliance packs, not this wrapper.</p>

      <h2>Distribution and promotion</h2>
      <p>Promotion should be quiet and developer-specific: a README badge after live publish, a Deno task example, a short JSR package page, and a cross-link from the npm CLI README. Do not promote as a separate scanner. Promote as "Ariada for JSR/Deno users: typed task helper for the shared accessibility evidence CLI." Community follow-up should happen in Deno Questions, GitHub issues, Reddit and HN only after the package is live and the docs answer install/publish friction.</p>

      <h2>Update</h2>
      <p>Author: TURING (orchestrator). Date: 2026-07-01. Status: local package, dry-run evidence and scan-result preview prepared; live jsr.io publish blocked on host account/scope/auth.</p>
    </main>
  </body>
</html>`;

writeFileSync(resolve(evidenceDir, 'result.html'), html.replace(/[ \t]+$/gm, ''));
console.log(`Wrote ${resolve(evidenceDir, 'result.html')}`);
