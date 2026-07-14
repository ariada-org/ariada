#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_REPOSITORY,
  CATALOG_SCHEMA_URL,
  LOCALIZATION_CONTRACT,
  PUBLIC_WIKI_LOCALES,
  SOURCE_REGISTRY_SCHEMA_URL,
  computeCatalogSnapshotHash,
  validateCatalog,
  validateSourceRegistry
} from "../packages/ariada-clamper/src/index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const SOURCE_REGISTRY_PATH = "config/ariada-channel-source.json";
export const ORG_CATALOG_PATH = "apps/ariada-org/public/channel-matrix.json";
export const WIKI_CATALOG_PATH = "apps/ariada-wiki/data/channel-matrix.json";
export const MATRIX_PATH = "CHANNEL_MATRIX.md";
export const LLMS_PATH = "apps/ariada-org/public/llms.txt";
export const MODULE_DOCS_DIRECTORY = "docs/channel-modules";
export const CANONICAL_SOURCE_SCHEMA_PATH = "packages/ariada-clamper/schema/channel-source-registry-v1.json";
export const CANONICAL_CATALOG_SCHEMA_PATH = "packages/ariada-clamper/schema/public-module-catalog-v1.json";
export const PUBLISHED_SOURCE_SCHEMA_PATH = "apps/ariada-org/public/schemas/channel-source-registry/v1.json";
export const PUBLISHED_CATALOG_SCHEMA_PATH = "apps/ariada-org/public/schemas/public-module-catalog/v1.json";

const RAW_REGISTRY_URL = "https://raw.githubusercontent.com/ariada-org/ariada/main/" + SOURCE_REGISTRY_PATH;
const MAIN_REF = "refs/remotes/origin/main";
const REVIEW_COMMIT_ENV = "ARIADA_REVIEW_COMMIT";
const REVIEW_URL_ENV = "ARIADA_REVIEW_URL";
const FIXED_GIT_EXECUTABLES = Object.freeze(
  process.platform === "win32"
    ? [
        String.raw`C:\Program Files\Git\cmd\git.exe`,
        String.raw`C:\Program Files\Git\bin\git.exe`,
        String.raw`C:\Program Files (x86)\Git\cmd\git.exe`
      ]
    : [
        "/usr/bin/git",
        "/bin/git",
        "/usr/local/bin/git",
        "/opt/homebrew/bin/git",
        "/opt/local/bin/git"
      ]
);

function fail(message) {
  throw new Error(message);
}

export function resolveGitExecutable() {
  const executable = FIXED_GIT_EXECUTABLES.find((candidate) => (
    isAbsolute(candidate) && existsSync(candidate)
  ));
  if (!executable) {
    fail("Git was not found at an approved absolute path for " + process.platform);
  }
  return executable;
}

