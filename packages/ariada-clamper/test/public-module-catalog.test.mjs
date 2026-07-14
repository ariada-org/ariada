import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import localeManifest from "@agonist/localization/wiki-locales.json";
import messageManifest from "@agonist/localization/wiki-messages.json";

import { parseLocaleCodes } from "../src/localization-contract.mjs";

import {
  CANONICAL_REPOSITORY,
  CATALOG_SCHEMA_URL,
  PUBLIC_WIKI_LOCALES,
  SOURCE_REGISTRY_SCHEMA_URL,
  assertNoSensitiveReferences,
  validateCatalog,
  validateSourceRegistry
} from "../src/index.mjs";

import { assertJsonSchemaValid } from "./json-schema-validation.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const registry = JSON.parse(readFileSync(resolve(ROOT, "config/ariada-channel-source.json"), "utf8"));
const catalog = JSON.parse(readFileSync(resolve(ROOT, "apps/ariada-org/public/channel-matrix.json"), "utf8"));
const packageJson = JSON.parse(readFileSync(resolve(ROOT, "packages/ariada-clamper/package.json"), "utf8"));

const canonicalSourceSchemaBytes = readFileSync(resolve(ROOT, "packages/ariada-clamper/schema/channel-source-registry-v1.json"), "utf8");
const canonicalCatalogSchemaBytes = readFileSync(resolve(ROOT, "packages/ariada-clamper/schema/public-module-catalog-v1.json"), "utf8");
const publishedSourceSchemaBytes = readFileSync(resolve(ROOT, "apps/ariada-org/public/schemas/channel-source-registry/v1.json"), "utf8");
const publishedCatalogSchemaBytes = readFileSync(resolve(ROOT, "apps/ariada-org/public/schemas/public-module-catalog/v1.json"), "utf8");
const sourceSchema = JSON.parse(canonicalSourceSchemaBytes);
const catalogSchema = JSON.parse(canonicalCatalogSchemaBytes);

function manifestCodes(value) {
  const rows = Array.isArray(value) ? value : value.locales;
  return rows.map((row) => typeof row === "string" ? row : row.code);
}

function duplicateMetrics(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const duplicates = [...counts.values()].filter((count) => count > 1);
  return {
    duplicateGroups: duplicates.length,
    largestGroup: duplicates.length === 0 ? 1 : Math.max(...duplicates)
  };
}

test("source registry is strict, complete, and canonical", () => {
  assert.equal(validateSourceRegistry(registry), registry);
  assert.equal(registry.modules.length, 236);
  assert.equal(new Set(registry.modules.map((module) => module.id)).size, 236);
  assert.equal(new Set(registry.modules.map((module) => module.pack)).size, 24);
  assert.deepEqual(
    Array.from({ length: 24 }, (_, index) => registry.modules.filter((module) => module.pack === index + 1).length),
    [6, ...Array(23).fill(10)]
  );
  registry.modules.forEach((module) => {
    const expected = module.number <= 6 ? 1 : Math.floor((module.number - 7) / 10) + 2;
    assert.equal(module.pack, expected);
  });
  assert.equal(registry.repository, CANONICAL_REPOSITORY);
});

test("installed localization package exposes the exact locale and message contract", () => {
  const packageLocaleCodes = manifestCodes(localeManifest);
  const messageLocaleCodes = Object.keys(messageManifest);
  const messageKeys = Object.keys(messageManifest.en);

  assert.equal(packageLocaleCodes.length, 30);
  assert.equal(messageLocaleCodes.length, 30);
  assert.deepEqual(PUBLIC_WIKI_LOCALES, packageLocaleCodes);
  assert.deepEqual(messageLocaleCodes, packageLocaleCodes);
  messageLocaleCodes.forEach((locale) => {
    assert.deepEqual(Object.keys(messageManifest[locale]), messageKeys);
    Object.values(messageManifest[locale]).forEach((message) => assert.equal(typeof message, "string"));
  });
  assert.equal(packageJson.dependencies["@agonist/localization"], "0.1.0");
  assert.equal(registry.localization.package, "@agonist/localization");
  assert.equal(registry.localization.version, "0.1.0");
  assert.equal(Object.hasOwn(registry.localization, "locales"), false);
});

