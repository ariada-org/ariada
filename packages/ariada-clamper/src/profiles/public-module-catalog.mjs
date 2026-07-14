import { createHash } from "node:crypto";

import {
  LOCALIZATION_CONTRACT,
  PUBLIC_WIKI_LOCALES
} from "../localization-contract.mjs";

export const CANONICAL_REPOSITORY = "https://github.com/ariada-org/ariada";
export const CATALOG_SCHEMA_URL = "https://ariada.org/schemas/public-module-catalog/v1.json";
export const SOURCE_REGISTRY_SCHEMA_URL = "https://ariada.org/schemas/channel-source-registry/v1.json";

const RAW_REPOSITORY_PREFIX = "https://raw.githubusercontent.com/ariada-org/ariada/";
const WIKI_BASE_URL = "https://wiki.ariada.org/";
const ARIADA_MODULE_BASE_URL = "https://ariada.org/modules/";
const PUBLIC_MATRIX_ASSET_URL = "https://ariada.org/channel-matrix.json";

const SOURCE_KEYS = [
  "$schema",
  "catalogSchema",
  "declaredAt",
  "defaultBranch",
  "localization",
  "modules",
  "repository",
  "version"
];

const LOCALIZATION_KEYS = [
  "baseUrl",
  "defaultLocale",
  "localesExport",
  "package",
  "version"
];

const MODULE_KEYS = [
  "boundary",
  "deliveryEvidence",
  "description",
  "developmentEvidence",
  "id",
  "installation",
  "name",
  "number",
  "pack",
  "productionEvidence",
  "roles",
  "updatedAt",
  "useCases"
];

const CATALOG_KEYS = [
  "$schema",
  "channels",
  "counts",
  "generatedAt",
  "packs",
  "snapshotHash",
  "source",
  "version",
  "wiki"
];

const CATALOG_SOURCE_KEYS = [
  "branch",
  "catalogSchema",
  "commit",
  "localesExport",
  "localizationPackage",
  "localizationVersion",
  "packCount",
  "registry",
  "registryDeclaredAt",
  "registrySchema",
  "repository"
];

const WIKI_KEYS = [
  "baseUrl",
  "defaultLocale",
  "localeLinks",
  "locales"
];

const COUNT_KEYS = [
  "delivered",
  "inDevelopment",
  "planned",
  "production",
  "total"
];

const PACK_KEYS = [
  "counts",
  "id",
  "moduleCount",
  "moduleIds"
];

const CHANNEL_KEYS = [
  "ariadaModuleUrl",
  "boundary",
  "deliveryEvidenceUrls",
  "deploymentStatus",
  "description",
  "developmentEvidenceUrl",
  "developmentStarted",
  "distributionStatus",
  "evidenceCommit",
  "evidenceUrl",
  "githubModuleUrl",
  "id",
  "installation",
  "landed",
  "name",
  "number",
  "pack",
  "productionEvidenceUrl",
  "publicCodeUrl",
  "publicationUrl",
  "published",
  "roles",
  "state",
  "updatedAt",
  "useCases",
  "wikiUrl"
];

const STATUS_CONTRACT = Object.freeze({
  Planned: {
    distributionStatus: "Not available",
    deploymentStatus: "Not deployed"
  },
  "In development": {
    distributionStatus: "Public development evidence",
    deploymentStatus: "Not deployed"
  },
  Delivered: {
    distributionStatus: "Public source",
    deploymentStatus: "Not deployed"
  },
  Production: {
    distributionStatus: "Public release",
    deploymentStatus: "Production"
  }
});