export function createGitRunner(options = {}) {
  const gitExecutable = options.gitExecutable ?? resolveGitExecutable();
  const cwd = options.cwd ?? ROOT;

  if (typeof gitExecutable !== "string" || !isAbsolute(gitExecutable)) {
    fail("Git executable path must be absolute");
  }
  if (!existsSync(gitExecutable)) {
    fail("Git executable does not exist: " + gitExecutable);
  }
  if (typeof cwd !== "string" || !isAbsolute(cwd)) {
    fail("Git working directory must be absolute");
  }

  return function runGitCommand(args, commandOptions = {}) {
    const output = execFileSync(gitExecutable, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return commandOptions.trim === false ? output : output.trim();
  };
}

const runGit = createGitRunner();

function normalizeOrigin(value) {
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function resolveCommit(ref) {
  const commit = runGit(["rev-parse", "--verify", ref + "^{commit}"]);
  if (!/^[0-9a-f]{40}$/.test(commit)) {
    fail("Unable to resolve a full public git commit for " + ref);
  }
  return commit;
}

function readTree(commit) {
  const output = runGit(["ls-tree", "-r", "-z", "--name-only", commit], { trim: false });
  return new Set(output.split("\0").filter(Boolean));
}

function normalizeTimestamp(value) {
  return new Date(value).toISOString();
}

function treeContains(files, path) {
  if (files.has(path)) {
    return true;
  }
  const prefix = path.endsWith("/") ? path : path + "/";
  for (const file of files) {
    if (file.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

function latestActivity(commit, paths) {
  if (paths.length === 0) {
    return null;
  }

  const output = runGit([
    "log",
    "-1",
    "--format=%H%x09%cI",
    commit,
    "--",
    ...paths
  ]);

  if (!output) {
    return null;
  }

  const separator = output.indexOf("\t");
  if (separator < 0) {
    fail("Public git evidence did not include a commit timestamp");
  }

  const evidenceCommit = output.slice(0, separator);
  const timestamp = output.slice(separator + 1);
  if (!/^[0-9a-f]{40}$/.test(evidenceCommit) || Number.isNaN(Date.parse(timestamp))) {
    fail("Public git evidence was malformed");
  }

  return {
    commit: evidenceCommit,
    at: normalizeTimestamp(timestamp)
  };
}

function readReviewEvidence() {
  const requestedCommit = process.env[REVIEW_COMMIT_ENV] || "";
  const requestedUrl = process.env[REVIEW_URL_ENV] || "";

  if (!requestedCommit && !requestedUrl) {
    return {
      reviewCommit: null,
      reviewUrl: null,
      reviewFiles: new Set()
    };
  }

  if (!requestedCommit || !requestedUrl) {
    fail(REVIEW_COMMIT_ENV + " and " + REVIEW_URL_ENV + " must be supplied together");
  }

  if (!/^https:\/\/github\.com\/ariada-org\/ariada\/pull\/[1-9][0-9]*$/.test(requestedUrl)) {
    fail(REVIEW_URL_ENV + " must identify a canonical public pull request");
  }

  const reviewCommit = resolveCommit(requestedCommit);
  return {
    reviewCommit,
    reviewUrl: requestedUrl,
    reviewFiles: readTree(reviewCommit)
  };
}

export function readPublicGitEvidence() {
  const origin = normalizeOrigin(runGit(["remote", "get-url", "origin"]));
  if (origin !== CANONICAL_REPOSITORY) {
    fail("origin must be the canonical public repository: " + CANONICAL_REPOSITORY);
  }

  const mainCommit = resolveCommit(MAIN_REF);
  const review = readReviewEvidence();

  return {
    mainCommit,
    mainFiles: readTree(mainCommit),
    reviewCommit: review.reviewCommit,
    reviewUrl: review.reviewUrl,
    reviewFiles: review.reviewFiles,
    activityAt: latestActivity
  };
}

function evidencePaths(module) {
  const paths = [];
  if (module.developmentEvidence) {
    paths.push(module.developmentEvidence.path);
  }
  if (module.deliveryEvidence) {
    paths.push(module.deliveryEvidence.codePath, module.deliveryEvidence.landingPath);
  }
  return [...new Set(paths)];
}

function commitUrl(commit, path, kind) {
  return CANONICAL_REPOSITORY + "/" + kind + "/" + commit + "/" + path;
}

function mainUrl(path, kind) {
  return CANONICAL_REPOSITORY + "/" + kind + "/main/" + path;
}

function moduleWikiUrl(registry, module) {
  return registry.localization.baseUrl + registry.localization.defaultLocale + "/modules/" + module.id.toLowerCase() + "/";
}

function explicitUpdatedAt(module) {
  return module.updatedAt === null ? null : normalizeTimestamp(module.updatedAt);
}

function maxTimestamp(values) {
  const normalized = values.filter(Boolean).map(normalizeTimestamp).sort();
  return normalized.length === 0 ? null : normalized.at(-1);
}

function lifecycleFor(module, evidence) {
  const delivery = module.deliveryEvidence;
  const development = module.developmentEvidence;
  const mainDeliveryPaths = delivery ? [delivery.codePath, delivery.landingPath] : [];
  const completeOnMain = delivery
    ? mainDeliveryPaths.every((path) => treeContains(evidence.mainFiles, path))
    : false;

  if (completeOnMain) {
    const activity = evidence.activityAt(evidence.mainCommit, mainDeliveryPaths);
    if (activity) {
      const codeEvidenceUrl = commitUrl(activity.commit, delivery.codePath, "tree");
      const landingEvidenceUrl = commitUrl(activity.commit, delivery.landingPath, "blob");
      const production = module.productionEvidence;

      if (production) {
        return {
          state: "Production",
          evidenceCommit: activity.commit,
          updatedAt: maxTimestamp([activity.at, production.releasedAt]),
          developmentStarted: null,
          landed: activity.at,
          published: normalizeTimestamp(production.releasedAt),
          developmentEvidenceUrl: null,
          deliveryEvidenceUrls: [codeEvidenceUrl, landingEvidenceUrl],
          productionEvidenceUrl: production.evidenceUrl,
          publicationUrl: production.releaseUrl,
          evidenceUrl: codeEvidenceUrl,
          publicCodeUrl: mainUrl(delivery.codePath, "tree"),
          githubModuleUrl: mainUrl(delivery.landingPath, "blob")
        };
      }

      return {
        state: "Delivered",
        evidenceCommit: activity.commit,
        updatedAt: activity.at,
        developmentStarted: null,
        landed: activity.at,
        published: null,
        developmentEvidenceUrl: null,
        deliveryEvidenceUrls: [codeEvidenceUrl, landingEvidenceUrl],
        productionEvidenceUrl: null,
        publicationUrl: null,
        evidenceUrl: codeEvidenceUrl,
        publicCodeUrl: mainUrl(delivery.codePath, "tree"),
        githubModuleUrl: mainUrl(delivery.landingPath, "blob")
      };
    }
  }

  const mainCandidates = evidencePaths(module).filter((path) => treeContains(evidence.mainFiles, path));
  if (mainCandidates.length > 0) {
    const activity = evidence.activityAt(evidence.mainCommit, mainCandidates);
    if (activity) {
      const selected = mainCandidates[0];
      const kind = evidence.mainFiles.has(selected) ? "blob" : "tree";
      const developmentEvidenceUrl = commitUrl(activity.commit, selected, kind);
      return {
        state: "In development",
        evidenceCommit: activity.commit,
        updatedAt: activity.at,
        developmentStarted: activity.at,
        landed: null,
        published: null,
        developmentEvidenceUrl,
        deliveryEvidenceUrls: [],
        productionEvidenceUrl: null,
        publicationUrl: null,
        evidenceUrl: developmentEvidenceUrl,
        publicCodeUrl: null,
        githubModuleUrl: null
      };
    }
  }

  if (evidence.reviewCommit && evidence.reviewUrl) {
    const reviewCandidates = evidencePaths(module).filter((path) => treeContains(evidence.reviewFiles, path));
    if (reviewCandidates.length > 0) {
      const activity = evidence.activityAt(evidence.reviewCommit, reviewCandidates);
      if (activity) {
        const selected = reviewCandidates[0];
        const kind = evidence.reviewFiles.has(selected) ? "blob" : "tree";
        const developmentEvidenceUrl = commitUrl(activity.commit, selected, kind);
        return {
          state: "In development",
          evidenceCommit: activity.commit,
          updatedAt: activity.at,
          developmentStarted: activity.at,
          landed: null,
          published: null,
          developmentEvidenceUrl,
          deliveryEvidenceUrls: [],
          productionEvidenceUrl: null,
          publicationUrl: null,
          evidenceUrl: developmentEvidenceUrl,
          publicCodeUrl: null,
          githubModuleUrl: null
        };
      }
    }
  }

  return {
    state: "Planned",
    evidenceCommit: null,
    updatedAt: explicitUpdatedAt(module),
    developmentStarted: null,
    landed: null,
    published: null,
    developmentEvidenceUrl: null,
    deliveryEvidenceUrls: [],
    productionEvidenceUrl: null,
    publicationUrl: null,
    evidenceUrl: null,
    publicCodeUrl: null,
    githubModuleUrl: null
  };
}

function statusMetadata(state) {
  if (state === "Planned") {
    return {
      distributionStatus: "Not available",
      deploymentStatus: "Not deployed"
    };
  }

  if (state === "In development") {
    return {
      distributionStatus: "Public development evidence",
      deploymentStatus: "Not deployed"
    };
  }

  if (state === "Delivered") {
    return {
      distributionStatus: "Public source",
      deploymentStatus: "Not deployed"
    };
  }

  return {
    distributionStatus: "Public release",
    deploymentStatus: "Production"
  };
}

function buildChannel(registry, module, evidence) {
  const lifecycle = lifecycleFor(module, evidence);
  const metadata = statusMetadata(lifecycle.state);
  const wikiUrl = moduleWikiUrl(registry, module);

  return {
    id: module.id,
    number: module.number,
    name: module.name,
    description: module.description,
    boundary: module.boundary,
    roles: [...module.roles],
    useCases: [...module.useCases],
    installation: module.installation,
    wikiUrl,
    pack: module.pack,
    state: lifecycle.state,
    distributionStatus: metadata.distributionStatus,
    deploymentStatus: metadata.deploymentStatus,
    developmentStarted: lifecycle.developmentStarted,
    landed: lifecycle.landed,
    published: lifecycle.published,
    evidenceCommit: lifecycle.evidenceCommit,
    developmentEvidenceUrl: lifecycle.developmentEvidenceUrl,
    deliveryEvidenceUrls: lifecycle.deliveryEvidenceUrls,
    productionEvidenceUrl: lifecycle.productionEvidenceUrl,
    publicationUrl: lifecycle.publicationUrl,
    evidenceUrl: lifecycle.evidenceUrl,
    updatedAt: lifecycle.updatedAt,
    ariadaModuleUrl: "https://ariada.org/modules/" + module.id.toLowerCase() + "/",
    githubModuleUrl: lifecycle.githubModuleUrl,
    publicCodeUrl: lifecycle.publicCodeUrl
  };
}

function countStates(channels) {
  return {
    total: channels.length,
    planned: channels.filter((channel) => channel.state === "Planned").length,
    inDevelopment: channels.filter((channel) => channel.state === "In development").length,
    delivered: channels.filter((channel) => channel.state === "Delivered").length,
    production: channels.filter((channel) => channel.state === "Production").length
  };
}

function buildPacks(channels) {
  const packs = [];
  for (const channel of channels) {
    let pack = packs.at(-1);
    if (!pack || pack.id !== channel.pack) {
      pack = {
        id: channel.pack,
        moduleCount: 0,
        moduleIds: [],
        counts: null
      };
      packs.push(pack);
    }
    pack.moduleIds.push(channel.id);
    pack.moduleCount += 1;
  }

  packs.forEach((pack) => {
    const members = pack.moduleIds.map((id) => channels.find((channel) => channel.id === id));
    pack.counts = countStates(members);
  });

  return packs;
}

export function buildCatalog(registry, evidence) {
  validateSourceRegistry(registry);

  if (!/^[0-9a-f]{40}$/.test(evidence.mainCommit)) {
    fail("Public evidence must pin origin/main to a full commit");
  }
  if (!(evidence.mainFiles instanceof Set) || !(evidence.reviewFiles instanceof Set)) {
    fail("Public evidence trees must be explicit git tree sets");
  }
  if (typeof evidence.activityAt !== "function") {
    fail("Public evidence must provide git commit activity");
  }
  if ((evidence.reviewCommit === null) !== (evidence.reviewUrl === null)) {
    fail("Review commit and public review URL must be supplied together");
  }

  const channels = registry.modules.map((module) => buildChannel(registry, module, evidence));
  const wiki = {
    baseUrl: registry.localization.baseUrl,
    defaultLocale: registry.localization.defaultLocale,
    locales: [...PUBLIC_WIKI_LOCALES],
    localeLinks: Object.fromEntries(
      PUBLIC_WIKI_LOCALES.map((locale) => [
        locale,
        registry.localization.baseUrl + locale + "/modules/"
      ])
    )
  };

  const catalog = {
    $schema: registry.catalogSchema,
    version: 1,
    generatedAt: maxTimestamp([
      registry.declaredAt,
      ...channels.map((channel) => channel.updatedAt)
    ]),
    snapshotHash: "",
    source: {
      repository: registry.repository,
      branch: registry.defaultBranch,
      commit: evidence.mainCommit,
      registry: RAW_REGISTRY_URL,
      registrySchema: registry.$schema,
      catalogSchema: registry.catalogSchema,
      registryDeclaredAt: normalizeTimestamp(registry.declaredAt),
      localizationPackage: registry.localization.package,
      localizationVersion: registry.localization.version,
      localesExport: registry.localization.localesExport,
      packCount: 24
    },
    wiki,
    counts: countStates(channels),
    packs: buildPacks(channels),
    channels
  };

  catalog.snapshotHash = computeCatalogSnapshotHash(catalog);
  validateCatalog(catalog);
  return catalog;
}

function escapeMarkdown(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function evidenceMarkdown(channel) {
  const lines = [
    "- State: " + channel.state,
    "- Updated from evidence: " + (channel.updatedAt || "Not available")
  ];

  if (channel.developmentEvidenceUrl) {
    lines.push("- [Pinned development evidence](" + channel.developmentEvidenceUrl + ")");
  }

  channel.deliveryEvidenceUrls.forEach((url, index) => {
    const label = index === 0 ? "Pinned code evidence" : "Pinned landing evidence";
    lines.push("- [" + label + "](" + url + ")");
  });

  if (channel.publicationUrl) {
    lines.push("- [Published release](" + channel.publicationUrl + ")");
  }

  if (channel.productionEvidenceUrl) {
    lines.push("- [Production evidence](" + channel.productionEvidenceUrl + ")");
  }

  if (!channel.evidenceUrl) {
    lines.push("- No qualifying public implementation evidence is declared and present on the canonical public tree.");
  }

  return lines;
}

function installationMarkdown(channel) {
  return [channel.installation];
}

function renderModuleDoc(channel) {
  return [
    "# " + channel.id + ": " + channel.name,
    "",
    channel.description,
    "",
    "## Boundary",
    "",
    channel.boundary,
    "",
    "## Roles",
    "",
    ...channel.roles.map((role) => "- " + role),
    "",
    "## Use cases",
    "",
    ...channel.useCases.map((useCase) => "- " + useCase),
    "",
    "## Installation",
    "",
    ...installationMarkdown(channel),
    "",
    "## Evidence",
    "",
    ...evidenceMarkdown(channel),
    "",
    "## Ariada Wiki",
    "",
    "[Read the Ariada Wiki guide](" + channel.wikiUrl + ")",
    ""
  ].join("\n");
}

function renderMatrix(catalog) {
  const lines = [
    "# Ariada Wiki Channel Matrix",
    "",
    "This file is generated from the sanitized public source registry and git evidence pinned to the canonical public repository.",
    "",
    "- Public source commit: [" + catalog.source.commit + "](" + CANONICAL_REPOSITORY + "/tree/" + catalog.source.commit + ")",
    "- Generated from explicit source or evidence: " + catalog.generatedAt,
    "- Modules: " + catalog.counts.total,
    "- Packs: " + catalog.packs.length,
    "- Planned: " + catalog.counts.planned,
    "- In development: " + catalog.counts.inDevelopment,
    "- Delivered: " + catalog.counts.delivered,
    "- Production: " + catalog.counts.production,
    "",
    "Delivered requires both declared code and landing paths in the pinned origin/main tree plus a git commit timestamp for those paths. Production additionally requires an explicit public release tag and release evidence. Review-only evidence remains In development and uses a commit-pinned URL.",
    "",
    "| ID | Module | Pack | State | Updated from evidence | Public evidence |",
    "| --- | --- | --- | --- | --- | --- |"
  ];

  catalog.channels.forEach((channel) => {
    const evidence = channel.evidenceUrl
      ? "[Evidence](" + channel.evidenceUrl + ")"
      : "No qualifying public evidence";
    lines.push(
      "| [" + channel.id + "](docs/channel-modules/" + channel.id.toLowerCase() + ".md) | " +
      escapeMarkdown(channel.name) + " | " +
      escapeMarkdown(String(channel.pack)) + " | " +
      channel.state + " | " +
      (channel.updatedAt || "Not available") + " | " +
      evidence + " |"
    );
  });

  lines.push("");
  return lines.join("\n");
}

function renderLlms(catalog) {
  const lines = [
    "# Ariada Wiki",
    "",
    "> Deterministic public documentation for the Ariada module catalog.",
    "",
    "Canonical repository: " + CANONICAL_REPOSITORY,
    "Pinned public source commit: " + catalog.source.commit,
    "Catalog schema: " + catalog.$schema,
    "",
    "## Catalog",
    "",
    "- [Channel matrix](https://ariada.org/channel-matrix.json): " + catalog.counts.total + " modules across " + catalog.packs.length + " packs.",
    "- [Ariada Wiki](" + catalog.wiki.localeLinks[catalog.wiki.defaultLocale] + "): localized channel documentation.",
    "",
    "## Modules",
    ""
  ];

  catalog.channels.forEach((channel) => {
    lines.push("- [" + channel.id + ": " + channel.name + "](" + channel.wikiUrl + ") - " + channel.state + ". " + channel.description + " Boundary: " + channel.boundary);
  });

  lines.push("");
  return lines.join("\n");
}

export function buildExpectedFiles(catalog) {
  const projection = JSON.stringify(catalog, null, 2) + "\n";
  const sourceSchemaProjection = readFileSync(resolve(ROOT, CANONICAL_SOURCE_SCHEMA_PATH), "utf8");
  const catalogSchemaProjection = readFileSync(resolve(ROOT, CANONICAL_CATALOG_SCHEMA_PATH), "utf8");
  JSON.parse(sourceSchemaProjection);
  JSON.parse(catalogSchemaProjection);
  const expected = new Map([
    [ORG_CATALOG_PATH, projection],
    [WIKI_CATALOG_PATH, projection],
    [MATRIX_PATH, renderMatrix(catalog)],
    [LLMS_PATH, renderLlms(catalog)],
    [PUBLISHED_SOURCE_SCHEMA_PATH, sourceSchemaProjection],
    [PUBLISHED_CATALOG_SCHEMA_PATH, catalogSchemaProjection]
  ]);

  catalog.channels.forEach((channel) => {
    expected.set(MODULE_DOCS_DIRECTORY + "/" + channel.id.toLowerCase() + ".md", renderModuleDoc(channel));
  });

  return expected;
}

export function reconcileExpectedFiles(expected) {
  const drift = [];
  for (const [relativePath, content] of expected) {
    const absolutePath = resolve(ROOT, relativePath);
    if (!existsSync(absolutePath) || readFileSync(absolutePath, "utf8") !== content) {
      drift.push(relativePath);
    }
  }

  const expectedDocs = new Set(
    [...expected.keys()]
      .filter((path) => path.startsWith(MODULE_DOCS_DIRECTORY + "/"))
      .map((path) => basename(path))
  );
  const docsDirectory = resolve(ROOT, MODULE_DOCS_DIRECTORY);
  if (existsSync(docsDirectory)) {
    for (const filename of readdirSync(docsDirectory)) {
      if (/^s[1-9][0-9]*\.md$/i.test(filename) && !expectedDocs.has(filename)) {
        drift.push(MODULE_DOCS_DIRECTORY + "/" + filename);
      }
    }
  }
  return drift;
}

function normalizeGeneratedModuleDocFilenames() {
  const docsDirectory = resolve(ROOT, MODULE_DOCS_DIRECTORY);
  if (!existsSync(docsDirectory)) {
    return;
  }

  for (const filename of readdirSync(docsDirectory)) {
    if (!/^s[1-9][0-9]*\.md$/i.test(filename) || filename === filename.toLowerCase()) {
      continue;
    }
    const temporary = resolve(docsDirectory, ".ariada-case-" + filename.toLowerCase());
    renameSync(resolve(docsDirectory, filename), temporary);
    renameSync(temporary, resolve(docsDirectory, filename.toLowerCase()));
  }
}

export function writeExpectedFiles(expected) {
  normalizeGeneratedModuleDocFilenames();
  for (const [relativePath, content] of expected) {
    const absolutePath = resolve(ROOT, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }

  const expectedDocs = new Set(
    [...expected.keys()]
      .filter((path) => path.startsWith(MODULE_DOCS_DIRECTORY + "/"))
      .map((path) => basename(path))
  );
  const docsDirectory = resolve(ROOT, MODULE_DOCS_DIRECTORY);
  for (const filename of readdirSync(docsDirectory)) {
    if (/^s[1-9][0-9]*\.md$/i.test(filename) && !expectedDocs.has(filename)) {
      unlinkSync(resolve(docsDirectory, filename));
    }
  }
}

export function loadSourceRegistry() {
  return JSON.parse(readFileSync(resolve(ROOT, SOURCE_REGISTRY_PATH), "utf8"));
}

export function generate(options = {}) {
  const registry = options.registry || loadSourceRegistry();
  const evidence = options.evidence || readPublicGitEvidence();
  const catalog = buildCatalog(registry, evidence);
  return {
    catalog,
    expected: buildExpectedFiles(catalog)
  };
}

function printSummary(catalog) {
  process.stdout.write(
    [
      "Ariada channel matrix",
      "source=" + catalog.source.commit,
      "modules=" + catalog.counts.total,
      "packs=" + catalog.packs.length,
      "planned=" + catalog.counts.planned,
      "inDevelopment=" + catalog.counts.inDevelopment,
      "delivered=" + catalog.counts.delivered,
      "production=" + catalog.counts.production
    ].join(" ") + "\n"
  );
}

function runCli() {
  const args = new Set(process.argv.slice(2));
  const allowed = new Set(["--check", "--fix", "--summary"]);
  for (const arg of args) {
    if (!allowed.has(arg)) {
      fail("Unsupported argument: " + arg);
    }
  }

  if (!args.has("--check") && !args.has("--fix") && !args.has("--summary")) {
    args.add("--summary");
  }

  const { catalog, expected } = generate();

  if (args.has("--fix")) {
    writeExpectedFiles(expected);
  }

  if (args.has("--check")) {
    const drift = reconcileExpectedFiles(expected);
    if (drift.length > 0) {
      process.stderr.write("Generated channel artifacts are stale:\n" + drift.map((path) => "- " + path).join("\n") + "\n");
      process.exitCode = 1;
    }
  }

  printSummary(catalog);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
