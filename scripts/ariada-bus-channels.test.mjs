import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import test from "node:test";

import {
  MATRIX_PATH,
  MODULE_DOCS_DIRECTORY,
  ORG_CATALOG_PATH,
  PUBLISHED_CATALOG_SCHEMA_PATH,
  PUBLISHED_SOURCE_SCHEMA_PATH,
  WIKI_CATALOG_PATH,
  buildCatalog,
  buildExpectedFiles,
  createGitRunner,
  generate,
  loadSourceRegistry,
  reconcileExpectedFiles,
  resolveGitExecutable
} from "./ariada-bus-channels.mjs";

import {
  assertNoSensitiveReferences,
  validateCatalog
} from "../packages/ariada-clamper/src/index.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const registry = loadSourceRegistry();
const deliveryModules = registry.modules.filter((module) => module.deliveryEvidence !== null);
const declaredPaths = deliveryModules.flatMap((module) => [
  module.deliveryEvidence.codePath,
  module.deliveryEvidence.landingPath
]);

function hashFor(number) {
  return number.toString(16).padStart(40, "0");
}

function timestampFor(number) {
  return new Date(Date.UTC(2026, 0, number, number % 24, 0, 0)).toISOString();
}

function moduleForPaths(paths) {
  return deliveryModules.find((module) => paths.some((path) => (
    path === module.deliveryEvidence.codePath ||
    path === module.deliveryEvidence.landingPath
  )));
}

function fakeEvidence(options = {}) {
  const main = options.main === true;
  const review = options.review === true;
  const mainCommit = "a".repeat(40);
  const reviewCommit = review ? "b".repeat(40) : null;

  return {
    mainCommit,
    mainFiles: new Set(main ? declaredPaths : []),
    reviewCommit,
    reviewUrl: review ? "https://github.com/ariada-org/ariada/pull/123" : null,
    reviewFiles: new Set(review ? declaredPaths : []),
    indexFiles: new Set(options.index === true ? declaredPaths : []),
    activityAt(commit, paths) {
      const module = moduleForPaths(paths);
      if (!module) {
        return null;
      }
      return {
        commit: hashFor(module.number),
        at: timestampFor(module.number)
      };
    }
  };
}

function assertCanonicalWikiUrl(value, expectedPath) {
  const parsed = new URL(value);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "wiki.ariada.org");
  assert.equal(parsed.pathname, expectedPath);
  assert.equal(parsed.pathname.endsWith("/"), true);
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, "");
}

test("origin-main code and landing evidence produces exactly six Delivered modules", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  assert.equal(deliveryModules.length, 6);
  assert.deepEqual(catalog.counts, {
    total: 236,
    planned: 230,
    inDevelopment: 0,
    delivered: 6,
    production: 0
  });
  assert.deepEqual(
    catalog.packs.map((pack) => [pack.id, pack.moduleCount]),
    [[1, 6], ...Array.from({ length: 23 }, (_, index) => [index + 2, 10])]
  );
  catalog.channels.filter((channel) => channel.state === "Delivered").forEach((channel) => {
    assert.match(channel.publicCodeUrl, /\/tree\/main\//);
    assert.match(channel.githubModuleUrl, /\/blob\/main\//);
    assert.doesNotMatch(channel.deliveryEvidenceUrls[0], /\/main\//);
  });
});

test("review-only evidence is In development and never emits main URLs", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ review: true }));
  assert.equal(catalog.counts.inDevelopment, 6);
  assert.equal(catalog.counts.delivered, 0);
  catalog.channels.filter((channel) => channel.state === "In development").forEach((channel) => {
    assert.equal(channel.publicCodeUrl, null);
    assert.equal(channel.githubModuleUrl, null);
    assert.match(channel.developmentEvidenceUrl, /\/(?:tree|blob)\/[0-9a-f]{40}\//);
    assert.doesNotMatch(channel.developmentEvidenceUrl, /\/main\//);
  });
});

test("index-only and arbitrary local files are not public status evidence", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ index: true }));
  assert.deepEqual(catalog.counts, {
    total: 236,
    planned: 236,
    inDevelopment: 0,
    delivered: 0,
    production: 0
  });
});