const DLP_RULES = Object.freeze([
  {
    category: "retired wiki authority",
    pattern: /https:\/\/ariada\.org\/wiki(?:[/?#"]|$)/i
  },
  {
    category: "filesystem URL",
    pattern: /\bfile:\/\//i
  },
  {
    category: "absolute home path",
    pattern: /\/(?:Users|home)\/[^/"\s]+/i
  },
  {
    category: "absolute drive path",
    pattern: /\b[A-Za-z]:\\[^"\r\n]+/
  },
  {
    category: "private or internal path",
    pattern: /(?:^|[\\/])(?:private|internal)(?:[\\/])/i
  },
  {
    category: "private project label",
    pattern: /\b(?:private|internal)[ _-](?:brand|project|repo|repository)\b/i
  },
  {
    category: "planning or handoff artifact",
    pattern: /\b(?:prd|handoff)\b/i
  }
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertRecord(value, label) {
  assert(isRecord(value), label + " must be an object");
}

function assertExactKeys(value, expected, label) {
  assertRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(wanted),
    label + " has unexpected schema keys: " + actual.join(", ")
  );
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.trim() === value && value.length > 0, label + " must be a non-empty trimmed string");
}

function expectedPack(number) {
  return number <= 6 ? 1 : Math.floor((number - 7) / 10) + 2;
}

function assertNullableString(value, label) {
  assert(value === null || typeof value === "string", label + " must be null or a string");
}

function assertStringArray(value, label, options = {}) {
  const minimum = options.minimum ?? 0;
  assert(Array.isArray(value) && value.length >= minimum, label + " must be an array with at least " + minimum + " entries");
  value.forEach((item, index) => assertNonEmptyString(item, label + "[" + index + "]"));
  assert(new Set(value).size === value.length, label + " must not contain duplicates");
}

function assertIsoTimestamp(value, label, nullable = false) {
  if (nullable && value === null) {
    return;
  }

  assertNonEmptyString(value, label);
  assert(!Number.isNaN(Date.parse(value)), label + " must be an ISO timestamp");
}

function assertSha(value, label, nullable = false) {
  if (nullable && value === null) {
    return;
  }

  assert(typeof value === "string" && /^[0-9a-f]{40}$/.test(value), label + " must be a full lowercase git commit");
}

function assertRepoPath(value, label) {
  assertNonEmptyString(value, label);
  assert(!value.startsWith("/") && !value.startsWith("./"), label + " must be repository-relative");
  assert(!value.includes("..") && !value.includes("\\") && !value.includes("://"), label + " must be a canonical repository path");
  assert(/^(?:apps|docs|packages)\//.test(value), label + " must be under apps/, docs/, or packages/");
  assert(!/(?:^|\/)README(?:\.md)?$/i.test(value), label + " must not use README scraping as evidence");
  assert(!/(?:^|\/)(?:dist|node_modules)(?:\/|$)/.test(value), label + " must not use generated or dependency directories");
}

function assertCanonicalPublicUrl(value, label) {
  assertNonEmptyString(value, label);

  const pathStart = value.indexOf("/", "https://".length);
  const rawPath = pathStart < 0 ? "" : value.slice(pathStart).split(/[?#]/, 1)[0];
  assert(!rawPath.includes("\\"), label + " must not contain a backslash path escape");
  assert(!/(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath), label + " must not contain dot-segment path escapes");
  assert(!/%(?:2e|2f|5c)/i.test(rawPath), label + " must not contain encoded path escapes");

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(label + " must be an absolute public URL");
  }

  assert(parsed.protocol === "https:", label + " must use https");

  if (parsed.hostname === "github.com") {
    assert(parsed.pathname === "/ariada-org/ariada" || parsed.pathname.startsWith("/ariada-org/ariada/"), label + " must use the canonical repository");
    return;
  }

  if (parsed.hostname === "raw.githubusercontent.com") {
    assert(parsed.pathname.startsWith("/ariada-org/ariada/"), label + " must use the canonical raw repository");
    return;
  }

  if (parsed.hostname === "wiki.ariada.org") {
    return;
  }

  if (parsed.hostname === "ariada.org") {
    const isPublicSchema = parsed.pathname.startsWith("/schemas/");
    const isExactMatrixAsset = value === PUBLIC_MATRIX_ASSET_URL && parsed.href === PUBLIC_MATRIX_ASSET_URL;
    const isExactModuleRoute = /^https:\/\/ariada\.org\/modules\/s(?:[1-9]|[1-9][0-9]|1[0-9]{2}|2[0-2][0-9]|23[0-6])\/$/.test(value);
    assert(
      isPublicSchema || isExactMatrixAsset || isExactModuleRoute,
      label + " may use ariada.org only for public schemas, the exact channel matrix asset, or a canonical module route"
    );
    return;
  }

  fail(label + " uses an unsupported public authority");
}

function visitStrings(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => visitStrings(item, visit));
    return;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => visitStrings(item, visit));
  }
}

function extractPublicUrls(value) {
  const matches = value.match(/https?:\/\/[^\s<>"'()[\]]+/gi) || [];
  return matches.map((url) => url.replace(/[.,;:!?]+$/, ""));
}

export function assertNoSensitiveReferences(value) {
  const serialized = JSON.stringify(value);

  for (const rule of DLP_RULES) {
    assert(!rule.pattern.test(serialized), "Public data violates DLP category: " + rule.category);
  }

  visitStrings(value, (candidate) => {
    for (const url of extractPublicUrls(candidate)) {
      assertCanonicalPublicUrl(url, "Public URL");
    }
  });

  return value;
}

function validateDevelopmentEvidence(value, label) {
  if (value === null) {
    return;
  }

  assertExactKeys(value, ["path"], label);
  assertRepoPath(value.path, label + ".path");
}

function validateDeliveryEvidence(value, label) {
  if (value === null) {
    return;
  }

  assertExactKeys(value, ["codePath", "landingPath"], label);
  assertRepoPath(value.codePath, label + ".codePath");
  assertRepoPath(value.landingPath, label + ".landingPath");
  assert(value.codePath !== value.landingPath, label + " paths must be distinct");
}

function validateProductionEvidence(value, label) {
  if (value === null) {
    return;
  }

  assertExactKeys(value, ["evidenceUrl", "releaseUrl", "releasedAt"], label);
  assertCanonicalPublicUrl(value.releaseUrl, label + ".releaseUrl");
  assertCanonicalPublicUrl(value.evidenceUrl, label + ".evidenceUrl");
  assert(/^https:\/\/github\.com\/ariada-org\/ariada\/releases\/tag\/[^/]+$/.test(value.releaseUrl), label + ".releaseUrl must pin a public release tag");
  assert(/^https:\/\/github\.com\/ariada-org\/ariada\/releases\/(?:tag|download)\/[^/]+/.test(value.evidenceUrl), label + ".evidenceUrl must be release evidence");
  assertIsoTimestamp(value.releasedAt, label + ".releasedAt");
}

export function validateSourceRegistry(source) {
  assertExactKeys(source, SOURCE_KEYS, "Source registry");
  assert(source.$schema === SOURCE_REGISTRY_SCHEMA_URL, "Source registry schema URL is not canonical");
  assert(source.catalogSchema === CATALOG_SCHEMA_URL, "Catalog schema URL is not canonical");
  assert(source.version === 1, "Source registry version must be 1");
  assert(source.repository === CANONICAL_REPOSITORY, "Source repository must be " + CANONICAL_REPOSITORY);
  assert(source.defaultBranch === "main", "Source defaultBranch must be main");
  assertIsoTimestamp(source.declaredAt, "Source registry declaredAt");

  assertExactKeys(source.localization, LOCALIZATION_KEYS, "Source localization");
  assert(source.localization.package === LOCALIZATION_CONTRACT.package, "Source localization package must use the package contract");
  assert(source.localization.version === LOCALIZATION_CONTRACT.version, "Source localization version must be exact");
  assert(source.localization.localesExport === LOCALIZATION_CONTRACT.localesExport, "Source locale export does not match the package contract");
  assert(source.localization.baseUrl === WIKI_BASE_URL, "Source wiki base URL is not canonical");
  assert(PUBLIC_WIKI_LOCALES.includes(source.localization.defaultLocale), "Source default locale is absent from the package contract");

  assert(Array.isArray(source.modules) && source.modules.length === 236, "Source registry must contain exactly 236 modules");

  const seenIds = new Set();
  const seenPacks = new Set();
  let currentPack = null;

  source.modules.forEach((module, index) => {
    const label = "Source module " + index;
    assertExactKeys(module, MODULE_KEYS, label);
    assert(module.number === index + 1, label + " number must preserve the S1-S236 sequence");
    assert(module.id === "S" + module.number, label + " id must match its number");
    assert(!seenIds.has(module.id), label + " id must be unique");
    seenIds.add(module.id);

    assertNonEmptyString(module.name, label + ".name");
    assertNonEmptyString(module.description, label + ".description");
    assertNonEmptyString(module.boundary, label + ".boundary");
    assertNonEmptyString(module.installation, label + ".installation");
    assert(module.pack === expectedPack(module.number), label + ".pack must be the exact numeric pack for " + module.id);
    assertStringArray(module.roles, label + ".roles", { minimum: 1 });
    assertStringArray(module.useCases, label + ".useCases", { minimum: 1 });
    assertIsoTimestamp(module.updatedAt, label + ".updatedAt", true);

    validateDevelopmentEvidence(module.developmentEvidence, label + ".developmentEvidence");
    validateDeliveryEvidence(module.deliveryEvidence, label + ".deliveryEvidence");
    validateProductionEvidence(module.productionEvidence, label + ".productionEvidence");
    assert(module.productionEvidence === null || module.deliveryEvidence !== null, label + " production evidence requires delivery evidence");

    if (module.pack !== currentPack) {
      assert(!seenPacks.has(module.pack), label + " pack blocks must be contiguous");
      seenPacks.add(module.pack);
      currentPack = module.pack;
    }
  });

  assert(seenIds.size === 236, "Source module IDs must be unique and complete");
  assert(seenPacks.size === 24, "Source registry must contain exactly 24 contiguous packs");
  assertNoSensitiveReferences(source);
  return source;
}

function githubPath(url, label) {
  assertCanonicalPublicUrl(url, label);
  return new URL(url).pathname;
}

function assertCommitUrl(url, commit, path, label, allowedKinds) {
  const pathname = githubPath(url, label);
  const valid = allowedKinds.some((kind) => pathname === "/ariada-org/ariada/" + kind + "/" + commit + "/" + path);
  assert(valid, label + " must be a commit-pinned canonical tree or blob URL");
}

function assertMainUrl(url, path, kind, label) {
  const pathname = githubPath(url, label);
  assert(pathname === "/ariada-org/ariada/" + kind + "/main/" + path, label + " must be backed by origin/main");
}

function validateCounts(counts, channels) {
  assertExactKeys(counts, COUNT_KEYS, "Catalog counts");
  const calculated = {
    total: channels.length,
    planned: channels.filter((channel) => channel.state === "Planned").length,
    inDevelopment: channels.filter((channel) => channel.state === "In development").length,
    delivered: channels.filter((channel) => channel.state === "Delivered").length,
    production: channels.filter((channel) => channel.state === "Production").length
  };
  assert(JSON.stringify(counts) === JSON.stringify(calculated), "Catalog counts do not match channels");
}

function validateChannel(channel, index, source, seenIds) {
  const label = "Catalog channel " + index;
  assertExactKeys(channel, CHANNEL_KEYS, label);
  assert(channel.number === index + 1, label + " number must preserve sequence");
  assert(channel.id === "S" + channel.number, label + " id must match its number");
  assert(!seenIds.has(channel.id), label + " id must be unique");
  seenIds.add(channel.id);

  assertNonEmptyString(channel.name, label + ".name");
  assertNonEmptyString(channel.description, label + ".description");
  assertNonEmptyString(channel.boundary, label + ".boundary");
  assert(channel.pack === expectedPack(channel.number), label + ".pack must be the exact numeric pack for " + channel.id);
  assertStringArray(channel.roles, label + ".roles", { minimum: 1 });
  assertStringArray(channel.useCases, label + ".useCases", { minimum: 1 });
  assertNonEmptyString(channel.installation, label + ".installation");
  assert(Object.hasOwn(STATUS_CONTRACT, channel.state), label + " has an unsupported state");
  assert(channel.distributionStatus === STATUS_CONTRACT[channel.state].distributionStatus, label + " distributionStatus does not match state");
  assert(channel.deploymentStatus === STATUS_CONTRACT[channel.state].deploymentStatus, label + " deploymentStatus does not match state");

  assertIsoTimestamp(channel.updatedAt, label + ".updatedAt", true);
  assertIsoTimestamp(channel.developmentStarted, label + ".developmentStarted", true);
  assertIsoTimestamp(channel.landed, label + ".landed", true);
  assertIsoTimestamp(channel.published, label + ".published", true);
  assertSha(channel.evidenceCommit, label + ".evidenceCommit", true);

  assertNullableString(channel.developmentEvidenceUrl, label + ".developmentEvidenceUrl");
  assertNullableString(channel.productionEvidenceUrl, label + ".productionEvidenceUrl");
  assertNullableString(channel.publicationUrl, label + ".publicationUrl");
  assertNullableString(channel.evidenceUrl, label + ".evidenceUrl");
  assertNullableString(channel.publicCodeUrl, label + ".publicCodeUrl");
  assertNullableString(channel.githubModuleUrl, label + ".githubModuleUrl");
  assertStringArray(channel.deliveryEvidenceUrls, label + ".deliveryEvidenceUrls");

  assertCanonicalPublicUrl(channel.wikiUrl, label + ".wikiUrl");
  assertCanonicalPublicUrl(channel.ariadaModuleUrl, label + ".ariadaModuleUrl");
  assert(
    channel.wikiUrl === source.wiki.baseUrl + source.wiki.defaultLocale + "/modules/" + channel.id.toLowerCase() + "/",
    label + " wiki URL must preserve canonical locale casing and use a lowercase module ID"
  );
  assert(
    channel.ariadaModuleUrl === ARIADA_MODULE_BASE_URL + channel.id.toLowerCase() + "/",
    label + " Ariada module URL must be distinct and canonical"
  );

  if (channel.state === "Planned") {
    assert(channel.evidenceCommit === null, label + " Planned state cannot claim a commit");
    assert(channel.developmentEvidenceUrl === null, label + " Planned state cannot claim development evidence");
    assert(channel.deliveryEvidenceUrls.length === 0, label + " Planned state cannot claim delivery evidence");
    assert(channel.productionEvidenceUrl === null && channel.publicationUrl === null, label + " Planned state cannot claim production");
    assert(channel.publicCodeUrl === null && channel.githubModuleUrl === null && channel.evidenceUrl === null, label + " Planned state cannot claim public implementation URLs");
    assert(channel.developmentStarted === null && channel.landed === null && channel.published === null, label + " Planned state cannot claim lifecycle timestamps");
    return;
  }

  assert(channel.evidenceCommit !== null, label + " evidence states require a commit");
  assert(channel.updatedAt !== null, label + " evidence states require updatedAt");
  assert(channel.evidenceUrl !== null, label + " evidence states require a primary evidence URL");

  if (channel.state === "In development") {
    assert(channel.developmentEvidenceUrl !== null, label + " In development requires commit-pinned evidence");
    assertCommitUrl(channel.developmentEvidenceUrl, channel.evidenceCommit, channel.developmentEvidenceUrl.split("/").slice(7).join("/"), label + ".developmentEvidenceUrl", ["tree", "blob"]);
    assert(!channel.developmentEvidenceUrl.includes("/main/"), label + " In development evidence cannot use a mutable main URL");
    assert(channel.evidenceUrl === channel.developmentEvidenceUrl, label + " primary evidence must match development evidence");
    assert(channel.deliveryEvidenceUrls.length === 0, label + " In development cannot claim delivery");
    assert(channel.publicCodeUrl === null && channel.githubModuleUrl === null, label + " In development cannot emit main implementation URLs");
    assert(channel.productionEvidenceUrl === null && channel.publicationUrl === null && channel.published === null, label + " In development cannot claim production");
    assert(channel.developmentStarted === channel.updatedAt && channel.landed === null, label + " In development timestamps are inconsistent");
    return;
  }

  assert(channel.deliveryEvidenceUrls.length === 2, label + " Delivered and Production states require code and landing evidence");
  assert(!/pnpm install from the repository root/i.test(channel.installation), label + " delivery installation must be module-specific");
  const codePath = channel.deliveryEvidenceUrls[0].split("/").slice(7).join("/");
  const landingPath = channel.deliveryEvidenceUrls[1].split("/").slice(7).join("/");
  assertCommitUrl(channel.deliveryEvidenceUrls[0], channel.evidenceCommit, codePath, label + ".deliveryEvidenceUrls[0]", ["tree", "blob"]);
  assertCommitUrl(channel.deliveryEvidenceUrls[1], channel.evidenceCommit, landingPath, label + ".deliveryEvidenceUrls[1]", ["blob"]);
  assert(channel.evidenceUrl === channel.deliveryEvidenceUrls[0], label + " primary evidence must be the pinned code evidence");
  assert(channel.publicCodeUrl !== null && channel.githubModuleUrl !== null, label + " delivery requires main implementation URLs");
  assertMainUrl(channel.publicCodeUrl, codePath, "tree", label + ".publicCodeUrl");
  assertMainUrl(channel.githubModuleUrl, landingPath, "blob", label + ".githubModuleUrl");
  assert(channel.developmentEvidenceUrl === null, label + " delivered state must use delivery evidence");

  if (channel.state === "Delivered") {
    assert(channel.landed === channel.updatedAt, label + " Delivered updatedAt must equal its public evidence timestamp");
    assert(channel.productionEvidenceUrl === null && channel.publicationUrl === null && channel.published === null, label + " Delivered state cannot claim production");
    return;
  }

  assert(channel.productionEvidenceUrl !== null && channel.publicationUrl !== null, label + " Production requires release evidence");
  assert(channel.published !== null, label + " Production requires releasedAt");
  const expectedProductionUpdate = [channel.landed, channel.published]
    .map((value) => new Date(value).toISOString())
    .sort()
    .at(-1);
  assert(channel.updatedAt === expectedProductionUpdate, label + " Production updatedAt must be the latest delivery or release evidence timestamp");
  assertCanonicalPublicUrl(channel.productionEvidenceUrl, label + ".productionEvidenceUrl");
  assertCanonicalPublicUrl(channel.publicationUrl, label + ".publicationUrl");
  assert(/^https:\/\/github\.com\/ariada-org\/ariada\/releases\/tag\/[^/]+$/.test(channel.publicationUrl), label + " publicationUrl must pin a release tag");
  assert(/^https:\/\/github\.com\/ariada-org\/ariada\/releases\/(?:tag|download)\/[^/]+/.test(channel.productionEvidenceUrl), label + " productionEvidenceUrl must be release evidence");
}

export function computeCatalogSnapshotHash(catalog) {
  const payload = {
    version: catalog.version,
    source: catalog.source,
    wiki: catalog.wiki,
    counts: catalog.counts,
    packs: catalog.packs,
    channels: catalog.channels
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function validateCatalog(catalog) {
  assertExactKeys(catalog, CATALOG_KEYS, "Catalog");
  assert(catalog.$schema === CATALOG_SCHEMA_URL, "Catalog schema URL is not canonical");
  assert(catalog.version === 1, "Catalog version must be 1");
  assertIsoTimestamp(catalog.generatedAt, "Catalog generatedAt");
  assert(typeof catalog.snapshotHash === "string" && /^[0-9a-f]{64}$/.test(catalog.snapshotHash), "Catalog snapshotHash must be SHA-256");

  assertExactKeys(catalog.source, CATALOG_SOURCE_KEYS, "Catalog source");
  assert(catalog.source.repository === CANONICAL_REPOSITORY, "Catalog repository authority is not canonical");
  assert(catalog.source.branch === "main", "Catalog source branch must be main");
  assertSha(catalog.source.commit, "Catalog source.commit");
  assert(catalog.source.registry === RAW_REPOSITORY_PREFIX + "main/config/ariada-channel-source.json", "Catalog registry URL is not canonical");
  assert(catalog.source.registrySchema === SOURCE_REGISTRY_SCHEMA_URL, "Catalog registry schema URL is not canonical");
  assert(catalog.source.catalogSchema === CATALOG_SCHEMA_URL, "Catalog schema contract is not canonical");
  assertIsoTimestamp(catalog.source.registryDeclaredAt, "Catalog source.registryDeclaredAt");
  assert(catalog.source.localizationPackage === LOCALIZATION_CONTRACT.package, "Catalog localization package does not match");
  assert(catalog.source.localizationVersion === LOCALIZATION_CONTRACT.version, "Catalog localization version does not match");
  assert(catalog.source.localesExport === LOCALIZATION_CONTRACT.localesExport, "Catalog locale export does not match");
  assert(catalog.source.packCount === 24, "Catalog packCount must be 24");

  assertExactKeys(catalog.wiki, WIKI_KEYS, "Catalog wiki");
  assert(catalog.wiki.baseUrl === WIKI_BASE_URL, "Catalog wiki authority is not canonical");
  assert(PUBLIC_WIKI_LOCALES.includes(catalog.wiki.defaultLocale), "Catalog default locale is absent from package contract");
  assert(JSON.stringify(catalog.wiki.locales) === JSON.stringify(PUBLIC_WIKI_LOCALES), "Catalog locales drifted from @agonist/localization 0.1.0");
  assertRecord(catalog.wiki.localeLinks, "Catalog wiki.localeLinks");
  assert(JSON.stringify(Object.keys(catalog.wiki.localeLinks)) === JSON.stringify(PUBLIC_WIKI_LOCALES), "Catalog localeLinks order or membership drifted");
  PUBLIC_WIKI_LOCALES.forEach((locale) => {
    assert(
      catalog.wiki.localeLinks[locale] === WIKI_BASE_URL + locale + "/modules/",
      "Catalog locale link is invalid for " + locale
    );
  });

  assert(Array.isArray(catalog.channels) && catalog.channels.length === 236, "Catalog must contain exactly 236 channels");
  const seenIds = new Set();
  const source = { wiki: catalog.wiki };
  catalog.channels.forEach((channel, index) => validateChannel(channel, index, source, seenIds));
  assert(seenIds.size === 236, "Catalog IDs must be unique and complete");

  assert(Array.isArray(catalog.packs) && catalog.packs.length === 24, "Catalog must contain exactly 24 packs");
  const channelById = new Map(catalog.channels.map((channel) => [channel.id, channel]));
  const packedIds = [];
  catalog.packs.forEach((pack, index) => {
    const label = "Catalog pack " + index;
    assertExactKeys(pack, PACK_KEYS, label);
    assert(pack.id === index + 1, label + ".id must preserve numeric pack order 1-24");
    assert(Number.isInteger(pack.moduleCount) && pack.moduleCount > 0, label + ".moduleCount must be positive");
    assertStringArray(pack.moduleIds, label + ".moduleIds", { minimum: 1 });
    assert(pack.moduleCount === pack.moduleIds.length, label + " moduleCount does not match moduleIds");
    pack.moduleIds.forEach((id) => {
      assert(channelById.has(id), label + " contains an unknown module");
      assert(channelById.get(id).pack === pack.id, label + " contains a module from another pack");
      packedIds.push(id);
    });
    validateCounts(pack.counts, pack.moduleIds.map((id) => channelById.get(id)));
  });
  assert(JSON.stringify(packedIds) === JSON.stringify(catalog.channels.map((channel) => channel.id)), "Catalog packs must preserve all 236 channels in order");

  validateCounts(catalog.counts, catalog.channels);
  const expectedGeneratedAt = [catalog.source.registryDeclaredAt, ...catalog.channels.map((channel) => channel.updatedAt).filter(Boolean)]
    .map((value) => new Date(value).toISOString())
    .sort()
    .at(-1);
  assert(catalog.generatedAt === expectedGeneratedAt, "Catalog generatedAt must derive from explicit source or public evidence");
  assert(catalog.snapshotHash === computeCatalogSnapshotHash(catalog), "Catalog snapshotHash does not match content");
  assertNoSensitiveReferences(catalog);
  return catalog;
}
