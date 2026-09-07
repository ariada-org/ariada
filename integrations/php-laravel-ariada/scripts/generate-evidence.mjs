#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const integrationDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(integrationDir, '..', '..');
const evidenceDir = join(integrationDir, 'scan-evidence');
const outputDir = join(evidenceDir, 'ariada-output');
const fixturePath = join(integrationDir, 'fixtures', 'laravel-dashboard.html');
const screenshotPath = join(evidenceDir, 's98-laravel-scan.png');
const pagePath = join(evidenceDir, '_capture.html');
const resultPath = join(evidenceDir, 'result.html');
const testReportPath = join(integrationDir, 'test-report', 'result.html');

mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(testReportPath), { recursive: true });

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function link(url, label) {
  return `<a href="${escapeHtml(url)}">${escapeHtml(label ?? url)}</a>`;
}

function renderTable(headers, rows) {
  const head = headers.length > 0
    ? `<thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead>`
    : '';
  const body = rows.map((row) => `<tr>${row.map((cell, index) => {
    const tag = index === 0 ? 'th scope="row"' : 'td';
    return `<${tag}>${cell}</${index === 0 ? 'th' : 'td'}>`;
  }).join('')}</tr>`).join('\n');
  return `<table>${head}<tbody>${body}</tbody></table>`;
}

function renderList(items) {
  return `<ol>${items.map((item) => `<li>${item}</li>`).join('\n')}</ol>`;
}

function startFixtureServer() {
  const fixture = readFileSync(fixturePath);
  const server = createServer((req, res) => {
    if (req.url === '/chart.png') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fixture);
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveServer({ server, url: `http://127.0.0.1:${address.port}/dashboard` });
    });
  });
}

function run(command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: options.timeout ?? 120_000,
    ...options,
  });

  return {
    command: [command, ...args].join(' '),
    status: result.error ? 124 : (result.status ?? 1),
    stdout: result.stdout ?? '',
    stderr: `${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`.trim(),
    durationMs: Date.now() - startedAt,
  };
}

