import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import installedLocales from '@agonist/localization/wiki-locales.json';
import installedMessages from '@agonist/localization/wiki-messages.json';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const generatorPath = path.join(appRoot, 'scripts', 'generate.mjs');
const matrixPath = path.join(appRoot, 'data', 'channel-matrix.json');
const localesExportPath = fileURLToPath(
  import.meta.resolve('@agonist/localization/wiki-locales.json'),
);
const messagesExportPath = fileURLToPath(
  import.meta.resolve('@agonist/localization/wiki-messages.json'),
);

function findLocalizationPackageRoot(exportPath) {
  let directory = path.dirname(exportPath);
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, 'package.json');
    if (existsSync(manifest)) {
      const packageJson = JSON.parse(readFileSync(manifest, 'utf8'));
      if (packageJson.name === '@agonist/localization') return directory;
    }
    directory = path.dirname(directory);
  }
  throw new Error('Unable to locate the installed @agonist/localization package.');
}

const installedLocalizationRoot = findLocalizationPackageRoot(localesExportPath);

function runGenerator(app) {
  return spawnSync(process.execPath, [path.join(app, 'scripts', 'generate.mjs')], {
    cwd: app,
    encoding: 'utf8',
    maxBuffer: 2 * 1024 * 1024,
  });
}

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function jsonLdFrom(html) {
  const match = html.match(
    /<script type="application\/ld\+json">([^<]+)<\/script>/,
  );
  assert.ok(match, 'Generated detail page is missing JSON-LD.');
  return JSON.parse(match[1]);
}

function sitemapLastmod(sitemap, location) {
  const escaped = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sitemap.match(
    new RegExp(
      '<url><loc>' + escaped + '<\\/loc>[\\s\\S]*?<lastmod>([^<]+)<\\/lastmod><\\/url>',
    ),
  );
  assert.ok(match, 'Sitemap is missing ' + location);
  return match[1];
}

function generatedFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? generatedFiles(root, file) : [file];
    })
    .sort((left, right) =>
      path.relative(root, left).localeCompare(path.relative(root, right), 'en')
    );
}

function outputFingerprint(root) {
  const files = generatedFiles(root);
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(path.relative(root, file));
    digest.update('\0');
    digest.update(readFileSync(file));
    digest.update('\0');
  }
  return {
    files: files.map((file) => path.relative(root, file)),
    digest: digest.digest('hex'),
  };
}

function verifyAssetContract(output) {
  const htmlFiles = generatedFiles(output).filter((file) => file.endsWith('.html'));
  const references = new Set();
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    assert.doesNotMatch(html, /\/assets\/(?:wiki\.css|catalog\.js)/);
    for (const match of html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g)) {
      references.add(match[1]);
      assert.ok(
        existsSync(path.join(output, match[1].slice(1))),
        path.relative(output, file) + ' references missing asset ' + match[1],
      );
    }
  }

  const css = [...references].find((asset) =>
    /^\/assets\/wiki\.[0-9a-f]{64}\.css$/.test(asset)
  );
  const catalog = [...references].find((asset) =>
    /^\/assets\/catalog\.[0-9a-f]{64}\.js$/.test(asset)
  );
  assert.ok(css, 'Generated HTML is missing its content-addressed stylesheet.');
  assert.ok(catalog, 'Generated HTML is missing its content-addressed catalog script.');
  assert.equal(references.size, 2);

  for (const asset of [css, catalog]) {
    const bytes = readFileSync(path.join(output, asset.slice(1)));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.ok(asset.includes('.' + digest + '.'));
  }
  assert.equal(existsSync(path.join(output, 'assets', 'wiki.css')), false);
  assert.equal(existsSync(path.join(output, 'assets', 'catalog.js')), false);

  const headers = readFileSync(path.join(output, '_headers'), 'utf8');
  assert.equal(headers.includes('/assets/*'), false);
  assert.doesNotMatch(headers, /\/assets\/(?:wiki\.css|catalog\.js)/);
  const immutablePaths = [
    ...headers.matchAll(
      /^(\S+)\n  Cache-Control: [^\n]*\bimmutable\b/gm,
    ),
  ].map((match) => match[1]).sort();
  assert.deepEqual(immutablePaths, [css, catalog].sort());

  return { css, catalog };
}

