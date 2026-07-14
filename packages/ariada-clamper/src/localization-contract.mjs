import localeManifest from "@agonist/localization/wiki-locales.json";

function localeRows(manifest) {
  if (Array.isArray(manifest)) {
    return manifest;
  }

  if (manifest && Array.isArray(manifest.locales)) {
    return manifest.locales;
  }

  throw new Error("@agonist/localization 0.1.0 wiki-locales.json must expose a locale array");
}

function localeCode(row, index) {
  const code = typeof row === "string"
    ? row
    : row && typeof row.code === "string"
      ? row.code
      : null;

  if (!code || !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(code)) {
    throw new Error("Invalid locale at @agonist/localization wiki-locales.json index " + index);
  }

  return code;
}

export function parseLocaleCodes(manifest) {
  const codes = localeRows(manifest).map(localeCode);

  if (codes.length === 0 || new Set(codes).size !== codes.length) {
    throw new Error("@agonist/localization wiki-locales.json must contain unique locale codes");
  }

  return codes;
}

const codes = parseLocaleCodes(localeManifest);

export const PUBLIC_WIKI_LOCALES = Object.freeze(codes);

export const LOCALIZATION_CONTRACT = Object.freeze({
  package: "@agonist/localization",
  version: "0.1.0",
  localesExport: "./wiki-locales.json"
});