test("malformed localization contracts still fail closed", () => {
  assert.throws(() => parseLocaleCodes({}), /must expose a locale array/);
  assert.throws(() => parseLocaleCodes([{ code: "invalid locale" }]), /Invalid locale/);
  assert.throws(() => parseLocaleCodes([{ code: "en" }, { code: "en" }]), /unique locale codes/);
});

test("generated catalog validates against Clamper", () => {
  assert.equal(validateCatalog(catalog), catalog);
  assert.deepEqual(catalog.wiki.locales, PUBLIC_WIKI_LOCALES);
});

test("real source and catalog payloads validate against canonical published schemas", () => {
  assertJsonSchemaValid(registry, sourceSchema, "source registry");
  assertJsonSchemaValid(catalog, catalogSchema, "catalog");
  assert.equal(canonicalSourceSchemaBytes, publishedSourceSchemaBytes);
  assert.equal(canonicalCatalogSchemaBytes, publishedCatalogSchemaBytes);
});

test("published schemas contain no handwritten locale enumeration", () => {
  const localization = catalogSchema.$defs.localization.properties;
  assert.equal(Object.hasOwn(localization.locales, "prefixItems"), false);
  assert.equal(Object.hasOwn(localization.locales, "maxItems"), false);
  assert.equal(Object.hasOwn(localization.locales, "enum"), false);
  assert.equal(JSON.stringify([sourceSchema, catalogSchema]).includes('"prefixItems"'), false);
});

test("module content is specific, truthful, and source-authoritative", () => {
  const descriptions = duplicateMetrics(registry.modules.map((module) => module.description));
  const normalizedDescriptions = duplicateMetrics(registry.modules.map((module) => (
    module.description
      .toLowerCase()
      .replace(module.name.toLowerCase(), "<module>")
      .replace(/[^a-z0-9<>]+/g, " ")
      .trim()
  )));
  const rolePairs = duplicateMetrics(registry.modules.map((module) => JSON.stringify([...module.roles].sort())));
  const useCasePairs = duplicateMetrics(registry.modules.map((module) => JSON.stringify(module.useCases)));

  assert.deepEqual(descriptions, { duplicateGroups: 0, largestGroup: 1 });
  assert.deepEqual(normalizedDescriptions, { duplicateGroups: 0, largestGroup: 1 });
  assert.equal(rolePairs.largestGroup, 1);
  assert.equal(useCasePairs.largestGroup, 1);

  registry.modules.forEach((module) => {
    assert.ok(module.description.length >= 120, module.id + " description is thin");
    assert.ok(module.boundary.length >= 100, module.id + " boundary is thin");
    assert.doesNotMatch(module.description, /Ariada Wiki module|channel pack|records the public integration scope/i);
    assert.equal(module.roles.length >= 2, true, module.id + " needs named roles");
    assert.equal(module.useCases.length >= 2, true, module.id + " needs concrete use cases");
    module.roles.forEach((role) => assert.ok(role.length >= 10, module.id + " has a generic role"));
    module.useCases.forEach((useCase) => assert.ok(useCase.length >= 60, module.id + " has a thin use case"));

    if (module.deliveryEvidence === null) {
      assert.match(
        [module.description, module.boundary, ...module.useCases].join(" "),
        /planned|proposed|prospective|future|not-yet|intend|would|not (?:available|installable)/i,
      );
      assert.match(module.installation, /^Not installable:/);
    } else {
      assert.ok(module.installation.includes(module.deliveryEvidence.codePath));
      assert.doesNotMatch(module.installation, /pnpm install from the repository root|git clone/i);
      assert.doesNotMatch(module.description, /\bplanned\b/i);
    }
  });
});

test("locale drift from the package contract is rejected", () => {
  const drifted = structuredClone(catalog);
  drifted.wiki.locales = drifted.wiki.locales.slice(1);
  assert.throws(() => validateCatalog(drifted), /locales drifted/);
});

test("non-canonical repository authorities are rejected", () => {
  const drifted = structuredClone(registry);
  drifted.repository = ["https://github.com", "example-org", "example-repository"].join("/");
  assert.throws(() => validateSourceRegistry(drifted));
});

