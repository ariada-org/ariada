#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";

export const ARIADA_WIKI_CANONICAL_ORIGIN = "https://wiki.ariada.org";
export const RELEASE_MANIFEST_RELATIVE_PATH = ".well-known/ariada-release.json";
export const RELEASE_MANIFEST_KIND = "ariada-wiki-release";
export const MAX_RELEASE_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_PUBLIC_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_MANIFEST_FILES = 20_000;

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const CLOUDFLARE_CONTROL_FILES = new Set([
  "_headers",
  "_redirects",
  "_routes.json",
  "_worker.js",
]);

export class ContentManifestError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContentManifestError";
  }
}

function fail(message) {
  throw new ContentManifestError(message);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(record(value, label)).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${label} has missing or unexpected fields`);
  }
  return value;
}

function canonicalString(value, label) {
  if (typeof value !== "string" || value === "" || value !== value.trim()) fail(`${label} must be a canonical non-empty string`);
  return value;
}

function releaseSha(value, label = "release SHA") {
  const parsed = canonicalString(value, label);
  if (!SHA_PATTERN.test(parsed)) fail(`${label} must be a 40-character lowercase hexadecimal SHA`);
  return parsed;
}

function digest(value, label) {
  const parsed = canonicalString(value, label);
  if (!DIGEST_PATTERN.test(parsed)) fail(`${label} must be a 64-character lowercase hexadecimal digest`);
  return parsed;
}

function canonicalTimestamp(value, label) {
  const parsed = canonicalString(value, label);
  const milliseconds = Date.parse(parsed);
  if (!Number.isFinite(milliseconds)) fail(`${label} must be an ISO-8601 timestamp`);
  return new Date(milliseconds).toISOString();
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalPath(value, label = "content file path") {
  const parsed = canonicalString(value, label);
  if (parsed.startsWith("/") || parsed.includes("\\") || parsed.includes("\0")) fail(`${label} must be root-relative POSIX form`);
  const segments = parsed.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) fail(`${label} is not canonical`);
  return parsed;
}

export function isCloudflareControlPath(value) {
  const path = canonicalPath(value, "Cloudflare control path");
  return CLOUDFLARE_CONTROL_FILES.has(path) || path.split("/", 1)[0] === "_worker.js";
}

export function canonicalUrlForDistPath(value) {
  const path = canonicalPath(value);
  const encoded = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  let publicPath = `/${encoded}`;
  if (path === "index.html") publicPath = "/";
  else if (path.endsWith("/index.html")) publicPath = `/${encoded.slice(0, -"index.html".length)}`;
  return publicPath;
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function calculateContentSetSha256(files) {
  return sha256Hex(Buffer.from(JSON.stringify(files), "utf8"));
}

export function validateContentEntries(value, { allowEmpty = false, label = "release manifest files" } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > MAX_MANIFEST_FILES) {
    fail(`${label} must contain ${allowEmpty ? "between 0" : "between 1"} and ${MAX_MANIFEST_FILES} entries`);
  }
  let previous = null;
  const paths = new Set();
  const urls = new Set();
  return value.map((entryValue, index) => {
    const entry = exactKeys(entryValue, ["path", "url", "sha256", "bytes"], `release manifest file ${index}`);
    const path = canonicalPath(entry.path, `release manifest file ${index} path`);
    if (path === RELEASE_MANIFEST_RELATIVE_PATH || isCloudflareControlPath(path)) {
      fail(`release manifest file ${index} is not publicly attestable content`);
    }
    if (previous !== null && compareStrings(previous, path) >= 0) fail("release manifest files must be strictly sorted by path");
    previous = path;
    if (paths.has(path)) fail("release manifest contains a duplicate path");
    paths.add(path);
    const url = canonicalString(entry.url, `release manifest file ${index} URL`);
    if (url !== canonicalUrlForDistPath(path)) fail(`release manifest file ${index} URL is not canonical`);
    if (urls.has(url)) fail("release manifest contains a duplicate canonical URL");
    urls.add(url);
    const sha256 = digest(entry.sha256, `release manifest file ${index} sha256`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > MAX_PUBLIC_FILE_BYTES) {
      fail(`release manifest file ${index} bytes is outside the public-file bound`);
    }
    return { path, url, sha256, bytes: entry.bytes };
  });
}

export function validateContentReleaseManifest(value, context = {}) {
  const root = exactKeys(value, ["schemaVersion", "kind", "releaseSha", "generatedAt", "contentSetSha256", "files"], "release manifest");
  if (root.schemaVersion !== 1) fail("release manifest schemaVersion must be 1");
  if (root.kind !== RELEASE_MANIFEST_KIND) fail("release manifest kind does not match the monitor contract");
  const normalizedReleaseSha = releaseSha(root.releaseSha, "release manifest releaseSha");
  if (context.releaseSha !== undefined && normalizedReleaseSha !== releaseSha(context.releaseSha, "expected release SHA")) {
    fail("release manifest releaseSha does not match the expected release SHA");
  }
  const files = validateContentEntries(root.files);
  const expectedContentSet = calculateContentSetSha256(files);
  if (digest(root.contentSetSha256, "release manifest contentSetSha256") !== expectedContentSet) {
    fail("release manifest contentSetSha256 does not match its sorted file entries");
  }
  return {
    schemaVersion: 1,
    kind: RELEASE_MANIFEST_KIND,
    releaseSha: normalizedReleaseSha,
    generatedAt: canonicalTimestamp(root.generatedAt, "release manifest generatedAt"),
    contentSetSha256: expectedContentSet,
    files,
  };
}

export function serializeContentReleaseManifest(value) {
  const manifest = validateContentReleaseManifest(value);
  return Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
}

export function parseContentReleaseManifestBytes(value, context = {}) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value ?? "");
  if (bytes.length === 0) fail("release manifest bytes are absent");
  if (bytes.length > MAX_RELEASE_MANIFEST_BYTES) fail("release manifest exceeds the size bound");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("release manifest is not valid UTF-8");
  }
  let valueObject;
  try {
    valueObject = JSON.parse(text);
  } catch {
    fail("release manifest is invalid JSON");
  }
  const manifest = validateContentReleaseManifest(valueObject, context);
  const canonicalBytes = Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8");
  if (!bytes.equals(canonicalBytes)) fail("release manifest bytes are not canonical");
  return { manifest, bytes: canonicalBytes, sha256: sha256Hex(canonicalBytes) };
}

async function collectDistEntries(distDirectory) {
  const root = resolve(distDirectory);
  const files = [];
  async function visit(relativeDirectory) {
    let entries;
    try {
      entries = await readdir(join(root, relativeDirectory), { withFileTypes: true });
    } catch {
      fail(`dist directory is absent or unreadable: ${root}`);
    }
    entries.sort((left, right) => compareStrings(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory === "" ? entry.name : `${relativeDirectory}/${entry.name}`;
      if (entry.isSymbolicLink()) fail(`dist contains a symbolic link: ${relativePath}`);
      if (entry.isDirectory()) {
        await visit(relativePath);
        continue;
      }
      if (!entry.isFile()) fail(`dist contains a non-regular file: ${relativePath}`);
      const path = canonicalPath(relativePath);
      if (path === RELEASE_MANIFEST_RELATIVE_PATH || isCloudflareControlPath(path)) continue;
      const bytes = await readFile(join(root, ...path.split("/")));
      files.push({
        path,
        url: canonicalUrlForDistPath(path),
        sha256: sha256Hex(bytes),
        bytes: bytes.length,
      });
    }
  }
  await visit("");
  files.sort((left, right) => compareStrings(left.path, right.path));
  if (files.length === 0) fail("dist contains no publicly fetchable files");
  return files;
}

export async function createContentReleaseManifest({ distDirectory, releaseSha: releaseShaValue, generatedAt, copyPath }) {
  const normalizedReleaseSha = releaseSha(releaseShaValue);
  const files = await collectDistEntries(distDirectory);
  const manifest = {
    schemaVersion: 1,
    kind: RELEASE_MANIFEST_KIND,
    releaseSha: normalizedReleaseSha,
    generatedAt: canonicalTimestamp(generatedAt, "generatedAt"),
    contentSetSha256: calculateContentSetSha256(files),
    files,
  };
  const bytes = serializeContentReleaseManifest(manifest);
  const deployedPath = join(resolve(distDirectory), ...RELEASE_MANIFEST_RELATIVE_PATH.split("/"));
  await mkdir(dirname(deployedPath), { recursive: true });
  await writeFile(deployedPath, bytes, { mode: 0o644 });
  if (copyPath !== undefined) {
    const detachedPath = resolve(copyPath);
    await mkdir(dirname(detachedPath), { recursive: true });
    await writeFile(detachedPath, bytes, { mode: 0o600 });
  }
  await validateDistAgainstContentManifest({ distDirectory, manifestBytes: bytes });
  return { manifest, bytes, sha256: sha256Hex(bytes) };
}

export async function validateDistAgainstContentManifest({ distDirectory, manifestBytes }) {
  const parsed = parseContentReleaseManifestBytes(manifestBytes);
  let deployedBytes;
  try {
    deployedBytes = await readFile(join(resolve(distDirectory), ...RELEASE_MANIFEST_RELATIVE_PATH.split("/")));
  } catch {
    fail("dist release manifest is absent");
  }
  if (!deployedBytes.equals(parsed.bytes)) fail("dist release manifest bytes differ from the detached manifest");
  const actualFiles = await collectDistEntries(distDirectory);
  const actualByPath = new Map(actualFiles.map((entry) => [entry.path, entry]));
  for (const expected of parsed.manifest.files) {
    const actual = actualByPath.get(expected.path);
    if (actual === undefined) fail(`manifest-listed dist file is missing: ${expected.path}`);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256 || actual.url !== expected.url) {
      fail(`manifest-listed dist file does not match exact bytes and hash: ${expected.path}`);
    }
    actualByPath.delete(expected.path);
  }
  if (actualByPath.size !== 0) fail(`dist contains an unattested public file: ${actualByPath.keys().next().value}`);
  return parsed;
}

function tarText(header, offset, length) {
  const bytes = header.subarray(offset, offset + length);
  const zero = bytes.indexOf(0);
  return bytes.subarray(0, zero === -1 ? bytes.length : zero).toString("utf8");
}

function tarOctal(header, offset, length, label) {
  const text = tarText(header, offset, length).trim();
  if (!/^[0-7]+$/u.test(text)) fail(`${label} is not canonical octal`);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) fail(`${label} is out of range`);
  return value;
}

function parseTarEntries(gzipBytes) {
  let tar;
  try {
    tar = gunzipSync(gzipBytes);
  } catch {
    fail("release tar is not valid gzip data");
  }
  const files = new Map();
  let offset = 0;
  let ended = false;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      if (!tar.subarray(offset).every((byte) => byte === 0)) fail("release tar has data after its end marker");
      ended = true;
      break;
    }
    const storedChecksum = tarOctal(header, 148, 8, "release tar header checksum");
    let calculatedChecksum = 0;
    for (let index = 0; index < header.length; index += 1) {
      calculatedChecksum += index >= 148 && index < 156 ? 32 : header[index];
    }
    if (storedChecksum !== calculatedChecksum) fail("release tar header checksum is invalid");
    const size = tarOctal(header, 124, 12, "release tar entry size");
    const type = String.fromCharCode(header[156] || 48);
    const name = tarText(header, 0, 100);
    const prefix = tarText(header, 345, 155);
    let path = prefix === "" ? name : `${prefix}/${name}`;
    while (path.startsWith("./")) path = path.slice(2);
    if (type === "5") path = path.replace(/\/+$/u, "");
    if (path !== "" && path !== ".") canonicalPath(path, "release tar entry path");
    const dataOffset = offset + 512;
    const nextOffset = dataOffset + Math.ceil(size / 512) * 512;
    if (nextOffset > tar.length) fail("release tar entry exceeds the archive boundary");
    if (type === "0") {
      if (path === "" || path === ".") fail("release tar contains an unnamed regular file");
      if (files.has(path)) fail(`release tar contains duplicate file: ${path}`);
      files.set(path, Buffer.from(tar.subarray(dataOffset, dataOffset + size)));
    } else if (type !== "5") {
      fail(`release tar contains unsupported entry type for ${path || "<unnamed>"}`);
    }
    offset = nextOffset;
  }
  if (!ended) fail("release tar has no end marker");
  return files;
}

export function validateReleaseTarGzip({ tarBytes, manifestBytes, releaseSha: expectedReleaseSha }) {
  const parsed = parseContentReleaseManifestBytes(manifestBytes, { releaseSha: expectedReleaseSha });
  const files = parseTarEntries(tarBytes);
  const archivedManifest = files.get(RELEASE_MANIFEST_RELATIVE_PATH);
  if (archivedManifest === undefined) fail("release tar does not contain the deployed release manifest");
  if (!archivedManifest.equals(parsed.bytes)) fail("release tar manifest bytes differ from the detached release manifest");
  files.delete(RELEASE_MANIFEST_RELATIVE_PATH);
  for (const expected of parsed.manifest.files) {
    const bytes = files.get(expected.path);
    if (bytes === undefined) fail(`release tar is missing manifest-listed file: ${expected.path}`);
    if (bytes.length !== expected.bytes || sha256Hex(bytes) !== expected.sha256) {
      fail(`release tar file does not match exact bytes and hash: ${expected.path}`);
    }
    files.delete(expected.path);
  }
  for (const path of files.keys()) {
    if (!isCloudflareControlPath(path)) fail(`release tar contains an unattested public file: ${path}`);
  }
  return { ...parsed, archivedManifestBytes: archivedManifest };
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      dist: { type: "string" },
      "release-sha": { type: "string" },
      "generated-at": { type: "string" },
      copy: { type: "string" },
      manifest: { type: "string" },
    },
  });
  if (positionals.length !== 1) fail("exactly one content-manifest command is required");
  const command = positionals[0];
  const distDirectory = canonicalString(values.dist, "dist directory");
  if (command === "generate") {
    const result = await createContentReleaseManifest({
      distDirectory,
      releaseSha: canonicalString(values["release-sha"], "release SHA"),
      generatedAt: canonicalString(values["generated-at"], "generatedAt"),
      copyPath: canonicalString(values.copy, "detached manifest path"),
    });
    process.stdout.write(`${JSON.stringify({ releaseSha: result.manifest.releaseSha, contentSetSha256: result.manifest.contentSetSha256, releaseManifestSha256: result.sha256, files: result.manifest.files.length })}\n`);
  } else if (command === "validate") {
    const manifestBytes = await readFile(canonicalString(values.manifest, "manifest path"));
    const result = await validateDistAgainstContentManifest({ distDirectory, manifestBytes });
    process.stdout.write(`${JSON.stringify({ releaseSha: result.manifest.releaseSha, contentSetSha256: result.manifest.contentSetSha256, releaseManifestSha256: result.sha256, files: result.manifest.files.length })}\n`);
  } else {
    fail(`unknown content-manifest command: ${command}`);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Ariada Wiki content manifest failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