test("module timestamps come from their evidence commit or module declaration", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  const delivered = catalog.channels.filter((channel) => channel.state === "Delivered");
  assert.notEqual(delivered[0].updatedAt, delivered[1].updatedAt);
  assert.equal(catalog.channels.find((channel) => channel.state === "Planned").updatedAt, null);

  const declaredRegistry = structuredClone(registry);
  const planned = declaredRegistry.modules.find((module) => module.deliveryEvidence === null);
  planned.updatedAt = "2026-01-01T00:00:00.000Z";
  const declaredCatalog = buildCatalog(declaredRegistry, fakeEvidence());
  assert.equal(declaredCatalog.channels.find((channel) => channel.id === planned.id).state, "Planned");
  assert.equal(declaredCatalog.channels.find((channel) => channel.id === planned.id).updatedAt, planned.updatedAt);
});

test("explicit release evidence is required before Production", () => {
  const productionRegistry = structuredClone(registry);
  productionRegistry.modules.find((module) => module.deliveryEvidence !== null).productionEvidence = {
    releaseUrl: "https://github.com/ariada-org/ariada/releases/tag/v0.1.0",
    evidenceUrl: "https://github.com/ariada-org/ariada/releases/tag/v0.1.0",
    releasedAt: "2026-02-01T00:00:00.000Z"
  };
  const catalog = buildCatalog(productionRegistry, fakeEvidence({ main: true }));
  assert.equal(catalog.counts.production, 1);
  assert.equal(catalog.counts.delivered, 5);
  assert.equal(validateCatalog(catalog), catalog);
});

test("catalog projection is deterministic", () => {
  const evidence = fakeEvidence({ main: true });
  assert.deepEqual(buildCatalog(registry, evidence), buildCatalog(registry, evidence));
});

test("both app projections receive byte-identical JSON", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  const expected = buildExpectedFiles(catalog);
  assert.equal(expected.get(ORG_CATALOG_PATH), expected.get(WIKI_CATALOG_PATH));
});

test("published schema projections are generated with the catalog", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  const expected = buildExpectedFiles(catalog);
  assert.ok(expected.get(PUBLISHED_SOURCE_SCHEMA_PATH));
  assert.ok(expected.get(PUBLISHED_CATALOG_SCHEMA_PATH));
});

test("Wiki URLs are lowercase and trailing-slash canonical", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  assertCanonicalWikiUrl(catalog.wiki.baseUrl, "/");
  Object.entries(catalog.wiki.localeLinks).forEach(([locale, url]) => {
    assertCanonicalWikiUrl(url, "/" + locale + "/modules/");
  });
  for (const locale of ["pt-BR", "zh-CN", "zh-TW"]) {
    if (catalog.wiki.locales.includes(locale)) {
      assert.equal(catalog.wiki.localeLinks[locale], "https://wiki.ariada.org/" + locale + "/modules/");
    }
  }
  catalog.channels.forEach((channel) => {
    assertCanonicalWikiUrl(
      channel.wikiUrl,
      "/" + catalog.wiki.defaultLocale + "/modules/" + channel.id.toLowerCase() + "/"
    );
    assert.equal(channel.ariadaModuleUrl, "https://ariada.org/modules/" + channel.id.toLowerCase() + "/");
    assert.notEqual(channel.wikiUrl, channel.ariadaModuleUrl);
  });
});