test("Delivered requires commit-pinned evidence and origin-main URLs", () => {
  const delivered = catalog.channels.find((channel) => channel.state === "Delivered");
  assert.ok(delivered);

  const mutableEvidence = structuredClone(catalog);
  const target = mutableEvidence.channels.find((channel) => channel.id === delivered.id);
  target.deliveryEvidenceUrls[0] = target.deliveryEvidenceUrls[0].replace("/" + target.evidenceCommit + "/", "/main/");
  mutableEvidence.snapshotHash = "0".repeat(64);
  assert.throws(() => validateCatalog(mutableEvidence), /commit-pinned/);

  const nonMainDelivery = structuredClone(catalog);
  const targetTwo = nonMainDelivery.channels.find((channel) => channel.id === delivered.id);
  targetTwo.publicCodeUrl = targetTwo.publicCodeUrl.replace("/main/", "/" + targetTwo.evidenceCommit + "/");
  nonMainDelivery.snapshotHash = "0".repeat(64);
  assert.throws(() => validateCatalog(nonMainDelivery), /origin\/main|backed by origin\/main/);
});

test("Production claims require strict release evidence", () => {
  const invalid = structuredClone(catalog);
  const target = invalid.channels.find((channel) => channel.state === "Delivered");
  target.state = "Production";
  target.distributionStatus = "Public release";
  target.deploymentStatus = "Production";
  target.published = target.updatedAt;
  invalid.snapshotHash = "0".repeat(64);
  assert.throws(() => validateCatalog(invalid), /Production requires release evidence/);
});

test("generic DLP categories reject private authorities and filesystem paths", () => {
  const foreignRepository = ["https://github.com", "example-org", "example-repository"].join("/");
  const personalPath = ["", "home", "sample-user", "workspace", "source.json"].join("/");
  const handoffPath = ["docs", "internal-project", "handoff.md"].join("/");

  assert.throws(() => assertNoSensitiveReferences({ value: foreignRepository }), /DLP|unsupported|canonical/);
  assert.throws(() => assertNoSensitiveReferences({ value: personalPath }), /absolute home path/);
  assert.throws(() => assertNoSensitiveReferences({ value: handoffPath }), /private|planning|handoff/);
});

test("canonical repository URL boundaries reject lookalikes and path escapes", () => {
  const canonical = CANONICAL_REPOSITORY;
  const accepted = [
    canonical,
    "Repository: " + canonical + "\nNext line",
    "[Canonical repository](" + canonical + ")"
  ];
  const rejected = [
    "https://github.com.example/ariada-org/ariada",
    canonical + "-mirror",
    canonical + ".git",
    canonical + "/segment/../tree/main",
    canonical + "%2Fescape",
    canonical + "\\escape"
  ];

  accepted.forEach((value) => assert.doesNotThrow(() => assertNoSensitiveReferences({ value })));
  rejected.forEach((value) => assert.throws(() => assertNoSensitiveReferences({ value })));
});

test("public channel matrix asset allowlist is exact", () => {
  const asset = "https://ariada.org/channel-matrix.json";
  const rejected = [
    asset + "/neighbor",
    asset + ".backup",
    asset + "?variant=1",
    asset + "#fragment",
    "https://assets.ariada.org/channel-matrix.json",
    "https://ariada.org.example/channel-matrix.json"
  ];

  assert.doesNotThrow(() => assertNoSensitiveReferences({ value: asset }));
  rejected.forEach((value) => assert.throws(() => assertNoSensitiveReferences({ value })));
});

test("source and catalog schema identifiers are canonical", () => {
  assert.equal(registry.$schema, SOURCE_REGISTRY_SCHEMA_URL);
  assert.equal(sourceSchema.$id, SOURCE_REGISTRY_SCHEMA_URL);
  assert.equal(sourceSchema.properties.modules.minItems, 236);
  assert.equal(sourceSchema.properties.modules.maxItems, 236);
  assert.deepEqual(sourceSchema.$defs.module.properties.pack, {
    type: "integer",
    minimum: 1,
    maximum: 24
  });
  assert.equal(Object.hasOwn(sourceSchema.$defs.localization.properties, "locales"), false);
  assert.equal(registry.catalogSchema, CATALOG_SCHEMA_URL);
  assert.equal(catalog.$schema, CATALOG_SCHEMA_URL);
  assert.equal(catalogSchema.$id, CATALOG_SCHEMA_URL);
});