function renderCapturePage({ fixtureUrl, scanRun, structureRun, reportJson }) {
  const captureLabel = [0, 1].includes(scanRun.status) ? 'REAL SCAN CAPTURE' : 'SCAN BLOCKER CAPTURE';
  const captureDescription = [0, 1].includes(scanRun.status)
    ? 'Representative rendered Laravel Blade dashboard scanned by the shared @ariada-org/cli.'
    : 'Representative rendered Laravel Blade dashboard sent to the shared @ariada-org/cli; this capture records the exact blocker instead of faking a pass.';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Laravel Ariada scan evidence capture</title>
<style>
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; color: #17202a; background: #f7f9fb; }
  main { max-width: 1100px; margin: 0 auto; padding: 28px; }
  h1 { font-size: 1.7rem; margin: 0 0 8px; }
  h2 { font-size: 1.1rem; margin: 24px 0 8px; }
  .badge { display: inline-block; border: 2px solid #0b5f2a; color: #0b5f2a; background: #eaf7ef; border-radius: 6px; padding: 4px 10px; font-weight: 700; }
  .warn { border-color: #946200; color: #6f4a00; background: #fff4d6; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre { white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; overflow: auto; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { border-bottom: 1px solid #dbe2ea; padding: 8px 10px; text-align: left; vertical-align: top; }
</style>
</head>
<body>
<main>
  <h1>PHP Composer package + Laravel integration</h1>
  <p><span class="badge">${escapeHtml(captureLabel)}</span> ${escapeHtml(captureDescription)}</p>
  <table>
    <tbody>
      <tr><th scope="row">Fixture URL</th><td><code>${escapeHtml(fixtureUrl)}</code></td></tr>
      <tr><th scope="row">Structure check</th><td><code>${escapeHtml(structureRun.command)}</code> exit ${structureRun.status}</td></tr>
      <tr><th scope="row">Ariada scan</th><td><code>${escapeHtml(scanRun.command)}</code> exit ${scanRun.status}</td></tr>
      <tr><th scope="row">Finding count</th><td>${escapeHtml(reportJson?.summary?.total ?? 'see scan log')}</td></tr>
    </tbody>
  </table>
  <h2>Scan stdout</h2>
  <pre>${escapeHtml(scanRun.stdout || '(empty)')}</pre>
  <h2>Scan stderr</h2>
  <pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
  <h2>Machine report excerpt</h2>
  <pre>${escapeHtml(JSON.stringify(reportJson?.summary ?? reportJson ?? {}, null, 2))}</pre>
</main>
</body>
</html>`;
}

function renderResult({ fixtureUrl, scanRun, structureRun, reportJson, screenshotDataUrl }) {
  const ok = structureRun.status === 0 && [0, 1].includes(scanRun.status) && screenshotDataUrl;
  const blocker = !ok
    ? 'PHP and Composer are not available in this environment, and the local shared CLI scan hit the evidence-generator timeout. The package code is present with mocked PHPUnit/Testbench tests, structure validation passes, and this report preserves the exact blocked command, stderr, and screenshot evidence instead of pretending the live host passed.'
    : 'Packagist publication remains a founder-owned human gate: Packagist account, repository submit, and release tag.';
  const screenshotLink = './s98-laravel-scan.png';
  const scanStatus = [0, 1].includes(scanRun.status) ? 'real shared CLI scan completed' : 'scan command blocked or timed out';
  const findingCount = reportJson?.summary?.total ?? 'not available because scan did not produce scan.json';
  const officialSources = [
    ['Laravel package development', 'https://laravel.com/docs/13.x/packages', 'High / primary', 'Defines the service-provider and package-resource model that this adapter follows. The report treats Laravel auto-discovery and provider registration as the idiomatic integration path rather than a custom bootstrap step.'],
    ['Laravel Artisan console', 'https://laravel.com/docs/13.x/artisan', 'High / primary', 'Supports the choice of an explicit `php artisan ariada:scan` command as the local and CI entrypoint. The report does not ask developers to run a hidden scan on every request or every test.'],
    ['Laravel service providers', 'https://laravel.com/docs/13.x/providers', 'High / primary', 'Anchors the provider registration claim and the current `AriadaServiceProvider` implementation. This is the correct hook for commands and configuration in Laravel packages.'],
    ['Laravel testing documentation', 'https://laravel.com/docs/13.x/testing', 'High / primary', 'Used for the PHP host-gate expectation: real Laravel package acceptance still needs PHP-enabled tests, not only Node-side structure checks.'],
    ['Laravel configuration documentation', 'https://laravel.com/docs/13.x/configuration', 'High / primary', 'Used for the `ARIADA_*` environment configuration approach and the publishable config file.'],
    ['Laravel validation documentation', 'https://laravel.com/docs/13.x/validation', 'High / primary', 'Relevant to Laravel product owners because many release-blocking pages are forms, checkouts, intake flows, and account settings.'],
    ['Laravel deployment documentation', 'https://laravel.com/docs/13.x/deployment', 'High / primary', 'Supports the report position that release gates belong in CI/release workflows after dependencies and optimized config are present.'],
    ['Composer introduction', 'https://getcomposer.org/doc/00-intro.md', 'High / primary', 'Anchors Composer as the PHP dependency manager and package install path. Ariada should meet developers where Composer already is.'],
    ['Composer CLI documentation', 'https://getcomposer.org/doc/03-cli.md', 'High / primary', 'Supports the expected host gates `composer validate`, `composer install`, and package script execution on a PHP host.'],
    ['Composer schema documentation', 'https://getcomposer.org/doc/04-schema.md', 'High / primary', 'Used for claims about package metadata, PSR-4 autoloading, scripts, config, and the Laravel `extra` block.'],
    ['Composer repositories documentation', 'https://getcomposer.org/doc/05-repositories.md', 'High / primary', 'Used for the private-package and Packagist/public-package split in monetization and publishing sections.'],
    ['Composer scripts documentation', 'https://getcomposer.org/doc/articles/scripts.md', 'High / primary', 'Relevant to why Ariada avoids surprising Composer hook scans and instead exposes an explicit Artisan command.'],
    ['Composer version constraints', 'https://getcomposer.org/doc/articles/versions.md', 'High / primary', 'Used for package publishing and release-tag expectations before Packagist submission.'],
    ['Packagist about', 'https://packagist.org/about', 'High / primary', 'Defines Packagist as the default Composer package repository. The report marks Packagist submission as a human-controlled blocker, not as agent-complete.'],
    ['Packagist publish flow', 'https://packagist.org/?query=laravel', 'Medium / primary surface', 'Supports the practical publishing gate: validate composer.json, commit repository code, then submit the public repository URL to Packagist.'],
    ['Laravel framework on Packagist', 'https://packagist.org/packages/laravel/framework', 'High / primary ecosystem', 'Shows the package ecosystem surface where Laravel teams already pull framework dependencies.'],
    ['Laravel Pint on Packagist', 'https://packagist.org/packages/laravel/pint', 'High / primary ecosystem', 'Used for PHP code-style gate expectations. Pint is a familiar Laravel-side gate and should remain separate from browser evidence.'],
    ['PHPUnit package on Packagist', 'https://packagist.org/packages/phpunit/phpunit', 'High / primary ecosystem', 'Used for unit-test and feature-test gate expectations. PHPUnit proves PHP behavior; it does not prove rendered accessibility by itself.'],
    ['Orchestra Testbench on Packagist', 'https://packagist.org/packages/orchestra/testbench', 'High / primary ecosystem', 'Supports the current package-test strategy for Laravel package code outside a full application.'],
    ['Pest package on Packagist', 'https://packagist.org/packages/pestphp/pest', 'High / primary ecosystem', 'Used because Laravel teams increasingly discuss Pest as an alternative runner; Ariada should work regardless of PHPUnit or Pest preference.'],
    ['Pest continuous integration', 'https://pestphp.com/docs/continuous-integration', 'High / primary', 'Supports CI examples and the idea that PHP projects expect framework-native tests in their CI workflows.'],
    ['Pest Laravel plugin', 'https://pestphp.com/docs/plugins/laravel', 'High / primary', 'Relevant to Laravel test culture and to future examples that can show Pest and PHPUnit variants.'],
    ['PHPUnit installation', 'https://docs.phpunit.de/en/12.0/installation.html', 'High / primary', 'Supports the PHP host-gate requirement and the blocker that this machine did not run PHPUnit.'],
    ['PHPUnit test doubles', 'https://docs.phpunit.de/en/12.0/test-doubles.html', 'High / primary', 'Relevant because the current tests mock command execution rather than executing the browser scanner on a PHP host.'],
    ['GitHub Actions PHP setup', 'https://github.com/shivammathur/setup-php', 'High / primary ecosystem', 'Used for the recommended CI fallback path: cached PHP, Composer, extensions, and test tools before an Ariada scan step.'],
    ['GitHub Actions artifacts', 'https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts', 'High / primary', 'Supports the evidence-artifact model: raw JSON, command log, screenshot, and HTML report should be uploaded as CI artifacts.'],
    ['GitHub Actions workflow syntax', 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions', 'High / primary', 'Used for CI packaging decisions and release-gate placement.'],
    ['GitLab CI YAML', 'https://docs.gitlab.com/ci/yaml/', 'High / primary', 'Supports the fallback path for teams that do not use GitHub Actions.'],
    ['Docker Hub PHP image', 'https://hub.docker.com/_/php', 'High / primary ecosystem', 'Relevant to a future Dockerized evidence runner that hides PHP/browser/Node setup from application developers.'],
    ['Laravel Forge', 'https://forge.laravel.com/', 'Medium / vendor primary', 'Relevant to Laravel deployment culture and the product-owner pathway: many teams already distinguish app deployment from local dev loops.'],
    ['Laravel Envoyer', 'https://envoyer.io/', 'Medium / vendor primary', 'Relevant to release-owner language and why Ariada evidence should be a release artifact, not a request-time concern.'],
    ['Laravel Vapor', 'https://vapor.laravel.com/', 'Medium / vendor primary', 'Relevant to hosted Laravel teams and future evidence retention rather than local-only artifacts.'],
    ['Laracasts', 'https://laracasts.com/', 'Medium / community platform', 'Used as a Laravel education/community surface for pain mining. It is not treated as a market fact by itself.'],
    ['Laravel News', 'https://laravel-news.com/', 'Medium / community publication', 'Used for ecosystem and adoption language around Laravel/PHP package culture.'],
    ['Laravel Daily', 'https://laraveldaily.com/', 'Medium / community publication', 'Used as a channel-specific surface where developers learn package/test/CI patterns.'],
    ['PHP The Right Way', 'https://phptherightway.com/', 'Medium / community docs', 'Used as broad PHP packaging/testing context; lower weight than official Composer and Laravel docs.'],
    ['PSR-4 autoloading spec', 'https://www.php-fig.org/psr/psr-4/', 'High / primary standard', 'Supports the adapter package namespace and Composer autoloading expectations.'],
    ['WCAG 2.2', 'https://www.w3.org/TR/WCAG22/', 'High / primary standard', 'Anchors the accessibility compliance domain. Ariada evidence still needs human review beyond automated results.'],
    ['EN 301 549', 'https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'High / primary standard', 'Relevant to EU public-sector and EAA-adjacent procurement evidence.'],
    ['European Accessibility Act overview', 'https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', 'High / primary policy', 'Supports why product owners and compliance reviewers need defensible evidence artifacts rather than developer-only logs.'],
    ['Laravel Dusk documentation', 'https://laravel.com/docs/13.x/dusk', 'High / primary', 'Relevant because Laravel teams already understand browser-oriented checks as an explicit test layer. Ariada should borrow that placement discipline while staying focused on evidence artifacts rather than end-to-end assertions.'],
    ['Laravel queues documentation', 'https://laravel.com/docs/13.x/queues', 'High / primary', 'Relevant to release operations because many Laravel apps depend on async work. Ariada should avoid running scans inside queue jobs; evidence belongs in release gates or scheduled/nightly scans.'],
    ['Laravel scheduler documentation', 'https://laravel.com/docs/13.x/scheduling', 'High / primary', 'Relevant to future nightly scan workflows for teams that want recurring evidence without blocking every developer push.'],
    ['Laravel HTTP client documentation', 'https://laravel.com/docs/13.x/http-client', 'High / primary', 'Relevant to a future hosted upload client if the package posts evidence bundles to Ariada retention services. Not implemented in this branch.'],
    ['Laravel filesystem documentation', 'https://laravel.com/docs/13.x/filesystem', 'High / primary', 'Relevant to future artifact storage choices when teams keep local reports, S3 evidence, or CI-uploaded bundles.'],
    ['Laravel Vite documentation', 'https://laravel.com/docs/13.x/vite', 'High / primary', 'Relevant because many Laravel apps already run Node in the frontend build path. The report still keeps Ariada browser scanning explicit rather than hiding it in asset builds.'],
    ['Laravel Sail documentation', 'https://laravel.com/docs/13.x/sail', 'High / primary', 'Relevant to Dockerized local environments and a possible future “serve then scan” example for teams already using containers.'],
    ['PHP supported versions', 'https://www.php.net/supported-versions.php', 'High / primary', 'Relevant to package support policy and the PHP >=8.1 constraint. Publication should document supported runtimes rather than relying on implicit local state.'],
    ['PHP Composer install guide', 'https://getcomposer.org/download/', 'High / primary', 'Relevant to host-gate blockers because Composer was absent in this shell. The next runner must install/use Composer explicitly.'],
    ['Symfony Process component', 'https://symfony.com/doc/current/components/process.html', 'High / primary ecosystem', 'Relevant to a future PHP-native process runner alternative. Current implementation uses PHP process execution through the package wrapper; any dependency choice should remain small.'],
    ['PHPStan', 'https://phpstan.org/', 'Medium / vendor primary', 'Relevant to PHP QA culture. Static analysis is complementary to Ariada rendered evidence and should not be presented as a substitute.'],
    ['Psalm', 'https://psalm.dev/', 'Medium / vendor primary', 'Relevant to PHP QA culture and commercial/static-analysis comparisons. It strengthens the distinction between code correctness and rendered compliance evidence.'],
    ['PHP_CodeSniffer', 'https://github.com/PHPCSStandards/PHP_CodeSniffer/', 'Medium / project primary', 'Relevant to PHP style/lint culture. Ariada should coexist with existing PHP gates rather than collapse all checks into one command.'],
    ['OWASP ZAP', 'https://www.zaproxy.org/', 'Medium / project primary', 'Relevant to security-domain expansion. It is a strong security scanner comparator but not a Laravel/Artisan evidence package.'],
    ['Mozilla Observatory', 'https://observatory.mozilla.org/', 'Medium / project primary', 'Relevant to browser-surface security evidence and future header/CSP domain comparisons.'],
    ['SecurityHeaders', 'https://securityheaders.com/', 'Medium / project primary', 'Relevant to future header/CSP evidence for Laravel public pages.'],
    ['Playwright documentation', 'https://playwright.dev/docs/intro', 'High / primary', 'Relevant because the generator uses a browser capture. Browser runtime setup should be cached or hosted for Laravel teams.'],
    ['Chrome for Testing', 'https://developer.chrome.com/blog/chrome-for-testing/', 'High / primary', 'Relevant to reproducible browser evidence and why CI/Docker packaging matters for visual scan artifacts.'],
    ['GitLab job artifacts', 'https://docs.gitlab.com/ci/jobs/job_artifacts/', 'High / primary', 'Relevant to the GitLab fallback path for preserving report HTML, JSON, logs, and screenshots.'],
    ['GitHub Checks API', 'https://docs.github.com/en/rest/checks', 'High / primary', 'Relevant to future PR annotations or check-run summaries built from Ariada evidence. Not implemented in this branch.'],
  ];
  const competitorSources = [
    ['axe-core', 'https://github.com/dequelabs/axe-core', 'Automated accessibility engine; strong rule ecosystem, but not Laravel-specific evidence packaging.'],
    ['axe DevTools', 'https://www.deque.com/axe/devtools/', 'Commercial accessibility workflow; strong enterprise offering, not a Composer/Artisan-native release packet.'],
    ['Pa11y', 'https://github.com/pa11y/pa11y', 'CLI accessibility scanner; close technical neighbor for browser checks and CI usage.'],
    ['pa11y-ci', 'https://github.com/pa11y/pa11y-ci', 'CI accessibility runner; relevant to the release-gate culture Ariada should fit.'],
    ['Lighthouse CI', 'https://github.com/GoogleChrome/lighthouse-ci', 'Performance/accessibility CI comparator; strong web tooling, not PHP package specific.'],
    ['Accessibility Insights', 'https://accessibilityinsights.io/', 'Manual and automated accessibility testing suite; useful comparator for reviewer workflow.'],
    ['WAVE', 'https://wave.webaim.org/', 'Common web accessibility checker; useful for reviewer expectations and visual issue review.'],
    ['Siteimprove accessibility', 'https://www.siteimprove.com/toolkit/accessibility/', 'Enterprise suite; paid dashboard-first model that Ariada should not copy for the free adapter.'],
    ['Level Access', 'https://www.levelaccess.com/', 'Enterprise accessibility vendor; comparator for managed compliance service language.'],
    ['Evinced', 'https://www.evinced.com/', 'Accessibility testing platform; comparator for CI and developer integration messaging.'],
    ['AudioEye', 'https://www.audioeye.com/', 'Managed accessibility/compliance vendor; comparator for commercial ownership and service-led selling.'],
    ['Equalize Digital Accessibility Checker', 'https://equalizedigital.com/accessibility-checker/', 'CMS/plugin model comparator; useful for understanding marketplace-native accessibility packaging.'],
    ['jk-oster pa11y-php', 'https://github.com/jk-oster/pa11y-php', 'PHP wrapper comparator; shows that PHP accessibility wrapper packages exist, but Ariada needs richer evidence artifacts.'],
    ['CivicActions pa11y CI article', 'https://accessibility.civicactions.com/posts/automated-accessibility-testing-leveraging-github-actions-and-pa11y-ci-with-axe', 'Secondary source showing open-source CI accessibility practice and the limits of automated checks.'],
    ['Abstracta axe and pa11y comparison', 'https://abstracta.us/blog/accessibility-testing/automated-accessibility-testing-comparing-axe-wdio-and-pa11y-ci/', 'Secondary comparison for scanner positioning; not a Laravel-specific source.'],
  ];
  const communitySources = [
    ['Reddit Laravel CI/CD thread', 'https://www.reddit.com/r/laravel/comments/k5gp7k/whats_your_current_cicd_pipeline/', 'Developer and platform-owner discussion about Laravel CI shapes. Signal: Laravel teams expect tests, database setup, and deployment steps in CI; Ariada should be a clear release step, not a hidden Composer side effect.'],
    ['Stack Overflow Composer production install', 'https://stackoverflow.com/questions/37871804/php-composer-install-or-not-for-production-environments', 'Developer operations pain around Composer install and production deploys. Signal: package workflows touch deployment reliability, so Ariada must keep install lightweight and scans explicit.'],
    ['Stack Overflow Laravel GitHub Actions tests', 'https://stackoverflow.com/questions/77205037/github-action-with-laravel-to-run-test-cases-before-merge-or-during-pull-request', 'CI pain around Laravel test workflow layout. Signal: examples must include working paths, not just a package command.'],
    ['Stack Overflow package Artisan command', 'https://stackoverflow.com/questions/28492394/laravel-5-creating-artisan-command-for-packages', 'Package-author pain around registering commands. Signal: service-provider command registration is a channel-specific requirement.'],
    ['Laravel framework auto-discovery cache issue', 'https://github.com/laravel/framework/issues/21626', 'Maintainer/developer issue showing package discovery can become a cache/debugging pain. Signal: Ariada should document provider discovery and manual provider registration fallback.'],
    ['Laravel framework composer no-scripts issue', 'https://github.com/laravel/framework/issues/24383', 'Deploy pain where Composer flags affect Artisan/package discovery. Signal: avoid placing required scanner setup behind Composer scripts that deployment teams may disable.'],
    ['Laravel framework PHPUnit/container issue', 'https://github.com/laravel/framework/issues/28809', 'Laravel/PHPUnit runtime pain after package changes. Signal: package tests must cover container wiring, not only command construction.'],
    ['Pest issue: arguments against default', 'https://github.com/pestphp/pest/issues/149', 'Community objections around Pest versus PHPUnit. Signal: Ariada examples should support both PHPUnit-first and Pest-first teams.'],
    ['Laracasts Pest failing in GitHub Actions', 'https://laracasts.com/discuss/channels/testing/pest-php-session-validation-test-failing-at-github-actions-but-works-locally', 'Testing-channel pain around local/CI divergence. Signal: evidence reports must preserve exact host command and stderr when CI differs.'],
    ['Laracasts service providers in development config', 'https://laracasts.com/discuss/channels/general-discussion/how-to-add-serviceproviders-and-facades-to-only-development-configuration', 'Discussion around provider/config scope. Signal: Ariada should separate dev convenience from release evidence.'],
    ['Laravel News Packagist ecosystem', 'https://laravel-news.com/packagist-and-the-php-ecosystem', 'Community publication explaining Packagist/Composer ecosystem. Signal: Packagist visibility matters, but package publication is only the free adoption layer.'],
    ['Freek.dev parallel Laravel tests', 'https://freek.dev/2843-running-php-tests-in-parallel-on-github-actions', 'Community practitioner article about PHPUnit/Pest parallel tests in GitHub Actions. Signal: Laravel teams optimize test speed; browser scans should be cached and explicit.'],
    ['Laracasts Pest review', 'https://laracasts.com/series/jeffreys-larabits/episodes/30', 'Education/community source on Pest ergonomics. Signal: testing culture values concise syntax, but Ariada should not force a runner migration.'],
    ['Dev.to Pest Laravel switch story', 'https://dev.to/oliverquynh/i-finally-tried-pest-for-php-laravel-then-made-the-switch-3anf', 'Anecdotal adoption signal for Pest. Signal is weak alone, useful only with Pest docs and issue discussions.'],
    ['GitHub Laravel framework releases', 'https://github.com/laravel/framework/releases', 'Maintainer release surface. Signal: Laravel version churn means package constraints and Testbench support must be explicit.'],
    ['GitHub Laravel framework changelog', 'https://github.com/laravel/framework/blob/13.x/CHANGELOG.md', 'Maintainer changelog surface. Signal: compatibility claims must be tied to actual supported Illuminate ranges.'],
    ['GitHub pa11y WCAG issue', 'https://github.com/pa11y/pa11y/issues/425', 'Accessibility-tool maintainer discussion. Signal: standards coverage is a live concern; reports must state what automated scans do and do not prove.'],
    ['GitHub pa11y PHP wrapper', 'https://github.com/jk-oster/pa11y-php', 'Adjacent PHP wrapper source. Signal: plain PHP wrappers exist, so Ariada should compete on repeatable evidence and domain expansion.'],
  ];
  const painQueries = [
    ['Laravel Composer package auto discovery cache', 'https://www.google.com/search?q=Laravel+Composer+package+auto+discovery+cache'],
    ['Laravel artisan command package service provider', 'https://www.google.com/search?q=Laravel+artisan+command+package+service+provider'],
    ['Laravel PHPUnit GitHub Actions fails locally passes', 'https://www.google.com/search?q=Laravel+PHPUnit+GitHub+Actions+fails+locally+passes'],
    ['Pest Laravel GitHub Actions session failing', 'https://www.google.com/search?q=Pest+Laravel+GitHub+Actions+session+failing'],
    ['Composer install no scripts Laravel package discovery', 'https://www.google.com/search?q=Composer+install+no-scripts+Laravel+package+discovery'],
    ['Laravel accessibility WCAG testing CI package', 'https://www.google.com/search?q=Laravel+accessibility+WCAG+testing+CI+package'],
    ['PHP accessibility scanner Composer package pa11y', 'https://www.google.com/search?q=PHP+accessibility+scanner+Composer+package+pa11y'],
    ['Laravel product owner accessibility compliance release evidence', 'https://www.google.com/search?q=Laravel+product+owner+accessibility+compliance+release+evidence'],
    ['Laravel agency WCAG accessibility audit package CI', 'https://www.google.com/search?q=Laravel+agency+WCAG+accessibility+audit+package+CI'],
    ['Packagist accessibility Laravel package', 'https://www.google.com/search?q=Packagist+accessibility+Laravel+package'],
    ['Laravel Pint PHPUnit Pest CI package testing', 'https://www.google.com/search?q=Laravel+Pint+PHPUnit+Pest+CI+package+testing'],
    ['Laravel GitLab CI PHPUnit Pest Composer', 'https://www.google.com/search?q=Laravel+GitLab+CI+PHPUnit+Pest+Composer'],
    ['Laravel Docker CI browser testing accessibility', 'https://www.google.com/search?q=Laravel+Docker+CI+browser+testing+accessibility'],
    ['Laravel Dusk accessibility testing axe pa11y', 'https://www.google.com/search?q=Laravel+Dusk+accessibility+testing+axe+pa11y'],
    ['Laravel Blade WCAG accessibility automated testing', 'https://www.google.com/search?q=Laravel+Blade+WCAG+accessibility+automated+testing'],
    ['Laravel public sector accessibility compliance EAA', 'https://www.google.com/search?q=Laravel+public+sector+accessibility+compliance+EAA'],
    ['Composer package publish Packagist release tag namespace', 'https://www.google.com/search?q=Composer+package+publish+Packagist+release+tag+namespace'],
    ['Laravel package Testbench provider command tests', 'https://www.google.com/search?q=Laravel+package+Testbench+provider+command+tests'],
    ['PHPUnit Pest migration Laravel objections', 'https://www.google.com/search?q=PHPUnit+Pest+migration+Laravel+objections'],
    ['Laravel CI artifact upload screenshot report', 'https://www.google.com/search?q=Laravel+CI+artifact+upload+screenshot+report'],
  ];
  const sourceRows = officialSources.map(([name, url, reliability, use]) => [link(url, name), reliability, use]);
  const competitorRows = competitorSources.map(([name, url, use]) => [link(url, name), 'Secondary comparator unless vendor primary', use]);
  const communityRows = communitySources.map(([name, url, signal]) => [link(url, name), 'Untrusted community/review source', signal]);
  const painRows = painQueries.map(([query, url]) => [link(url, query), 'Use for pain mining; do not treat search result counts as market facts.', 'Collect repeated objections across Laravel, Composer, CI, accessibility, Packagist, and PHP testing surfaces before product decisions.']);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PHP/Laravel Ariada evidence</title>
<style>
  body { margin: 0; font: 16px/1.55 system-ui, sans-serif; color: #15181d; background: #fafbfc; }
  a { color: #075da8; }
  header, main, footer { max-width: 1120px; margin: 0 auto; padding: 0 22px; }
  header { padding-top: 30px; }
  h1 { font-size: 1.9rem; margin: 0 0 6px; }
  h2 { font-size: 1.25rem; margin: 28px 0 10px; border-bottom: 1px solid #d8dee6; padding-bottom: 6px; }
  h3 { font-size: 1rem; margin: 20px 0 6px; }
  p { max-width: 78ch; }
  .badge { display: inline-block; border-radius: 7px; padding: 5px 11px; font-weight: 700; border: 2px solid; }
  .ok { color: #0b6b2f; border-color: #0b6b2f; background: #e8f7ed; }
  .warn { color: #7a5200; border-color: #a36b00; background: #fff5d8; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .panel { border: 1px solid #d8dee6; border-radius: 8px; padding: 14px; background: #fff; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #e0e5eb; padding: 8px 10px; text-align: left; vertical-align: top; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  code { background: #eef2f6; padding: 1px 5px; border-radius: 4px; }
  pre { white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 14px; border-radius: 8px; overflow: auto; max-height: 420px; }
  figure { margin: 0; border: 1px solid #d8dee6; border-radius: 8px; overflow: hidden; background: #fff; }
  img { display: block; width: 100%; height: auto; }
  figcaption { padding: 10px 14px; }
  footer { color: #5b6470; margin: 36px auto; }
</style>
</head>
<body>
<header>
  <h1>PHP Composer package + Laravel integration channel evidence</h1>
  <p><span class="badge ${ok ? 'ok' : 'warn'}">${ok ? 'REVIEW READY' : 'HOST BLOCKED / SCAN TIMEOUT'}</span></p>
</header>
<main>
  <h2>What this channel is and why it is separate</h2>
  <p><strong>PHP Composer + Laravel</strong> is the channel for teams that already deliver server-rendered Laravel applications and need repeatable web evidence in their existing release path. Composer is the install path, Packagist is the public package index, Laravel package auto-discovery is the framework adoption path, and Artisan is the command surface developers already expect for local and CI operations.</p>
  <p>This channel is separate from Node, Python, and browser-extension channels because the buyer/user context is different. A Laravel agency, SaaS product owner, public-sector contractor, or internal-platform team is not shopping for a new scanner runtime first; they need a Composer package that can live beside Pint, PHPUnit, Pest, Testbench, and deployment automation. The narrow Ariada wedge is evidence production for an existing Laravel app: raw JSON, command log, screenshot, stable HTML report, and a clear human blocker state.</p>
  ${renderTable(['Channel part', 'Laravel/PHP meaning', 'Ariada position'], [
    ['Package manager', 'Composer installs PHP libraries and resolves Illuminate/Testbench/Pint/PHPUnit constraints.', 'Ariada ships the thin adapter as <code>ariada/laravel-accessibility</code>; the heavy scanner remains outside PHP.'],
    ['Package index', 'Packagist is where a public Composer package becomes discoverable.', 'Packagist submission stays a founder/human gate because account, namespace, tag, and repository publication are external state.'],
    ['Framework hook', 'Laravel discovers package service providers through Composer metadata and binds commands/config in the app container.', 'The adapter uses <code>AriadaServiceProvider</code> and publishable config rather than a manual bootstrap file.'],
    ['Workflow hook', 'Artisan commands are familiar for local maintenance, CI, queue/schedule operations, and deploy checks.', 'The scan belongs behind explicit <code>php artisan ariada:scan</code>, not hidden inside every page request or Composer install.'],
    ['Evidence market', 'The practical market is not “all Laravel tools”; it is release/compliance evidence for rendered Laravel pages.', 'Ariada should sell retention, baselines, signed exports, team dashboards, and domain packs, not the wrapper itself.'],
  ])}

  <h2>Channel culture fit: Laravel/PHP ecosystem fit</h2>
  <p>Laravel developers accept Composer packages, service providers, publishable configuration, Artisan commands, PHPUnit/Pest tests, Pint formatting, and CI snippets. They tolerate Node when it is clearly a frontend build dependency or a browser-test dependency, but a Node/browser scanner is foreign if it appears in the hot PHP unit-test loop or blocks Composer install. Browser automation belongs in an explicit scan command, CI release gate, nightly run, procurement packet, or hosted worker.</p>
  ${renderTable(['Audience expectation', 'Accepted in fast local/dev loop', 'Accepted in CI/release/nightly', 'Rejected or risky', 'Product decision'], [
    ['Composer install', 'Small PHP package, PSR-4 autoloading, no hidden browser download.', 'Composer install with cache and lockfile in CI.', 'Long browser scans or Node setup as Composer post-install side effects.', 'Keep adapter thin and avoid surprising Composer scripts.'],
    ['Artisan command', 'Explicit command with URL/default base URL and readable exit code.', 'Release gate after app server is available and env is configured.', 'Implicit scan on every test, request, queue job, or migration.', 'Primary local/CI entrypoint is <code>php artisan ariada:scan</code>.'],
    ['PHP tests', 'PHPUnit/Pest unit and feature tests for command wiring and config.', 'Testbench package tests across Laravel versions.', 'Claiming rendered accessibility from PHP mocks alone.', 'Keep PHP tests for adapter behavior; separate browser evidence.'],
    ['Browser runtime', 'Only explicit local command when developer asks for it.', 'Cached Playwright/Chrome in CI, Docker image, or hosted worker.', 'Forcing every Laravel contributor to debug Node browsers before they can run PHP tests.', 'Move heavy runtime into reusable Action/Docker/hosted runner.'],
    ['Evidence artifacts', 'Local HTML report for review before PR.', 'Uploaded JSON/log/screenshot/report artifacts in CI.', 'Slack screenshots without raw output or replayable command.', 'Ariada report must keep raw command and blocker state.'],
  ])}

  <h2>Recommended product solution for Laravel audience</h2>
  <p>The first product should be a free Composer/Laravel adapter that delegates to the shared Ariada CLI and writes predictable artifacts. The adapter should not become a PHP scanner fork. The next product should hide/cache heavy dependencies in a reusable CI Action, Docker image, and hosted worker, because that is where Laravel teams are willing to pay for reliability and audit retention.</p>
  ${renderTable(['Decision', 'Recommended path', 'Why it fits Laravel/PHP culture', 'State'], [
    ['Primary entrypoint', '<code>composer require ariada/laravel-accessibility</code> plus <code>php artisan ariada:scan</code>.', 'Composer and Artisan are native surfaces for Laravel teams.', '<span class="status warn">adapter implemented, Packagist blocked</span>'],
    ['Fallback entrypoint', 'GitHub Action/GitLab CI template that runs PHP setup, Composer install, app serve, Ariada scan, and artifact upload.', 'CI owners already manage PHP, DB, queues, assets, and browser tests there.', '<span class="status block">not yet implemented</span>'],
    ['Heavy runtime handling', 'Official Docker image or hosted worker with Node/Playwright/browser cache and Ariada CLI preinstalled.', 'Avoids making every PHP developer own browser-runtime setup.', '<span class="status block">future paid/hosted path</span>'],
    ['Free/open-source layer', 'Package, config, command, JSON/log/report generation, CI examples.', 'Low-friction adoption and public trust for agencies and SME teams.', '<span class="status warn">partial</span>'],
    ['Paid layer', 'Hosted retention, baselines, signed exports, team dashboards, policy thresholds, domain packs, procurement packets.', 'Economic buyers pay for audit trail and repeatability, not the wrapper.', '<span class="status block">commercial layer not implemented</span>'],
    ['Future native path', 'Optionally add Symfony/plain-PHP adapters reusing the framework-neutral scanner wrapper.', 'Composer ecosystem spans Laravel and non-Laravel PHP estates.', '<span class="status warn">wrapper prepared, packages not split</span>'],
  ])}

  <h2>Кому что продаем: роли, hooks, кто платит и что уже готово</h2>
  ${renderTable(['Role / exact title', 'Pain and buying moment', 'Ariada hook', 'Who pays', 'What is ready now', 'Blocker or next version'], [
    ['Laravel application developer', 'Needs a command that fits the app repo and does not require replacing Laravel, Blade, PHPUnit, Pest, Pint, or existing CI. Buying moment is usually a rejected PR, release freeze, or accessibility review ask.', '<code>php artisan ariada:scan</code> with config defaults and URL override.', 'Usually not the economic buyer; creates adoption and internal proof.', 'Service provider, command class, scanner wrapper, config, fixture, structure validator, generated evidence report.', 'Needs PHP/Composer host run and published package.'],
    ['Laravel product owner / SaaS product manager', 'Needs proof that a release-facing dashboard, signup flow, checkout, account settings page, or public portal can pass review without delaying a sprint.', 'HTML report with screenshot, raw log, finding count, blocker state, and domain roadmap.', 'Often pays via product or delivery budget when release risk is visible.', 'Report explains code-ready versus host-blocked state and provides reviewer artifact.', 'Needs hosted retention and trend view before it becomes a management dashboard.'],
    ['Agency delivery lead / client account owner', 'Needs evidence packet attached to client handoff and procurement review. Buying moment is contract acceptance, public-sector delivery, or EAA/WCAG acceptance criteria.', 'Per-project evidence packet with screenshot, command, raw JSON, and human caveats.', 'Agency or client project budget.', 'Local report and screenshot artifact exist.', 'Needs repeatable CI recipe and client-branded exports.'],
    ['CI / platform owner', 'Needs repeatable release gate with stable exit codes, artifact upload, caches, and no surprise browser setup in the PHP unit loop.', 'GitHub/GitLab snippet around Composer, app serve, Ariada CLI, and artifact upload.', 'Engineering platform/tooling budget.', 'Exit code and artifact pattern are described; command wrapper exists.', 'CI templates, Docker image, and browser cache path are missing.'],
    ['Accessibility reviewer / compliance specialist', 'Needs machine-readable evidence plus human-readable proof, not only a screenshot or developer assertion.', 'HTML report, raw JSON, command log, screenshot, standards/domain mapping, exact blocker language.', 'Can influence purchase; may buy in audit/consulting firms.', 'Report includes screenshot and blocked scan command/stderr.', 'Needs successful live scan and richer rule mapping before review-ready claim.'],
    ['DPO / legal operations / procurement owner', 'Needs audit trail, policy thresholds, retention, signed exports, and domain expansion beyond accessibility when Laravel app handles user data.', 'Hosted retention, signed exports, jurisdiction/domain packs, team dashboard.', 'Compliance/legal/procurement budget.', 'Commercial story is mapped.', 'Hosted platform and signed export are not implemented.'],
  ])}

  <h2>Role depth: user, buyer, reviewer, maintainer</h2>
  ${renderTable(['Category', 'Exact Laravel/PHP persona', 'What they already trust', 'What they will challenge', 'Report implication'], [
    ['User', 'Backend Laravel developer maintaining Blade pages and controllers.', 'Composer, Artisan, PHP env, PHPUnit/Pest, app URL in local/CI.', 'Node/browser runtime, false positives, slow feedback.', 'Keep command explicit and explain timeout/blocker honestly.'],
    ['Buyer', 'Product owner for a Laravel SaaS, agency delivery lead, public-sector service owner.', 'Release evidence, client acceptance packs, CI status, managed artifacts.', 'Developer-only output without audit trail.', 'Monetization targets retention and signed exports.'],
    ['Reviewer', 'Accessibility specialist, QA lead, procurement reviewer.', 'Raw JSON, screenshot, replayable command, standards mapping.', 'Claims without visual proof or raw output.', 'Report embeds screenshot and links the standalone PNG.'],
    ['Maintainer', 'Package owner responsible for Composer constraints and Laravel version support.', 'Small dependency graph, Testbench, semantic versioning.', 'Package that hides large runtime behavior in install hooks.', 'Adapter remains thin; heavy runtime goes to CI/Docker/hosted worker.'],
  ])}

  <h2>Compliance-domain roadmap for Laravel</h2>
  ${renderTable(['Domain', 'Laravel applicability', 'Current state', 'Why this order'], [
    ['Accessibility / WCAG / EAA', 'Rendered Blade pages, forms, checkout, account, admin dashboards, public portals.', '<span class="status warn">wired through shared CLI; scan currently timed out on this host</span>', 'Most concrete release-review pain and the implemented Ariada domain.'],
    ['Privacy / GDPR / consent', 'Cookie banners, forms, analytics scripts, account/profile pages, contact flows.', '<span class="status block">not exposed in adapter default</span>', 'Legal/compliance buyer appears when user data and consent are in scope.'],
    ['Security / browser-surface risk', 'Headers, CSP, mixed content, third-party scripts, cookies, client-side dependencies.', '<span class="status block">future domain toggle</span>', 'CI owners already accept security gates; good second/third domain after accessibility.'],
    ['Performance', 'Public Laravel pages and heavy dashboards with tables/charts/assets.', '<span class="status block">planned domain, not implemented here</span>', 'Important for conversion and public-sector UX, but cannot be claimed without core domain.'],
    ['SEO', 'Public marketing pages, docs, marketplaces, public data portals.', '<span class="status block">future domain</span>', 'Applies to public Laravel estates; lower priority for internal admin apps.'],
    ['GEO / AIEO', 'Public knowledge, data, and product pages that should be AI-citable.', '<span class="status block">future domain</span>', 'Useful only after public-content fixtures and AI crawler evidence exist.'],
    ['i18n / localization', 'EU multilingual pages, locale routing, RTL support, date/currency labels.', '<span class="status block">future domain</span>', 'Strong EU fit but needs dedicated fixtures and locale rules.'],
    ['PCI-adjacent payment surface', 'Checkout/billing pages when Laravel app handles payment forms or plan upgrades.', '<span class="status block">conditional, not default</span>', 'Only applicable when payment surface exists; avoid overclaiming.'],
    ['Data provenance', 'Dashboards, reports, analytics portals, public datasets generated by Laravel.', '<span class="status block">future domain</span>', 'Good for public-sector/open-data evidence after base scan is stable.'],
  ])}

  <h2>Implemented / not implemented / blocker mapping</h2>
  ${renderTable(['Surface', 'Status', 'Evidence', 'Decision'], [
    ['Composer metadata', '<span class="status pass">implemented</span>', '<code>composer.json</code> with PHP/Illuminate constraints, PSR-4 autoloading, scripts, and Laravel provider metadata.', 'Keep. Run <code>composer validate</code> on PHP host before publication.'],
    ['Laravel provider', '<span class="status pass">implemented</span>', '<code>src/Laravel/AriadaServiceProvider.php</code>.', 'Keep. Test with Testbench on PHP host.'],
    ['Artisan command', '<span class="status pass">implemented</span>', '<code>src/Laravel/ScanCommand.php</code>.', 'Keep as explicit scan entrypoint.'],
    ['Framework-neutral scanner wrapper', '<span class="status pass">implemented</span>', '<code>src/AriadaScanner.php</code>, <code>AriadaCliRunner.php</code>, <code>ScanResult.php</code>.', 'Good base for Symfony/plain PHP later.'],
    ['Shared Ariada core', '<span class="status warn">invoked, timed out</span>', `<code>${escapeHtml(scanRun.command)}</code> exit ${scanRun.status}.`, 'Do not claim live scan pass until timeout is resolved.'],
    ['Screenshot evidence', '<span class="status pass">captured</span>', `<a href="${screenshotLink}"><code>scan-evidence/s98-laravel-scan.png</code></a>.`, 'Readable blocker capture; keep as visual evidence.'],
    ['PHP/Composer/PHPUnit/Pint gates', '<span class="status block">host blocked</span>', 'This environment lacks PHP/Composer in PATH.', 'Run on PHP 8.1+ host; do not mark release-ready before then.'],
    ['Packagist publication', '<span class="status block">human gate</span>', 'No founder Packagist account/namespace/tag action from this branch.', 'Founder/coordinator must publish after gates pass.'],
    ['CI/Docker/hosted runner', '<span class="status block">not implemented</span>', 'No official Action or Docker image in this worktree.', 'Build next; this is how heavy runtime becomes acceptable.'],
  ])}

  <h2>Map to existing Ariada mechanisms and urgent gaps</h2>
  ${renderTable(['Ariada mechanism', 'How Laravel uses it', 'Gap', 'Urgency'], [
    ['Shared <code>@ariada-org/cli</code>', 'The PHP wrapper builds a command and delegates scan logic.', 'Timeout on local generator run must be diagnosed.', 'High: cannot claim scan pass.'],
    ['HTML evidence report', 'Generated from <code>generate-evidence.mjs</code> and embeds screenshot.', 'Now upgraded to Dash-style channel report.', 'High: founder review gate.'],
    ['Raw JSON report', 'Expected in <code>scan-evidence/ariada-output/scan.json</code>.', 'Absent because scan timed out.', 'High.'],
    ['Command log/stderr', 'Preserved in report even when scan times out.', 'Need stable log artifact files if CI runner is added.', 'Medium.'],
    ['Domain roadmap', 'Mapped to Laravel pages and buyer roles.', 'Core domains beyond accessibility not exposed here.', 'Medium.'],
    ['Delivery Hub', 'Report includes coordinator row note.', 'This detached worktree should not directly edit central hub.', 'Medium.'],
    ['Public docs/readme', 'README has install/use/human-gate language.', 'Needs CI snippets and hosted runner docs after gates pass.', 'Medium.'],
  ])}

  <h2>Technical connectors for PHP/Laravel</h2>
  ${renderTable(['Connector', 'Current behavior', 'Expected developer experience', 'Evidence state'], [
    ['Composer package', '<code>ariada/laravel-accessibility</code> package metadata exists.', '<code>composer require ariada/laravel-accessibility</code> after Packagist publication.', 'Code-ready; external publication blocked.'],
    ['Laravel auto-discovery', 'Provider listed under <code>extra.laravel.providers</code>.', 'No manual provider registration for normal apps.', 'Needs PHP host verification.'],
    ['Publishable config', '<code>config/ariada.php</code> uses env defaults.', '<code>php artisan vendor:publish --tag=ariada-config</code>.', 'Implemented.'],
    ['Artisan command', '<code>php artisan ariada:scan {url?}</code>.', 'Runs scan against configured base URL or explicit URL.', 'Implemented, not executed in real Laravel app here.'],
    ['PHPUnit/Testbench', 'Tests exist under <code>tests/</code>.', 'Package maintainers can test provider/command behavior without a full app.', 'Host blocked in current machine.'],
    ['Pest compatibility', 'No Pest-specific API required.', 'Pest teams can still call Artisan or shell command in CI.', 'Docs/example missing.'],
    ['CI artifact upload', 'Report names expected artifacts.', 'Upload JSON, stderr, screenshot, HTML report.', 'Template missing.'],
    ['Hosted evidence upload', 'Not present.', 'Paid plan receives evidence packet and retention.', 'Future commercial path.'],
  ])}

  <h2>Laravel package shape and local/dev-loop position</h2>
  ${renderTable(['Local loop concern', 'Decision', 'Reason'], [
    ['Should Ariada scan on every PHPUnit/Pest test?', 'No.', 'Browser/Node scanning is too heavy and can be flaky compared with PHP unit tests. Use explicit command or CI gate.'],
    ['Should Composer install run the scan?', 'No.', 'Composer install should not require a running app URL or browser runtime. Many deployment flows disable scripts or optimize installs.'],
    ['Should a developer be able to run it manually?', 'Yes.', 'Explicit Artisan command is the right Laravel-shaped manual entrypoint.'],
    ['Should CI own the browser dependencies?', 'Yes.', 'CI can cache Node/Playwright and upload artifacts.'],
    ['Should hosted Ariada own retention?', 'Yes for paid tiers.', 'Product owners and compliance roles pay for evidence retention, trends, signatures, and team access.'],
  ])}

  <h2>Composer and Packagist publishing path</h2>
  ${renderTable(['Step', 'Command or action', 'Owner', 'Current status'], [
    ['Validate metadata', '<code>composer validate</code>', 'Agent/coordinator on PHP host', 'Blocked here because PHP/Composer are absent.'],
    ['Install dependencies', '<code>composer install</code>', 'Agent/coordinator on PHP host', 'Blocked here.'],
    ['Run tests', '<code>vendor/bin/phpunit</code> and optionally Pest examples', 'Agent/coordinator on PHP host', 'Blocked here.'],
    ['Run style gate', '<code>vendor/bin/pint --test</code>', 'Agent/coordinator on PHP host', 'Blocked here.'],
    ['Tag release', 'Git tag plus repository release notes', 'Founder/coordinator', 'Not done.'],
    ['Submit to Packagist', 'Packagist repository submit/update', 'Founder account holder', 'Human gate.'],
    ['Document install', 'README/docs quickstart and CI recipe', 'Agent/coordinator', 'README exists; CI recipe missing.'],
  ])}

  <h2>Artisan workflow and command semantics</h2>
  ${renderTable(['Behavior', 'Expected semantics', 'Why reviewer cares'], [
    ['Default URL', 'Uses configured <code>ARIADA_BASE_URL</code> when command URL is omitted.', 'Teams can run stable CI commands without rewriting workflow YAML for each environment.'],
    ['Explicit URL', '<code>php artisan ariada:scan https://app.example.test/dashboard</code>.', 'Reviewer can replay a specific release surface.'],
    ['Format option', 'JSON or both, delegated to shared CLI.', 'Machine automation and human review both need artifacts.'],
    ['Threshold option', 'Severity threshold maps to release-blocking exit code.', 'CI owner needs clear pass/fail behavior.'],
    ['Command log', 'Command, status, stdout, stderr preserved.', 'Blocked runs must be inspectable instead of hidden.'],
  ])}

  <h2>Pest, PHPUnit, Pint and CI culture</h2>
  ${renderTable(['Tool/culture', 'Laravel/PHP expectation', 'Ariada fit'], [
    ['PHPUnit', 'Long-standing test runner for Laravel packages and apps.', 'Use for adapter unit/feature tests. Do not claim browser accessibility from mocks.'],
    ['Pest', 'Popular alternative syntax and runner in Laravel teams; sometimes contested against PHPUnit habits.', 'Provide optional examples without forcing migration.'],
    ['Laravel Pint', 'Style gate for Laravel/PHP code.', 'Run separately from evidence generation.'],
    ['Orchestra Testbench', 'Package testing harness for Laravel package providers and commands.', 'Use to prove provider/command wiring on PHP host.'],
    ['GitHub Actions/GitLab CI', 'Expected place for DB setup, Composer cache, tests, app serve, browser checks, artifacts.', 'Best path for heavy Ariada scanner runtime.'],
    ['Dockerized runner', 'Acceptable when browser dependencies are too much for every repo.', 'Future official image should hide Node/Chrome setup.'],
  ])}

  <h2>CI release path and artifact contract</h2>
  ${renderTable(['Stage', 'Example command', 'Artifact', 'Status'], [
    ['PHP setup', 'setup PHP 8.1+ with required extensions', 'CI environment log', 'Future snippet.'],
    ['Composer install', '<code>composer install --prefer-dist --no-interaction</code>', 'Composer lock/install log', 'Future snippet.'],
    ['PHP tests', '<code>vendor/bin/phpunit</code> or <code>vendor/bin/pest</code>', 'JUnit/test output', 'Host blocked here.'],
    ['Serve app', '<code>php artisan serve --host=127.0.0.1 --port=...</code> or framework-specific test server', 'Server log', 'Future snippet.'],
    ['Ariada scan', '<code>php artisan ariada:scan http://127.0.0.1:PORT</code>', 'JSON, command log, screenshot, HTML report', 'Adapter command exists; real host scan timed out in generator.'],
    ['Artifact upload', 'GitHub/GitLab artifact upload', 'Evidence packet', 'Future snippet.'],
  ])}

  <h2>Narrow competitors in Laravel/PHP evidence channel</h2>
  <p>The direct competitor is not Laravel, Composer, PHPUnit, or Pest. Those are host-channel expectations. The narrow competitor set is automated accessibility/compliance evidence for an existing Laravel/PHP app, especially tools that can run in CI and produce reviewer artifacts.</p>
  ${renderTable(['Competitor group', 'Examples', 'Strength', 'Ariada position'], [
    ['Accessibility engines and CLIs', 'axe-core, Pa11y, pa11y-ci, Lighthouse CI, WAVE.', 'Strong automated checks and broad awareness.', 'Ariada must win on Laravel-shaped packaging plus richer evidence packet, not on pretending to be the only scanner.'],
    ['Enterprise suites', 'Deque, Siteimprove, Level Access, Evinced, AudioEye.', 'Dashboards, policies, services, mature sales.', 'Ariada adapter should stay free while paid layer sells retention, signed exports, baselines, and domain packs.'],
    ['PHP QA tools', 'PHPUnit, Pest, Pint, PHPStan, Psalm.', 'Deeply accepted in PHP CI.', 'Complementary: they prove code behavior/style/static quality; Ariada proves rendered web evidence.'],
    ['PHP accessibility wrappers', 'pa11y-php and similar Composer wrappers.', 'Closer to PHP ecosystem.', 'Ariada must differentiate through domain roadmap and review-ready evidence, not only wrapper mechanics.'],
    ['Manual audits and agency QA', 'Consultant reports, spreadsheet checklists, screenshots.', 'Human expertise and client trust.', 'Ariada should provide repeatable pre-audit evidence and escalation context.'],
  ])}

  <h2>How to monetize Laravel channel</h2>
  ${renderTable(['Layer', 'Free/open-source', 'Paid/hosted', 'Buyer'], [
    ['Adapter', 'Composer package, service provider, Artisan command, config, local HTML report.', 'None; keep wrapper free to reduce adoption friction.', 'Developer/user.'],
    ['CI reliability', 'Example workflows and documented artifacts.', 'Managed Action/Docker runner with browser cache, version pinning, and support.', 'CI/platform owner.'],
    ['Evidence retention', 'Local artifacts in repo/CI.', 'Hosted retention, audit log, signed export, team access, baseline trend.', 'Product owner, compliance owner, agency lead.'],
    ['Domain packs', 'Accessibility first.', 'Privacy/security/performance/SEO/i18n packs with policy thresholds.', 'Compliance/legal/platform buyer.'],
    ['Procurement packet', 'Basic HTML report.', 'Client-ready PDF/export, jurisdiction notes, evidence bundle, reviewer comments.', 'Agency delivery lead, public-sector vendor.'],
    ['Fleet scanning', 'Manual one-app scan.', 'Portfolio scan across many Laravel properties and environments.', 'Platform/compliance buyer.'],
  ])}

  <h2>Competitor sales models in this channel</h2>
  ${renderTable(['Vendor/tool pattern', 'Sales model', 'Laravel implication', 'Ariada response'], [
    ['Open-source CLI scanner', 'Free CLI plus community support.', 'Easy adoption but weak retention, signatures, and reviewer workflow.', 'Use free adapter as adoption, sell managed evidence.'],
    ['Enterprise accessibility suite', 'Subscription, services, dashboards, procurement sales.', 'Buyer gets policy and reporting but developer friction can be high.', 'Offer lower-friction Laravel entry and bridge to paid dashboard.'],
    ['Manual audit agency', 'Project or retainer fees.', 'Strong human review but not continuous release evidence.', 'Complement agencies with repeatable pre-review artifacts.'],
    ['CI platform tooling', 'Included in platform or marketplace action.', 'Good artifact plumbing, generic domain understanding.', 'Publish official CI recipe and artifact contract.'],
    ['PHP QA tooling', 'Open-source plus commercial SaaS/add-ons.', 'PHP developers accept this model.', 'Keep Composer path familiar and avoid alien packaging.'],
  ])}

  <h2>Differences from competitors and current weakness</h2>
  ${renderTable(['Dimension', 'Where Ariada can be better', 'Where Ariada is weaker today', 'Action'], [
    ['Laravel fit', 'Composer + Artisan + config matches channel expectations.', 'Not yet on Packagist; PHP host gates not run here.', 'Run PHP gates and publish after review.'],
    ['Evidence completeness', 'HTML report combines role, source, artifact, blocker, and roadmap context.', 'Live CLI scan timed out, so raw scan JSON absent.', 'Fix scanner timeout and attach JSON.'],
    ['Commercial wedge', 'Paid retention/signed exports/domain packs map to buyer pain.', 'No hosted product layer in this worktree.', 'Do not overclaim; mark as future.'],
    ['Domain expansion', 'Ariada can unify accessibility/privacy/security/performance evidence.', 'Only accessibility is wired in adapter default.', 'Expose domain toggles only after core domains exist.'],
    ['Community proof', 'Report names community surfaces and repeated patterns.', 'No user interviews yet.', 'Run pain-mining plan before sales claims.'],
  ])}

  <h2>Sources and documents</h2>
  <p>Sources below are scoped to Laravel/PHP/Composer/Artisan/Pest/PHPUnit/CI and accessibility evidence. Official docs and standards are used for implementation and compliance facts. Community sources are untrusted and used only for objections, pain language, and adoption signals.</p>
  ${renderTable(['Source', 'Reliability', 'How this report uses it'], sourceRows)}

  <h2>Source attribution map</h2>
  ${renderTable(['Claim area', 'Primary sources', 'Secondary/community sources', 'Reliability note'], [
    ['Composer/Packagist path', `${link('https://getcomposer.org/doc/00-intro.md', 'Composer intro')} · ${link('https://packagist.org/about', 'Packagist about')}`, `${link('https://laravel-news.com/packagist-and-the-php-ecosystem', 'Laravel News Packagist')}`, 'High for official mechanics; secondary for ecosystem language.'],
    ['Laravel package/provider/Artisan fit', `${link('https://laravel.com/docs/13.x/packages', 'Laravel package docs')} · ${link('https://laravel.com/docs/13.x/artisan', 'Artisan docs')} · ${link('https://laravel.com/docs/13.x/providers', 'providers docs')}`, `${link('https://stackoverflow.com/questions/28492394/laravel-5-creating-artisan-command-for-packages', 'Stack Overflow command package')}`, 'Official docs decide implementation; SO shows recurring user questions.'],
    ['PHP test culture', `${link('https://laravel.com/docs/13.x/testing', 'Laravel testing')} · ${link('https://docs.phpunit.de/en/12.0/installation.html', 'PHPUnit docs')} · ${link('https://pestphp.com/docs/continuous-integration', 'Pest CI')}`, `${link('https://github.com/pestphp/pest/issues/149', 'Pest objections')} · ${link('https://freek.dev/2843-running-php-tests-in-parallel-on-github-actions', 'parallel tests article')}`, 'Official docs for facts; community for adoption/friction.'],
    ['Accessibility evidence market', `${link('https://www.w3.org/TR/WCAG22/', 'WCAG 2.2')} · ${link('https://www.etsi.org/deliver/etsi_en/301500_301599/301549/', 'EN 301 549')} · ${link('https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/union-equality-strategy-rights-persons-disabilities-2021-2030/european-accessibility-act_en', 'EAA overview')}`, `${link('https://github.com/pa11y/pa11y/issues/425', 'Pa11y WCAG issue')}`, 'Standards/policy high; community issue only signals standards-coverage concern.'],
    ['Competitor model', `${link('https://github.com/dequelabs/axe-core', 'axe-core')} · ${link('https://github.com/pa11y/pa11y', 'Pa11y')} · ${link('https://github.com/GoogleChrome/lighthouse-ci', 'Lighthouse CI')}`, `${link('https://www.siteimprove.com/toolkit/accessibility/', 'Siteimprove')} · ${link('https://www.evinced.com/', 'Evinced')} · ${link('https://www.levelaccess.com/', 'Level Access')}`, 'Vendor pages are primary for product existence, not neutral quality claims.'],
  ])}

  <h2>Competitor/source links used for positioning</h2>
  ${renderTable(['Source', 'Reliability', 'Positioning use'], competitorRows)}

  <h2>Community review sources</h2>
  <p>Community review sources are channel-specific for Laravel/PHP/Composer/Pest/PHPUnit/CI. They are not used as factual proof of market size or legal obligations. They are used to identify repeated objections: CI drift, package discovery/cache surprises, Composer script/deploy friction, Pest versus PHPUnit preference, and the need for explicit artifacts when host commands fail.</p>
  ${renderTable(['Community/review source', 'Trust boundary', 'Extracted channel signal'], communityRows)}

  <h2>Signal count</h2>
  ${renderTable(['Signal family', 'Source families represented', 'Repeated pattern', 'Product implication'], [
    ['CI/deploy setup pain', 'Reddit, Stack Overflow, Laracasts, Freek.dev, GitHub issues.', 'Laravel teams spend real time making CI, DB, Composer, test, and deploy environments match local behavior.', 'Ariada must produce exact command/stderr and a reusable CI template.'],
    ['Composer/package discovery pain', 'Laravel docs, Composer docs, Stack Overflow, Laravel GitHub issues, Laracasts.', 'Package discovery and Composer flags can surprise deploys.', 'No hidden scan in Composer install; document provider/config fallback.'],
    ['PHPUnit/Pest split', 'Pest docs, PHPUnit docs, Pest issue, Laracasts, Dev.to.', 'Teams vary between PHPUnit and Pest, and some resist Pest as default.', 'Examples should support both; adapter should not depend on either runner.'],
    ['Accessibility automation limits', 'WCAG/EN sources, Pa11y issue, CivicActions article, vendor docs.', 'Automated checks are useful but not complete human proof.', 'Report must state what it does not prove and preserve visual evidence.'],
    ['Wrapper versus evidence differentiation', 'pa11y-php, axe, Pa11y, Lighthouse CI, enterprise vendors.', 'Plain scanners/wrappers are crowded.', 'Ariada differentiates with channel-specific evidence pack and domain expansion.'],
    ['Buyer split', 'Official docs plus community pain surfaces.', 'Developer installs, platform owner standardizes, product/compliance owner pays.', 'Role/payer table must stay explicit.'],
  ])}

  <h2>Repeated patterns and objections</h2>
  ${renderTable(['Pattern', 'Backed by source families', 'Strength', 'Ariada answer'], [
    ['Do not surprise Composer install/deploy.', 'Composer docs, Laravel GitHub issues, Stack Overflow production install, Laracasts provider/config discussion.', 'Strong repeated technical objection.', 'Keep scans explicit; no post-install browser work.'],
    ['CI differs from local.', 'Reddit CI thread, Stack Overflow GitHub Actions, Laracasts Pest CI failure, Freek.dev parallel tests.', 'Strong repeated workflow pattern.', 'Evidence report records exact command, exit, stderr, and host blocker.'],
    ['Pest is popular but not universal.', 'Pest docs, Pest objections issue, Laracasts Pest review, Dev.to story.', 'Moderate repeated adoption pattern.', 'Support Pest examples but keep PHPUnit/Testbench as baseline.'],
    ['Automated accessibility is not enough alone.', 'WCAG/EN standards, Pa11y issue, CivicActions article, enterprise vendor positioning.', 'Strong compliance pattern.', 'Do not mark review-ready without human caveats and visual review.'],
    ['Scanner market is crowded.', 'axe, Pa11y, Lighthouse CI, WAVE, enterprise vendors, PHP wrappers.', 'Strong competitive pattern.', 'Sell evidence workflow and domain packs, not another generic scanner claim.'],
  ])}

  <h2>No-signal searches</h2>
  ${renderTable(['Surface searched', 'Result', 'Why weak or no-signal', 'Follow-up'], [
    ['Generic “Laravel accessibility package” search', 'Mostly widgets, one-off packages, and generic WCAG articles.', 'Weak for compliance evidence workflow; many results solve overlay/widget insertion, not release proof.', 'Search Packagist and GitHub issues for package-specific adoption later.'],
    ['Product Hunt', 'No strong Laravel-specific accessibility evidence product signal found in this pass.', 'Product Hunt is weak for framework-specific PHP release tooling.', 'Prefer Laravel News, Laracasts, GitHub, Stack Overflow.'],
    ['Hacker News generic accessibility tooling', 'Useful for broad skepticism, weak for Laravel channel specifics.', 'Audience is too broad and not Composer/Artisan-focused.', 'Use only for pricing/enterprise skepticism if needed.'],
    ['Private Discord/Slack', 'Not used.', 'Not publicly accessible and not appropriate as cited evidence.', 'Ask humans for interview notes if available.'],
    ['Marketplace reviews', 'Laravel does not have a single official plugin marketplace equivalent to WordPress.', 'Packagist download/repo signals are better, but still not buyer proof.', 'Use Packagist/GitHub once package is published.'],
  ])}

  <h2>Pain mining plan and exact search queries</h2>
  <p>Next research should collect pain language across Laravel/PHP-specific surfaces. Do not count search result counts as evidence. Extract repeated patterns only when more than one source family shows the same objection or buying trigger.</p>
  ${renderTable(['Query / surface', 'Use boundary', 'Signals to collect'], painRows)}

  <h2>Evidence artifacts</h2>
  ${renderTable(['Artifact', 'Path/link', 'Purpose', 'Status'], [
    ['Reviewer report', '<code>scan-evidence/result.html</code>', 'This Dash-style channel report.', 'Generated from script.'],
    ['Standalone screenshot', `<a href="${screenshotLink}"><code>scan-evidence/s98-laravel-scan.png</code></a>`, 'Openable full-size visual evidence.', 'Exists and reviewed.'],
    ['Capture page', '<code>scan-evidence/_capture.html</code>', 'HTML page used as screenshot source.', 'Generated.'],
    ['Machine output', '<code>scan-evidence/ariada-output/scan.json</code>', 'Expected JSON when CLI completes.', 'Missing because scan timed out.'],
    ['Concise test report', '<code>test-report/result.html</code>', 'Short gate summary for coordinator.', 'Generated.'],
    ['Generator', '<code>scripts/generate-evidence.mjs</code>', 'Regenerates screenshot page, report, and concise test report.', 'Updated first.'],
  ])}

  <h2>Tested surface</h2>
  ${renderTable(['Surface', 'Value', 'Interpretation'], [
    ['Fixture URL', `<code>${escapeHtml(fixtureUrl)}</code>`, 'Representative Laravel Blade-style dashboard served locally during generation.'],
    ['Fixture file', '<code>fixtures/laravel-dashboard.html</code>', 'Static rendered HTML with accessibility defects suitable for scanner proof, not a full Laravel app.'],
    ['Structure gate', `<code>${escapeHtml(structureRun.command)}</code> exit ${structureRun.status}`, 'Proves expected files/classes/package shape exist.'],
    ['Shared CLI command', `<code>${escapeHtml(scanRun.command)}</code> exit ${scanRun.status}`, 'Attempted real shared CLI scan; timed out here.'],
    ['Finding count', `${escapeHtml(findingCount)}`, 'Not available until CLI JSON is produced.'],
  ])}

  <h2>Evidence screenshot</h2>
  ${
    screenshotDataUrl
      ? `<figure><a href="${screenshotLink}"><img src="${screenshotDataUrl}" alt="Screenshot of the Laravel representative surface scan result, including fixture URL, CLI command, stdout, stderr, and finding summary." /></a><figcaption>Embedded screenshot from the local scan evidence page. <a href="${screenshotLink}">Open standalone PNG screenshot</a>.</figcaption></figure>`
      : '<p><strong>VISUAL_EVIDENCE_GAP:</strong> no screenshot could be captured because Playwright was unavailable. The standalone PNG requirement is not satisfied until this file exists.</p>'
  }

  <h2>Visual evidence review</h2>
  <p>The screenshot shows a readable blocker capture rather than a blank or decorative image. It records the fixture URL, structure check exit 0, shared Ariada CLI command, scan exit 124, empty stdout, <code>spawnSync node ETIMEDOUT</code> stderr, and empty machine summary. The visual evidence is therefore useful for blocker triage, but it is not proof of a successful live accessibility scan.</p>
  ${renderTable(['Visual check', 'Observed state', 'Risk'], [
    ['Blank image', 'No. The screenshot contains readable report content.', 'Low.'],
    ['Misleading pass badge', 'No. The capture badge says scan blocker capture.', 'Low.'],
    ['Overlay/cropping issue', 'No obvious overlay; content fits within the 1280x980 image.', 'Low.'],
    ['Standalone link', `<a href="${screenshotLink}">${screenshotLink}</a>`, 'Present and relative.'],
    ['Evidence gap', screenshotDataUrl ? 'No VISUAL_EVIDENCE_GAP for this run; screenshot exists.' : 'VISUAL_EVIDENCE_GAP documented because screenshot is missing.', screenshotDataUrl ? 'Low.' : 'High until captured.'],
  ])}

  <h2>Verification and test adequacy</h2>
  ${renderTable(['Gate', 'Command', 'Exit/status', 'Adequacy'], [
    ['Structure', `<code>${escapeHtml(structureRun.command)}</code>`, String(structureRun.status), 'Adequate for package file/class/metadata presence.'],
    ['Shared CLI scan', `<code>${escapeHtml(scanRun.command)}</code>`, String(scanRun.status), 'Attempted real scan but timed out; inadequate for scan-pass claim.'],
    ['Composer validate', '<code>composer validate</code>', 'host blocked', 'Required before publication.'],
    ['Composer install', '<code>composer install</code>', 'host blocked', 'Required to resolve Illuminate/Testbench/Pint/PHPUnit constraints.'],
    ['PHPUnit/Testbench', '<code>vendor/bin/phpunit</code>', 'host blocked', 'Required for provider/command behavior.'],
    ['Pint', '<code>vendor/bin/pint --test</code>', 'host blocked', 'Required for Laravel style gate if used by package.'],
    ['Screenshot', 'Playwright capture of <code>_capture.html</code>', screenshotDataUrl ? 'captured' : 'missing', 'Adequate for blocker review, not for pass claim.'],
  ])}
  <p>The current evidence is adequate for proving generator behavior, package shape, and blocker transparency. It is not adequate for claiming Packagist readiness, Laravel application compatibility, or successful rendered accessibility scanning. A PHP-enabled host must rerun Composer, PHPUnit/Testbench, Pint, and the shared CLI scan before public release language changes from host-blocked to ready-for-review.</p>

  <h2>What this report does not prove</h2>
  ${renderTable(['Limit', 'Why it matters', 'Next proof'], [
    ['Real Laravel runtime', 'The fixture is rendered HTML, not a booted Laravel app with routes, middleware, config cache, queues, DB, and assets.', 'Run package in a minimal Laravel app and scan a served route.'],
    ['PHP dependency compatibility', 'Composer dependencies were not resolved in this shell.', 'Run Composer and tests on PHP 8.1+ host.'],
    ['Successful Ariada scan', 'The shared CLI timed out.', 'Fix timeout or browser/runtime dependency and produce <code>scan.json</code>.'],
    ['Packagist availability', 'No account/repository submission happened.', 'Founder/coordinator publishes after gates pass.'],
    ['Buyer demand', 'Community review found pain surfaces but no paid interviews.', 'Run interviews with Laravel agency/product/CI/compliance roles.'],
    ['Multi-domain evidence', 'Only accessibility is configured as the current adapter domain.', 'Add core domains and channel tests before claims.'],
  ])}

  <h2>What is not covered yet</h2>
  ${renderList([
    'This report is regenerated from <code>scripts/generate-evidence.mjs</code>; a template change is not reflected until it is run again.',
    'The PHP checks — <code>composer validate</code>, <code>composer install</code>, <code>vendor/bin/phpunit</code> and <code>vendor/bin/pint --test</code> — need a PHP-enabled host and have not been run here.',
    'The shared command-line scanner timed out, so no <code>scan-evidence/ariada-output/scan.json</code> was produced; the status language below is not backed by a scan.',
    'There are no GitHub Actions or GitLab CI snippets yet for caching dependencies and uploading the evidence packet.',
    'There is no Pest example; adding one must not make Pest a hard dependency.',
  ])}

  <h2>What should the human do next</h2>
  ${renderList([
    'Confirm whether <code>ariada/laravel-accessibility</code> is the final Packagist package name and whether the namespace is available.',
    'Provide or approve Packagist account/repository publication when PHP host gates pass.',
    'Choose whether the first paid Laravel offer is hosted evidence retention, signed export, team baseline dashboard, or agency/client handoff packet.',
    'Give one real Laravel app URL or a sanctioned fixture app for a live route scan.',
    'Decide whether this channel should ship before CI/Docker runner exists or remain code-ready until the heavy runtime is hidden.',
  ])}

  <h2>Who is waiting on whom</h2>
  ${renderTable(['Owner', 'Waiting for', 'Why'], [
    ['Agent/coordinator', 'PHP-enabled host and scan-timeout diagnosis.', 'Cannot verify Composer/PHPUnit/Pint or produce scan JSON here.'],
    ['Founder/human', 'Packagist namespace/account and package-name approval.', 'Publication is external account state.'],
    ['CI/platform owner persona', 'Official workflow snippet and artifact contract.', 'Needed to standardize across apps.'],
    ['Product/compliance persona', 'Hosted retention and signed exports.', 'Needed before paying buyer gets durable audit trail.'],
    ['Reviewer persona', 'Successful live scan plus raw JSON.', 'Needed before review-ready evidence claim.'],
  ])}

  <h2>Further distribution and promotion</h2>
  ${renderTable(['Channel', 'Message', 'Timing', 'Caveat'], [
    ['Packagist', 'Composer package for Laravel accessibility evidence via Ariada.', 'After PHP gates and founder publication.', 'Do not publish with host-blocked wording as a pass.'],
    ['GitHub README', 'Install, configure, run Artisan scan, upload artifacts.', 'Before package submission.', 'Include timeout/blocker caveats until resolved.'],
    ['Laravel News / community posts', 'How to add release evidence to Laravel CI without replacing PHPUnit/Pest.', 'After successful CI example.', 'Avoid legal/compliance overclaims.'],
    ['Agency outreach', 'Client handoff evidence packet for WCAG/EAA review.', 'After report and signed export path exists.', 'Needs buyer interviews.'],
    ['Public-sector procurement docs', 'Repeatable evidence artifacts for Laravel service delivery.', 'After EN/WCAG mapping is deeper.', 'Not legal advice.'],
    ['Developer docs', 'Composer, Artisan, PHPUnit/Pest, GitHub/GitLab snippets.', 'Next implementation increment.', 'Keep Node/browser runtime cache explicit.'],
  ])}

  <h2>Scan stdout</h2>
  <pre>${escapeHtml(scanRun.stdout || '(empty)')}</pre>
  <h2>Scan stderr</h2>
  <pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
  <h2>Machine summary</h2>
  <pre>${escapeHtml(JSON.stringify(reportJson?.summary ?? reportJson ?? {}, null, 2))}</pre>

  <h2>Coordinator hub row note</h2>
  <p>Do not edit the hub from this worktree. Coordinator row suggestion for S98: <strong>CODE_READY / HOST_BLOCKED</strong> until PHP/Composer gates and shared CLI scan finish; link <code>integrations/php-laravel-ariada/scan-evidence/result.html</code>, <code>integrations/php-laravel-ariada/test-report/result.html</code>, and list Packagist publication as the founder human gate.</p>
</main>
<footer>
  <p>Ariada S98 evidence. Generated by <code>integrations/php-laravel-ariada/scripts/generate-evidence.mjs</code>. Screenshot link is relative; source/community links are external and should be treated according to the reliability column.</p>
</footer>
</body>
</html>`;
}

function renderTestReport({ structureRun, scanRun, screenshotDataUrl }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PHP/Laravel test report</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:900px;margin:30px auto;padding:0 20px}code,pre{font-family:ui-monospace,monospace}pre{background:#111827;color:#fff;padding:12px;border-radius:8px;overflow:auto}</style></head>
<body>
<h1>PHP/Laravel test report</h1>
<ul>
  <li>Structure validator: exit ${structureRun.status}</li>
  <li>Shared CLI scan command: exit ${scanRun.status}</li>
  <li>Screenshot captured: ${screenshotDataUrl ? 'yes' : 'no'}</li>
  <li>PHP/Composer/PHPUnit/Pint: host blocked in this environment.</li>
</ul>
<p>Reviewer-ready report: <a href="../scan-evidence/result.html">scan-evidence/result.html</a>.</p>
<h2>Scan stderr</h2>
<pre>${escapeHtml(scanRun.stderr || '(empty)')}</pre>
</body>
</html>`;
}

const structureRun = run('node', ['integrations/php-laravel-ariada/scripts/validate-structure.mjs']);

let scanRun = {
  command: 'node packages/ariada-cli/dist/bin.js scan <fixture>',
  status: 1,
  stdout: '',
  stderr: 'scan not attempted',
  durationMs: 0,
};
let fixtureUrl = 'host-blocked://laravel-fixture';
let reportJson = {};

const { server, url } = await startFixtureServer();
fixtureUrl = url;
try {
  const buildRun = run('pnpm', ['--filter', '@ariada-org/cli', 'build']);
  if (buildRun.status !== 0) {
    scanRun = {
      ...buildRun,
      command: `${buildRun.command} && node packages/ariada-cli/dist/bin.js scan ${fixtureUrl}`,
    };
  } else {
    scanRun = run('node', [
      'packages/ariada-cli/dist/bin.js',
      'scan',
      fixtureUrl,
      '--domains',
      'accessibility',
      '--format',
      'both',
      '--output-dir',
      outputDir,
      '--severity-threshold',
      'serious',
      '--timeout-ms',
      '5000',
    ], { timeout: 15_000 });
    const scanJsonPath = join(outputDir, 'scan.json');
    if (existsSync(scanJsonPath)) {
      reportJson = JSON.parse(readFileSync(scanJsonPath, 'utf8'));
    }
  }
} finally {
  server.close();
}

writeFileSync(pagePath, renderCapturePage({ fixtureUrl, scanRun, structureRun, reportJson }), 'utf8');

let screenshotDataUrl = '';
try {
  const playwrightPath = join(
    repoRoot,
    'node_modules',
    '.pnpm',
    'playwright@1.61.0',
    'node_modules',
    'playwright',
    'index.js',
  );
  const playwrightModule = await import(playwrightPath);
  const playwright = playwrightModule.default ?? playwrightModule;
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 980 } });
  await page.goto(`file://${pagePath}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();
  screenshotDataUrl = `data:image/png;base64,${readFileSync(screenshotPath).toString('base64')}`;
} catch (error) {
  writeFileSync(join(evidenceDir, 'playwright-blocker.txt'), String(error), 'utf8');
}

writeFileSync(resultPath, renderResult({ fixtureUrl, scanRun, structureRun, reportJson, screenshotDataUrl }), 'utf8');
writeFileSync(testReportPath, renderTestReport({ structureRun, scanRun, screenshotDataUrl }), 'utf8');
console.log(`wrote ${resultPath}`);
console.log(`wrote ${testReportPath}`);
if (screenshotDataUrl) {
  console.log(`embedded screenshot ${basename(screenshotPath)}`);
}

if (structureRun.status !== 0 || !screenshotDataUrl) {
  process.exit(1);
}