test('installed localization subpaths expose the published JS wrappers', () => {
  const packageJson = JSON.parse(
    readFileSync(path.join(installedLocalizationRoot, 'package.json'), 'utf8'),
  );
  assert.equal(packageJson.version, '0.1.0');
  assert.match(localesExportPath, /\.[cm]?js$/);
  assert.match(messagesExportPath, /\.[cm]?js$/);
  assert.ok(Array.isArray(installedLocales));
  assert.ok(installedLocales.length > 0);
  for (const locale of installedLocales) {
    assert.ok(installedMessages[locale.code]);
  }
});

test('production generator accepts the current matrix contract in an isolated app', (t) => {
  const generator = readFileSync(generatorPath, 'utf8');
  const matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'ariada-wiki-contract-'));
  const temporaryApp = path.join(temporaryRoot, 'app');
  const temporaryPackageScope = path.join(
    temporaryApp,
    'node_modules',
    '@agonist',
  );
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  mkdirSync(path.join(temporaryApp, 'scripts'), { recursive: true });
  mkdirSync(path.join(temporaryApp, 'data'), { recursive: true });
  mkdirSync(temporaryPackageScope, { recursive: true });
  symlinkSync(
    installedLocalizationRoot,
    path.join(temporaryPackageScope, 'localization'),
    'dir',
  );
  copyFileSync(generatorPath, path.join(temporaryApp, 'scripts', 'generate.mjs'));

  const planned = matrix.channels.find(
    (module) => module.state === 'Planned' && module.updatedAt === null,
  );
  const updated = matrix.channels.find((module) => module.updatedAt !== null);
  assert.ok(planned, 'The matrix must include a planned module with updatedAt:null.');
  assert.ok(updated, 'The matrix must include a module with a public update date.');
  assert.equal(typeof planned.installation, 'string');

  const obsoleteInstallation = structuredClone(matrix);
  obsoleteInstallation.channels[0].installation = { status: 'unavailable' };
  writeJson(
    path.join(temporaryApp, 'data', 'channel-matrix.json'),
    obsoleteInstallation,
  );
  const installationDrift = runGenerator(temporaryApp);
  assert.notEqual(installationDrift.status, 0);
  assert.match(
    installationDrift.stderr,
    /\.installation must be a non-empty string/,
  );

  const obsoleteDate = structuredClone(matrix);
  const obsoleteDateModule = obsoleteDate.channels.find(
    (module) => module.updatedAt !== null,
  );
  obsoleteDateModule.lastChangedAt = obsoleteDateModule.updatedAt;
  delete obsoleteDateModule.updatedAt;
  writeJson(path.join(temporaryApp, 'data', 'channel-matrix.json'), obsoleteDate);
  const dateDrift = runGenerator(temporaryApp);
  assert.notEqual(dateDrift.status, 0);
  assert.match(dateDrift.stderr, /\.updatedAt must be null or a valid timestamp/);

  copyFileSync(matrixPath, path.join(temporaryApp, 'data', 'channel-matrix.json'));
  const result = runGenerator(temporaryApp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.locales, matrix.wiki.locales.length);
  assert.equal(report.modules, 236);

  const output = path.join(temporaryApp, 'dist');
  const plannedSlug = planned.id.toLowerCase();
  const plannedRoute = `/en/modules/${plannedSlug}/`;
  const plannedHtml = readFileSync(
    path.join(output, 'en', 'modules', plannedSlug, 'index.html'),
    'utf8',
  );
  assert.match(
    plannedHtml,
    new RegExp(
      '<link rel="canonical" href="https://wiki\\.ariada\\.org'
        + plannedRoute
        + '">',
    ),
  );
  assert.ok(plannedHtml.includes(planned.installation));
  assert.doesNotMatch(plannedHtml, /<time\b/);
  assert.equal(jsonLdFrom(plannedHtml).dateModified, matrix.generatedAt);

  const updatedSlug = updated.id.toLowerCase();
  const updatedHtml = readFileSync(
    path.join(output, 'en', 'modules', updatedSlug, 'index.html'),
    'utf8',
  );
  assert.ok(updatedHtml.includes(`datetime="${updated.updatedAt}"`));
  assert.equal(jsonLdFrom(updatedHtml).dateModified, updated.updatedAt);

  const sitemap = readFileSync(path.join(output, 'sitemap-en.xml'), 'utf8');
  assert.equal(
    sitemapLastmod(sitemap, 'https://wiki.ariada.org' + plannedRoute),
    matrix.generatedAt.slice(0, 10),
  );
  assert.equal(
    sitemapLastmod(
      sitemap,
      `https://wiki.ariada.org/en/modules/${updatedSlug}/`,
    ),
    updated.updatedAt.slice(0, 10),
  );

  for (const localeCode of matrix.wiki.locales) {
    const detailHtml = readFileSync(
      path.join(output, localeCode, 'modules', plannedSlug, 'index.html'),
      'utf8',
    );
    const head = detailHtml.slice(0, detailHtml.indexOf('</head>'));
    const articleData = jsonLdFrom(detailHtml);
    assert.ok(detailHtml.includes(`<html lang="${localeCode}"`));
    assert.ok(detailHtml.includes('<article class="module-article" lang="en">'));
    assert.ok(detailHtml.includes(`<h2 lang="${localeCode}">`));
    assert.ok(head.includes('<meta name="description" lang="en"'));
    assert.ok(head.includes('<title lang="en">'));
    assert.ok(
      head.includes(
        `<link rel="canonical" href="https://wiki.ariada.org/en/modules/${plannedSlug}/">`,
      ),
    );
    assert.doesNotMatch(detailHtml, /hreflang=/);
    assert.equal(articleData.inLanguage, 'en');
    assert.equal(
      articleData.url,
      `https://wiki.ariada.org/en/modules/${plannedSlug}/`,
    );
    assert.equal(
      articleData.mainEntityOfPage,
      `https://wiki.ariada.org/en/modules/${plannedSlug}/`,
    );
    assert.ok(
      detailHtml.includes(
        `href="/${localeCode}/modules/${plannedSlug}/" lang="${localeCode}"`,
      ),
    );
    if (localeCode === 'en') {
      assert.doesNotMatch(detailHtml, /data-source-fallback/);
    } else {
      assert.ok(
        detailHtml.includes(
          `data-source-fallback lang="${localeCode}"`,
        ),
      );
    }

    const localeSitemap = readFileSync(
      path.join(output, `sitemap-${localeCode}.xml`),
      'utf8',
    );
    const moduleLocations = [
      ...localeSitemap.matchAll(
        /<loc>https:\/\/wiki\.ariada\.org\/en\/modules\/s\d+\/<\/loc>/g,
      ),
    ];
    assert.equal(moduleLocations.length, localeCode === 'en' ? 236 : 0);
  }
  assert.ok(matrix.wiki.locales.includes('pt-BR'));
  assert.ok(matrix.wiki.locales.includes('zh-CN'));
  assert.ok(matrix.wiki.locales.includes('zh-TW'));
  const englishDetailEntry = sitemap.match(
    new RegExp(
      '<url><loc>https://wiki\\.ariada\\.org/en/modules/'
        + plannedSlug
        + '/</loc>([\\s\\S]*?)</url>',
    ),
  );
  assert.ok(englishDetailEntry);
  assert.doesNotMatch(englishDetailEntry[0], /hreflang=/);

  const firstAssets = verifyAssetContract(output);
  const firstFingerprint = outputFingerprint(output);
  const repeated = runGenerator(temporaryApp);
  assert.equal(repeated.status, 0, repeated.stderr || repeated.stdout);
  assert.deepEqual(outputFingerprint(output), firstFingerprint);
  assert.deepEqual(verifyAssetContract(output), firstAssets);

  const changedGenerator = generator.replace(
    '--paper: #fffdf8;',
    '--paper: #fffdf7;',
  );
  assert.notEqual(changedGenerator, generator);
  writeFileSync(
    path.join(temporaryApp, 'scripts', 'generate.mjs'),
    changedGenerator,
    'utf8',
  );
  const changed = runGenerator(temporaryApp);
  assert.equal(changed.status, 0, changed.stderr || changed.stdout);
  const changedAssets = verifyAssetContract(output);
  assert.notEqual(changedAssets.css, firstAssets.css);
  assert.equal(changedAssets.catalog, firstAssets.catalog);
});