test("every module document has complete sections and lowercase links", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  const expected = buildExpectedFiles(catalog);
  const generatedDocPaths = [...expected.keys()].filter((path) => path.startsWith(MODULE_DOCS_DIRECTORY + "/"));

  assert.equal(generatedDocPaths.length, 236);
  generatedDocPaths.forEach((path) => assert.match(path, /^docs\/channel-modules\/s[1-9][0-9]*\.md$/));

  catalog.channels.forEach((channel) => {
    const document = expected.get(MODULE_DOCS_DIRECTORY + "/" + channel.id.toLowerCase() + ".md");
    assert.match(document, /^## Roles$/m);
    assert.match(document, /^## Boundary$/m);
    assert.match(document, /^## Use cases$/m);
    assert.match(document, /^## Installation$/m);
    assert.match(document, /^## Evidence$/m);
    assert.match(document, /^## Ariada Wiki$/m);
    assert.ok(document.includes(channel.description));
    assert.ok(document.includes(channel.boundary));
    assert.ok(document.includes(channel.installation));
    assert.match(document, /\[Read the Ariada Wiki guide\]\(https:\/\/wiki\.ariada\.org\/[A-Za-z0-9-]+\/modules\/s[1-9][0-9]*\/\)/);
  });

  const matrix = expected.get(MATRIX_PATH);
  assert.doesNotMatch(matrix, /docs\/channel-modules\/S[1-9][0-9]*\.md/);
  assert.equal((matrix.match(/docs\/channel-modules\/s[1-9][0-9]*\.md/g) || []).length, 236);
});

test("generated docs on disk use exactly 236 lowercase filenames", () => {
  const filenames = readdirSync(resolve(ROOT, MODULE_DOCS_DIRECTORY))
    .filter((name) => /^s[1-9][0-9]*\.md$/i.test(name));
  assert.equal(filenames.length, 236);
  filenames.forEach((name) => assert.match(name, /^s[1-9][0-9]*\.md$/));
});

test("git commands ignore attacker-controlled PATH executables", () => {
  const unsafeDirectory = mkdtempSync(join(tmpdir(), "ariada-git-path-"));
  const fakeGit = join(unsafeDirectory, process.platform === "win32" ? "git.exe" : "git");
  const originalPath = process.env.PATH;

  writeFileSync(fakeGit, process.platform === "win32" ? "not an executable" : "#!/bin/sh\nexit 97\n", "utf8");
  if (process.platform !== "win32") {
    chmodSync(fakeGit, 0o755);
  }

  try {
    process.env.PATH = unsafeDirectory + (originalPath ? delimiter + originalPath : "");
    const trustedGit = resolveGitExecutable();
    assert.equal(isAbsolute(trustedGit), true);
    assert.notEqual(trustedGit, fakeGit);
    assert.match(createGitRunner()(["--version"]), /^git version \d/);
    assert.throws(() => createGitRunner({ gitExecutable: "git" }), /must be absolute/);
  } finally {
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    rmSync(unsafeDirectory, { recursive: true, force: true });
  }
});

test("Wiki projection is deliverable despite the repository data ignore rule", () => {
  const runGit = createGitRunner({ cwd: ROOT });
  const deliverable = runGit(
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", WIKI_CATALOG_PATH]
  ).split("\n").filter(Boolean);
  assert.deepEqual(deliverable, [WIKI_CATALOG_PATH]);

  assert.throws(
    () => runGit(["check-ignore", "--quiet", "--", WIKI_CATALOG_PATH]),
    (error) => error?.status === 1
  );
});

test("workflow uses only verified immutable official action commits", () => {
  const workflow = readFileSync(resolve(ROOT, ".github/workflows/channel-matrix.yml"), "utf8");
  const expected = new Map([
    ["actions/checkout", "34e114876b0b11c390a56381ad16ebd13914f8d5"],
    ["pnpm/action-setup", "fc06bc1257f339d1d5d8b3a19a8cae5388b55320"],
    ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
    ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"]
  ]);
  const uses = [...workflow.matchAll(/uses:\s+([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s#]+)/g)];
  assert.equal(uses.length, expected.size);
  uses.forEach((match) => {
    assert.equal(match[2], expected.get(match[1]));
    assert.match(match[2], /^[0-9a-f]{40}$/);
  });
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.doesNotMatch(workflow, /contents:\s+write|pull-requests:\s+write|packages:\s+write/);
});

test("generated public runtime surfaces satisfy generic DLP categories", () => {
  const catalog = buildCatalog(registry, fakeEvidence({ main: true }));
  const expected = buildExpectedFiles(catalog);
  assertNoSensitiveReferences(catalog);
  for (const [path, content] of expected) {
    if (!path.includes("/schemas/")) {
      assertNoSensitiveReferences({ content });
    }
  }
});

test("committed artifacts reconcile with canonical public git evidence", () => {
  const { catalog, expected } = generate();
  assert.equal(validateCatalog(catalog), catalog);
  assert.deepEqual(reconcileExpectedFiles(expected), []);

  const orgProjection = readFileSync(resolve(ROOT, ORG_CATALOG_PATH), "utf8");
  const wikiProjection = readFileSync(resolve(ROOT, WIKI_CATALOG_PATH), "utf8");
  assert.equal(orgProjection, wikiProjection);
});
