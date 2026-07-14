import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const registry = JSON.parse(readFileSync(resolve(ROOT, "config/ariada-channel-source.json"), "utf8"));
const modules = registry.modules;
const byId = new Map(modules.map((module) => [module.id, module]));

const NAME_STOP_WORDS = new Set([
  "addon", "adapter", "and", "app", "ariada", "channel", "component", "extension",
  "finish", "for", "from", "grade", "integration", "integrations", "into", "listing",
  "module", "modules", "new", "package", "plugin", "public", "publish", "publishing",
  "the", "to", "tool", "with", "workflow",
]);
const TYPE_WORDS = new Set([
  "action", "addon", "adapter", "app", "bundle", "cartridge", "component", "connector",
  "engine", "executor", "extension", "fixture", "formula", "gem", "hook", "image",
  "integration", "library", "loader", "middleware", "module", "package", "panel", "plugin",
  "provider", "recipe", "reporter", "ruleset", "server", "step", "task", "theme", "tool",
  "workflow",
]);
const GENERIC_ROLES = new Set([
  "build orchestration maintainer",
  "build tool maintainer",
  "client integration maintainer",
  "cms extension maintainer",
  "cross platform application maintainer",
  "delivery platform maintainer",
  "documentation platform maintainer",
  "framework maintainer",
  "integration maintainer",
  "language ecosystem maintainer",
  "platform integration maintainer",
  "public integration maintainer",
]);
const PACK_SAMPLE_IDS = [
  "S1", "S7", "S17", "S27", "S37", "S47", "S57", "S67", "S77", "S87", "S97", "S107",
  "S117", "S127", "S137", "S147", "S157", "S167", "S177", "S187", "S197", "S207", "S217", "S227",
];

function words(value) {
  return (value.match(/[A-Za-z0-9]+/g) ?? []).map((word) => word.toLowerCase());
}

function normalize(value) {
  return words(value).join(" ");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function nameVocabulary(module) {
  return [...new Set(words(module.name).filter((word) => word.length >= 2 && !NAME_STOP_WORDS.has(word)))];
}

function contentCorpus(module) {
  return [module.description, module.boundary, ...module.roles, ...module.useCases].join(" ");
}

function skeleton(module, value) {
  let result = normalize(value);
  for (const token of nameVocabulary(module).sort((left, right) => right.length - left.length)) {
    result = result.replace(new RegExp("\\b" + escapeRegex(token) + "\\b", "g"), "<channel>");
  }
  return result.replace(/\b\d+\b/g, "<n>").replace(/\s+/g, " ").trim();
}

function frequencyMetrics(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  const groups = [...counts.values()];
  return {
    duplicateGroups: groups.filter((count) => count > 1).length,
    largestGroup: Math.max(0, ...groups),
    unique: counts.size,
  };
}

test("canonical content has no generic maintainer or readiness constructions", () => {
  modules.forEach((module) => {
    const normalizedName = normalize(module.name);
    module.roles.forEach((role) => {
      const normalizedRole = normalize(role);
      assert.notEqual(normalizedRole, normalizedName + " maintainer", module.id + " repeats the module name as a generic maintainer role");
      assert.equal(GENERIC_ROLES.has(normalizedRole), false, module.id + " uses a generic maintainer role");
    });
    module.useCases.forEach((useCase) => {
      assert.doesNotMatch(useCase, /^(?:intended use|readiness review)\s*:/i, module.id + " uses a readiness template");
    });
  });
});

test("content remains semantically distinct after channel names are normalized", () => {
  const descriptions = frequencyMetrics(modules.map((module) => normalize(module.description)));
  const descriptionSkeletons = frequencyMetrics(modules.map((module) => skeleton(module, module.description)));
  const openingSkeletons = frequencyMetrics(modules.map((module) => skeleton(module, module.description).split(" ").slice(0, 12).join(" ")));
  const sentenceSkeletons = frequencyMetrics(modules.flatMap((module) => (
    [module.description, module.boundary, ...module.useCases]
      .flatMap((value) => value.split(/[.!?]+(?:\s+|$)/))
      .map((sentence) => sentence.trim())
      .filter((sentence) => words(sentence).length >= 8)
      .map((sentence) => skeleton(module, sentence))
  )));
  const rolePairs = frequencyMetrics(modules.map((module) => module.roles.map(normalize).sort().join("|")));
  const useCasePairs = frequencyMetrics(modules.map((module) => module.useCases.map(normalize).sort().join("|")));

  assert.deepEqual(descriptions, { duplicateGroups: 0, largestGroup: 1, unique: 236 });
  assert.equal(descriptionSkeletons.largestGroup <= 2, true, "description skeleton concentration is too high");
  assert.equal(openingSkeletons.largestGroup <= 3, true, "opening sentence concentration is too high");
  assert.equal(sentenceSkeletons.largestGroup <= 2, true, "normalized sentence skeleton concentration is too high");
  assert.equal(rolePairs.largestGroup <= 2, true, "role-pair concentration is too high");
  assert.equal(useCasePairs.largestGroup <= 2, true, "use-case concentration is too high");

  for (let pack = 1; pack <= 24; pack += 1) {
    const packOpenings = modules
      .filter((module) => module.pack === pack)
      .map((module) => skeleton(module, module.description).split(" ").slice(0, 12).join(" "));
    assert.equal(frequencyMetrics(packOpenings).largestGroup <= 2, true, "pack " + pack + " is category-template concentrated");
  }
});

test("every module uses vocabulary derived from its channel name and type", () => {
  modules.forEach((module) => {
    const corpusWords = new Set(words(contentCorpus(module)));
    const vocabulary = nameVocabulary(module);
    const types = words(module.name).filter((word) => TYPE_WORDS.has(word));
    assert.ok(vocabulary.length > 0, module.id + " has no derivable channel vocabulary");
    assert.ok(vocabulary.some((word) => corpusWords.has(word)), module.id + " lacks name-derived channel vocabulary");
    if (types.length > 0) {
      assert.ok(types.some((word) => corpusWords.has(word)), module.id + " lacks its declared channel type vocabulary");
    }
  });
});

test("planned copy is explicit about availability and avoids private authority", () => {
  const serialized = JSON.stringify(registry);
  assert.doesNotMatch(serialized, /\/Users\/|github\.com\/(?:ariada-org\/core|ariada-ai\/core)|private (?:repo|repository)|internal (?:prd|repo|repository|project|brand)|\bhandoff\b/i);

  modules.filter((module) => module.deliveryEvidence === null).forEach((module) => {
    assert.match(contentCorpus(module), /\b(?:planned|proposed|future|not-yet|intend|intended|would)\b/i, module.id + " does not disclose planned semantics");
    assert.match(module.boundary, /\b(?:no|not|future|would|could)\b/i, module.id + " does not state an availability boundary");
    assert.match(module.installation, /^Not installable:/, module.id + " implies planned installation");
  });
});

test("Shopify and Figma mappings retain platform-specific user semantics", () => {
  const shopify = byId.get("S1");
  const shopifyCorpus = contentCorpus(shopify);
  assert.match(shopifyCorpus, /\bShopify\b/);
  assert.match(shopifyCorpus, /\bmerchants?\b/i);
  assert.match(shopifyCorpus, /Shopify App Store|Online Store|development store/);
  assert.match(shopify.roles.join(" "), /Shopify Partner/);
  assert.match(shopify.roles.join(" "), /Merchant/);

  const figma = byId.get("S5");
  const figmaCorpus = contentCorpus(figma);
  assert.match(figmaCorpus, /\bFigma\b/);
  assert.match(figmaCorpus, /\bplugin\b/i);
  assert.match(figmaCorpus, /Figma Community/);
  assert.match(figmaCorpus, /design(?:-| )system teams?|design teams?/i);
  assert.match(figma.roles.join(" "), /product designer/i);
});

test("one category-specific sample is pinned for every pack", () => {
  assert.equal(PACK_SAMPLE_IDS.length, 24);
  PACK_SAMPLE_IDS.forEach((id, index) => {
    const module = byId.get(id);
    assert.equal(module.pack, index + 1, id + " no longer samples its expected pack");
    assert.ok(nameVocabulary(module).some((word) => new Set(words(contentCorpus(module))).has(word)), id + " sample lost category vocabulary");
  });
});

test("merged content-review inputs are not release artifacts", () => {
  assert.equal(existsSync(resolve(ROOT, "config/content-review")), false);
});
