#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const MONITOR_SAMPLE_KIND = "ariada-wiki-monitor-sample";
export const RELEASE_MANIFEST_KIND = "ariada-wiki-release";
export const RELEASE_MANIFEST_PATH = "/.well-known/ariada-release.json";
export const SHARD_COUNT = 576;
export const CADENCE_MS = 300_000;
export const PROBE_PATHS = Object.freeze([
  RELEASE_MANIFEST_PATH,
  "/",
  "/en/modules/",
  "/ru/modules/s1/",
  "/ar/modules/s1/",
  "/sitemap.xml",
  "/robots.txt",
]);
export const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_PUBLIC_FILE_BYTES = 64 * 1024 * 1024;
export const MAX_SAMPLE_AGE_MS = 15 * 60 * 1000;

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const DEPLOYMENT_PATTERN = /^[0-9a-f]{8}$/u;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const MAX_FAILURE_MESSAGE_LENGTH = 512;
const MAX_SAMPLE_DURATION_MS = 180_000;
const MAX_MANIFEST_FILES = 20_000;
const CLOUDFLARE_CONTROL_FILES = new Set(["_headers", "_redirects", "_routes.json", "_worker.js"]);
const FAILURE_CODES = new Set([
  "BODY_TOO_LARGE",
  "CONFIGURATION",
  "CONTENT_MISMATCH",
  "HTTP_STATUS",
  "IDENTITY_MISMATCH",
  "INVALID_CONTENT_TYPE",
  "INVALID_JSON",
  "MANIFEST_SCHEMA",
  "NETWORK",
  "TIMEOUT",
]);

export class MonitorError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MonitorError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new MonitorError(code, message);
}

function record(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("MANIFEST_SCHEMA", label + " must be an object");
  }
  return value;
}

function exactKeys(value, expectedKeys, label, code = "MANIFEST_SCHEMA") {
  const actual = Object.keys(record(value, label)).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(code, label + " has missing or unexpected fields");
  }
  return value;
}

function canonicalString(value, label, code = "MANIFEST_SCHEMA") {
  if (typeof value !== "string" || value === "" || value !== value.trim()) {
    fail(code, label + " must be a non-empty canonical string");
  }
  return value;
}

function exact(value, expected, label, code = "IDENTITY_MISMATCH") {
  if (value !== expected) fail(code, label + " does not match trusted release evidence");
  return value;
}

function sha(value, label, code = "MANIFEST_SCHEMA") {
  const parsed = canonicalString(value, label, code);
  if (!SHA_PATTERN.test(parsed)) fail(code, label + " must be exactly 40 lowercase hexadecimal characters");
  return parsed;
}

function digest(value, label, code = "MANIFEST_SCHEMA") {
  const parsed = canonicalString(value, label, code);
  if (!DIGEST_PATTERN.test(parsed)) fail(code, label + " must be exactly 64 lowercase hexadecimal characters");
  return parsed;
}

function deploymentId(value, label, code = "MANIFEST_SCHEMA") {
  const parsed = canonicalString(value, label, code);
  if (!DEPLOYMENT_PATTERN.test(parsed)) fail(code, label + " must be exactly 8 lowercase hexadecimal characters");
  return parsed;
}

function timestampMs(value, label, code = "MANIFEST_SCHEMA") {
  const parsed = canonicalString(value, label, code);
  const milliseconds = Date.parse(parsed);
  if (!ISO_PATTERN.test(parsed) || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== parsed) {
    fail(code, label + " must be a canonical ISO-8601 UTC timestamp");
  }
  return milliseconds;
}

function toMilliseconds(value, label) {
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(milliseconds)) fail("MANIFEST_SCHEMA", label + " is invalid");
  return milliseconds;
}

function nowIso(now) {
  return new Date(toMilliseconds(now(), "monitor clock")).toISOString();
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sanitizeMessage(value) {
  const message = String(value ?? "monitor operation failed")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .trim()
    .slice(0, MAX_FAILURE_MESSAGE_LENGTH);
  return message || "monitor operation failed";
}

function failureFrom(error) {
  if (error instanceof MonitorError) return { code: error.code, message: sanitizeMessage(error.message) };
  const name = typeof error?.name === "string" ? error.name : "";
  return {
    code: name === "AbortError" || name === "TimeoutError" ? "TIMEOUT" : "NETWORK",
    message: sanitizeMessage(error?.message ?? "request failed"),
  };
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function fiveMinuteBucket(value) {
  return Math.floor(toMilliseconds(value, "five-minute bucket time") / CADENCE_MS);
}

function normalizeDistPath(value, label = "manifest file path") {
  const path = canonicalString(value, label);
  if (
    path.startsWith("/") ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes("//") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    fail("MANIFEST_SCHEMA", label + " must be a canonical relative dist path");
  }
  if (path === ".well-known/ariada-release.json") {
    fail("MANIFEST_SCHEMA", "release manifest cannot list itself");
  }
  const first = path.split("/", 1)[0];
  if (CLOUDFLARE_CONTROL_FILES.has(path) || first === "_worker.js") {
    fail("MANIFEST_SCHEMA", "release manifest cannot list Cloudflare control files");
  }
  return path;
}

export function canonicalUrlForPath(value) {
  const path = normalizeDistPath(value);
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) {
    const directory = path.slice(0, -"index.html".length);
    return "/" + directory.split("/").filter(Boolean).map(encodeURIComponent).join("/") + "/";
  }
  return "/" + path.split("/").map(encodeURIComponent).join("/");
}

function normalizeFileEntry(value, label) {
  const entry = exactKeys(value, ["path", "url", "sha256", "bytes"], label);
  const path = normalizeDistPath(entry.path, label + " path");
  const url = canonicalString(entry.url, label + " url");
  exact(url, canonicalUrlForPath(path), label + " canonical URL", "MANIFEST_SCHEMA");
  const sha256 = digest(entry.sha256, label + " sha256");
  if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes > MAX_PUBLIC_FILE_BYTES) {
    fail("MANIFEST_SCHEMA", label + " bytes is outside the public-file bound");
  }
  return { path, url, sha256, bytes: entry.bytes };
}

export function computeContentSetSha256(files) {
  if (!Array.isArray(files)) fail("MANIFEST_SCHEMA", "manifest files must be an array");
  const normalized = files.map((entry, index) => normalizeFileEntry(entry, "manifest file " + index));
  normalized.sort((left, right) => compareText(left.path, right.path));
  return hashBytes(Buffer.from(JSON.stringify(normalized), "utf8"));
}

export function validateRcIdentity(value, context = {}) {
  const input = exactKeys(
    value,
    ["releaseSha", "artifactDigest", "manifestSha256", "contentSetSha256", "url", "deploymentId"],
    "release identity",
    "CONFIGURATION",
  );
  const releaseSha = sha(input.releaseSha, "post-merge release SHA", "CONFIGURATION");
  const artifactDigest = digest(input.artifactDigest, "release tar digest", "CONFIGURATION");
  const manifestSha256 = digest(input.manifestSha256, "release manifest byte digest", "CONFIGURATION");
  const contentSetSha256 = digest(input.contentSetSha256, "release content-set digest", "CONFIGURATION");
  const configuredDeploymentId = deploymentId(input.deploymentId, "release deployment ID", "CONFIGURATION");
  const rawUrl = canonicalString(input.url, "release URL", "CONFIGURATION");
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    fail("CONFIGURATION", "release URL must be a valid immutable Cloudflare Pages URL");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.port !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    (rawUrl !== parsed.origin && rawUrl !== parsed.origin + "/")
  ) {
    fail("CONFIGURATION", "release URL must be a bare canonical HTTPS origin");
  }
  const match = /^([0-9a-f]{8})\.ariada-wiki\.pages\.dev$/u.exec(parsed.hostname);
  if (!match) fail("CONFIGURATION", "release URL must use https://<8-hex>.ariada-wiki.pages.dev");
  exact(match[1], configuredDeploymentId, "hostname-derived deployment ID", "CONFIGURATION");
  if (context.workflowHeadSha !== undefined) {
    exact(
      sha(context.workflowHeadSha, "monitor workflow SHA", "CONFIGURATION"),
      releaseSha,
      "monitor workflow SHA and post-merge release SHA",
      "CONFIGURATION",
    );
  }
  return {
    releaseSha,
    workflowHeadSha: releaseSha,
    artifactDigest,
    manifestSha256,
    contentSetSha256,
    deploymentId: configuredDeploymentId,
    hostname: parsed.hostname,
    origin: parsed.origin,
  };
}

function validateSampleIdentity(value, label = "monitor sample identity") {
  const identity = exactKeys(
    value,
    ["releaseSha", "workflowHeadSha", "artifactDigest", "manifestSha256", "contentSetSha256", "deploymentId", "hostname", "origin"],
    label,
  );
  const normalized = validateRcIdentity(
    {
      releaseSha: identity.releaseSha,
      artifactDigest: identity.artifactDigest,
      manifestSha256: identity.manifestSha256,
      contentSetSha256: identity.contentSetSha256,
      url: identity.origin,
      deploymentId: identity.deploymentId,
    },
    { workflowHeadSha: identity.workflowHeadSha },
  );
  exact(canonicalString(identity.hostname, label + " hostname"), normalized.hostname, label + " hostname");
  return normalized;
}

function assertSameIdentity(actual, expected, label) {
  for (const key of [
    "releaseSha",
    "workflowHeadSha",
    "artifactDigest",
    "manifestSha256",
    "contentSetSha256",
    "deploymentId",
    "hostname",
    "origin",
  ]) {
    exact(actual[key], expected[key], label + " " + key);
  }
}

export function validateReleaseManifest(value, identityValue) {
  const identity = validateSampleIdentity(identityValue, "expected release identity");
  const root = exactKeys(
    value,
    ["schemaVersion", "kind", "releaseSha", "generatedAt", "contentSetSha256", "files"],
    "release manifest",
  );
  exact(root.schemaVersion, 1, "release manifest schemaVersion", "MANIFEST_SCHEMA");
  exact(root.kind, RELEASE_MANIFEST_KIND, "release manifest kind", "MANIFEST_SCHEMA");
  const releaseSha = sha(root.releaseSha, "release manifest releaseSha");
  exact(releaseSha, identity.releaseSha, "release manifest release SHA");
  const generatedAt = new Date(timestampMs(root.generatedAt, "release manifest generatedAt")).toISOString();
  const contentSetSha256 = digest(root.contentSetSha256, "release manifest contentSetSha256");
  exact(contentSetSha256, identity.contentSetSha256, "release manifest content-set digest");
  if (!Array.isArray(root.files) || root.files.length < 1 || root.files.length > MAX_MANIFEST_FILES) {
    fail("MANIFEST_SCHEMA", "release manifest files must contain between 1 and " + MAX_MANIFEST_FILES + " entries");
  }
  const files = root.files.map((entry, index) => normalizeFileEntry(entry, "release manifest file " + index));
  const paths = new Set();
  const urls = new Set();
  for (const [index, file] of files.entries()) {
    if (index > 0 && compareText(files[index - 1].path, file.path) >= 0) {
      fail("MANIFEST_SCHEMA", "release manifest files must be strictly sorted by path");
    }
    if (paths.has(file.path) || urls.has(file.url)) fail("MANIFEST_SCHEMA", "release manifest file path or URL is duplicated");
    paths.add(file.path);
    urls.add(file.url);
  }
  exact(computeContentSetSha256(files), contentSetSha256, "release manifest deterministic content-set digest");
  return {
    schemaVersion: 1,
    kind: RELEASE_MANIFEST_KIND,
    releaseSha,
    generatedAt,
    contentSetSha256,
    files,
  };
}

export function validateReleaseManifestBytes(value, identityValue) {
  const identity = validateSampleIdentity(identityValue, "expected release identity");
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  if (bytes.length < 1 || bytes.length > MAX_MANIFEST_BYTES) {
    fail("BODY_TOO_LARGE", "release manifest byte length is outside the allowed bound");
  }
  const manifestSha256 = hashBytes(bytes);
  exact(manifestSha256, identity.manifestSha256, "release manifest exact byte digest");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail("INVALID_JSON", "release manifest is not UTF-8");
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("INVALID_JSON", "release manifest is not valid JSON");
  }
  return { bytes, manifestSha256, manifest: validateReleaseManifest(parsed, identity) };
}

export function releaseManifestIdentity(manifest, manifestSha256) {
  return {
    releaseSha: manifest.releaseSha,
    manifestSha256,
    contentSetSha256: manifest.contentSetSha256,
    generatedAt: manifest.generatedAt,
    fileCount: manifest.files.length,
  };
}

export function selectFileShard(files, bucket) {
  if (!Array.isArray(files)) fail("MANIFEST_SCHEMA", "release manifest files are unavailable");
  if (!Number.isSafeInteger(bucket) || bucket < 0) fail("MANIFEST_SCHEMA", "sample bucket is invalid");
  const residue = bucket % SHARD_COUNT;
  return files.filter((unused, index) => index % SHARD_COUNT === residue);
}

async function readResponseBytes(response, maximumBytes, label) {
  const advertised = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertised) && advertised > maximumBytes) fail("BODY_TOO_LARGE", label + " exceeds its byte bound");
  if (response.body === null) return Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      total += chunk.length;
      if (total > maximumBytes) {
        await reader.cancel();
        fail("BODY_TOO_LARGE", label + " exceeds its byte bound");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof MonitorError) throw error;
    fail("NETWORK", label + " body is unreadable");
  }
  return Buffer.concat(chunks, total);
}

async function fetchResponse(url, accept, fetchImpl) {
  return fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: { accept, "user-agent": "ariada-wiki-rc-monitor/2" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function probeRecord(path, status, httpStatus, latencyMs, observedAt, failure) {
  return { path, status, httpStatus, latencyMs, observedAt, failure };
}

async function fetchManifest(identity, options) {
  const started = options.monotonicNow();
  let httpStatus = null;
  try {
    const response = await fetchResponse(identity.origin + RELEASE_MANIFEST_PATH, "application/json", options.fetchImpl);
    httpStatus = response.status;
    if (httpStatus !== 200) fail("HTTP_STATUS", RELEASE_MANIFEST_PATH + " returned HTTP " + httpStatus);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/iu.test(contentType)) {
      fail("INVALID_CONTENT_TYPE", "release manifest response must use an application/json content type");
    }
    const result = validateReleaseManifestBytes(
      await readResponseBytes(response, MAX_MANIFEST_BYTES, "release manifest"),
      identity,
    );
    return {
      probe: probeRecord(
        RELEASE_MANIFEST_PATH,
        "passed",
        httpStatus,
        Math.max(0, Math.round(options.monotonicNow() - started)),
        nowIso(options.now),
        null,
      ),
      ...result,
    };
  } catch (error) {
    return {
      probe: probeRecord(
        RELEASE_MANIFEST_PATH,
        "failed",
        httpStatus,
        Math.max(0, Math.round(options.monotonicNow() - started)),
        nowIso(options.now),
        failureFrom(error),
      ),
      bytes: null,
      manifestSha256: null,
      manifest: null,
    };
  }
}

async function probePath(path, identity, options) {
  const started = options.monotonicNow();
  let httpStatus = null;
  try {
    const response = await fetchResponse(identity.origin + path, "*/*", options.fetchImpl);
    httpStatus = response.status;
    if (httpStatus !== 200) fail("HTTP_STATUS", path + " returned HTTP " + httpStatus);
    if (response.body !== null) await response.body.cancel();
    return probeRecord(
      path,
      "passed",
      httpStatus,
      Math.max(0, Math.round(options.monotonicNow() - started)),
      nowIso(options.now),
      null,
    );
  } catch (error) {
    return probeRecord(
      path,
      "failed",
      httpStatus,
      Math.max(0, Math.round(options.monotonicNow() - started)),
      nowIso(options.now),
      failureFrom(error),
    );
  }
}

async function checkFile(file, identity, options) {
  const started = options.monotonicNow();
  let httpStatus = null;
  let actualSha256 = null;
  let actualBytes = null;
  try {
    const response = await fetchResponse(identity.origin + file.url, "*/*", options.fetchImpl);
    httpStatus = response.status;
    if (httpStatus !== 200) fail("HTTP_STATUS", file.url + " returned HTTP " + httpStatus);
    const bytes = await readResponseBytes(response, Math.min(MAX_PUBLIC_FILE_BYTES, file.bytes + 1), file.url);
    actualBytes = bytes.length;
    actualSha256 = hashBytes(bytes);
    if (actualBytes !== file.bytes || actualSha256 !== file.sha256) {
      fail("CONTENT_MISMATCH", file.url + " bytes or SHA-256 do not match the release manifest");
    }
    return {
      path: file.path,
      url: file.url,
      status: "passed",
      httpStatus,
      latencyMs: Math.max(0, Math.round(options.monotonicNow() - started)),
      observedAt: nowIso(options.now),
      sha256: actualSha256,
      bytes: actualBytes,
      failure: null,
    };
  } catch (error) {
    return {
      path: file.path,
      url: file.url,
      status: "failed",
      httpStatus,
      latencyMs: Math.max(0, Math.round(options.monotonicNow() - started)),
      observedAt: nowIso(options.now),
      sha256: actualSha256,
      bytes: actualBytes,
      failure: failureFrom(error),
    };
  }
}

async function mapLimit(values, limit, mapper) {
  const output = new Array(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return output;
}

export async function runMonitor({
  identity: identityValue,
  fetchImpl = fetch,
  now = () => new Date(),
  monotonicNow = () => performance.now(),
} = {}) {
  const identity = validateSampleIdentity(identityValue, "monitor identity");
  if (typeof fetchImpl !== "function") fail("CONFIGURATION", "monitor fetch implementation is unavailable");
  const observedAt = nowIso(now);
  const bucket = fiveMinuteBucket(observedAt);
  const options = { fetchImpl, now, monotonicNow };
  const manifestResult = await fetchManifest(identity, options);
  const otherProbes = await Promise.all(PROBE_PATHS.slice(1).map((path) => probePath(path, identity, options)));
  const shard = manifestResult.manifest === null ? [] : selectFileShard(manifestResult.manifest.files, bucket);
  const checkedFiles = await mapLimit(shard, 6, (file) => checkFile(file, identity, options));
  const probes = [manifestResult.probe, ...otherProbes];
  const status = manifestResult.manifest !== null &&
    probes.every((probe) => probe.status === "passed") &&
    checkedFiles.every((file) => file.status === "passed")
    ? "passed"
    : "failed";
  const sample = {
    schemaVersion: 1,
    kind: MONITOR_SAMPLE_KIND,
    observedAt,
    bucket,
    status,
    identity,
    manifest: manifestResult.manifest === null
      ? null
      : releaseManifestIdentity(manifestResult.manifest, manifestResult.manifestSha256),
    probes,
    checkedFiles,
  };
  return validateMonitorSample(sample, {
    expectedIdentity: identity,
    manifest: manifestResult.manifest ?? undefined,
  });
}

export function createConfigurationFailureSample(error, { now = () => new Date() } = {}) {
  const observedAt = nowIso(now);
  const failure = { code: "CONFIGURATION", message: sanitizeMessage(error instanceof Error ? error.message : error) };
  return {
    schemaVersion: 1,
    kind: MONITOR_SAMPLE_KIND,
    observedAt,
    bucket: fiveMinuteBucket(observedAt),
    status: "failed",
    identity: null,
    manifest: null,
    probes: PROBE_PATHS.map((path) => probeRecord(path, "failed", null, 0, observedAt, failure)),
    checkedFiles: [],
  };
}

function validateFailure(value, label) {
  if (value === null) return null;
  const failure = exactKeys(value, ["code", "message"], label);
  const code = canonicalString(failure.code, label + " code");
  if (!FAILURE_CODES.has(code)) fail("MANIFEST_SCHEMA", label + " code is unknown");
  const message = canonicalString(failure.message, label + " message");
  if (message.length > MAX_FAILURE_MESSAGE_LENGTH) fail("MANIFEST_SCHEMA", label + " message is too long");
  return { code, message };
}

function validateManifestIdentity(value, identity, manifest) {
  const root = exactKeys(
    value,
    ["releaseSha", "manifestSha256", "contentSetSha256", "generatedAt", "fileCount"],
    "sample manifest identity",
  );
  const normalized = {
    releaseSha: sha(root.releaseSha, "sample manifest releaseSha"),
    manifestSha256: digest(root.manifestSha256, "sample manifest byte digest"),
    contentSetSha256: digest(root.contentSetSha256, "sample manifest content-set digest"),
    generatedAt: new Date(timestampMs(root.generatedAt, "sample manifest generatedAt")).toISOString(),
    fileCount: root.fileCount,
  };
  if (!Number.isSafeInteger(normalized.fileCount) || normalized.fileCount < 1 || normalized.fileCount > MAX_MANIFEST_FILES) {
    fail("MANIFEST_SCHEMA", "sample manifest fileCount is invalid");
  }
  exact(normalized.releaseSha, identity.releaseSha, "sample manifest release SHA");
  exact(normalized.manifestSha256, identity.manifestSha256, "sample manifest byte digest");
  exact(normalized.contentSetSha256, identity.contentSetSha256, "sample manifest content-set digest");
  if (manifest !== undefined) {
    exact(normalized.generatedAt, manifest.generatedAt, "sample manifest generatedAt");
    exact(normalized.fileCount, manifest.files.length, "sample manifest file count");
  }
  return normalized;
}

function validateProbe(value, path, sampleObservedAtMs, index) {
  const label = "monitor probe " + index;
  const probe = exactKeys(value, ["path", "status", "httpStatus", "latencyMs", "observedAt", "failure"], label);
  exact(probe.path, path, label + " path", "MANIFEST_SCHEMA");
  if (probe.status !== "passed" && probe.status !== "failed") fail("MANIFEST_SCHEMA", label + " status is invalid");
  const observedAtMs = timestampMs(probe.observedAt, label + " observedAt");
  if (observedAtMs < sampleObservedAtMs - 5_000 || observedAtMs - sampleObservedAtMs > MAX_SAMPLE_DURATION_MS) {
    fail("MANIFEST_SCHEMA", label + " timestamp falls outside the sample window");
  }
  if (!Number.isInteger(probe.latencyMs) || probe.latencyMs < 0 || probe.latencyMs > MAX_SAMPLE_DURATION_MS) {
    fail("MANIFEST_SCHEMA", label + " latency is invalid");
  }
  if (probe.httpStatus !== null && (!Number.isInteger(probe.httpStatus) || probe.httpStatus < 100 || probe.httpStatus > 599)) {
    fail("MANIFEST_SCHEMA", label + " HTTP status is invalid");
  }
  const failure = validateFailure(probe.failure, label + " failure");
  if (probe.status === "passed") {
    exact(probe.httpStatus, 200, label + " HTTP status", "MANIFEST_SCHEMA");
    if (failure !== null) fail("MANIFEST_SCHEMA", label + " passed with failure details");
  } else if (failure === null) {
    fail("MANIFEST_SCHEMA", label + " failed without failure details");
  }
  return {
    path,
    status: probe.status,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    observedAt: new Date(observedAtMs).toISOString(),
    failure,
  };
}

function validateCheckedFile(value, sampleObservedAtMs, expected, index) {
  const label = "checked file " + index;
  const file = exactKeys(
    value,
    ["path", "url", "status", "httpStatus", "latencyMs", "observedAt", "sha256", "bytes", "failure"],
    label,
  );
  const path = normalizeDistPath(file.path, label + " path");
  const url = canonicalString(file.url, label + " url");
  exact(url, canonicalUrlForPath(path), label + " canonical URL", "MANIFEST_SCHEMA");
  if (file.status !== "passed" && file.status !== "failed") fail("MANIFEST_SCHEMA", label + " status is invalid");
  const observedAtMs = timestampMs(file.observedAt, label + " observedAt");
  if (observedAtMs < sampleObservedAtMs - 5_000 || observedAtMs - sampleObservedAtMs > MAX_SAMPLE_DURATION_MS) {
    fail("MANIFEST_SCHEMA", label + " timestamp falls outside the sample window");
  }
  if (!Number.isInteger(file.latencyMs) || file.latencyMs < 0 || file.latencyMs > MAX_SAMPLE_DURATION_MS) {
    fail("MANIFEST_SCHEMA", label + " latency is invalid");
  }
  if (file.httpStatus !== null && (!Number.isInteger(file.httpStatus) || file.httpStatus < 100 || file.httpStatus > 599)) {
    fail("MANIFEST_SCHEMA", label + " HTTP status is invalid");
  }
  const sha256 = file.sha256 === null ? null : digest(file.sha256, label + " sha256");
  if (file.bytes !== null && (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || file.bytes > MAX_PUBLIC_FILE_BYTES)) {
    fail("MANIFEST_SCHEMA", label + " bytes is invalid");
  }
  const failure = validateFailure(file.failure, label + " failure");
  if (expected !== undefined) {
    exact(path, expected.path, label + " path");
    exact(url, expected.url, label + " URL");
  }
  if (file.status === "passed") {
    exact(file.httpStatus, 200, label + " HTTP status", "MANIFEST_SCHEMA");
    if (failure !== null || sha256 === null || file.bytes === null) fail("MANIFEST_SCHEMA", label + " passed without exact bytes");
    if (expected !== undefined) {
      exact(sha256, expected.sha256, label + " SHA-256");
      exact(file.bytes, expected.bytes, label + " byte length");
    }
  } else if (failure === null) {
    fail("MANIFEST_SCHEMA", label + " failed without failure details");
  }
  return {
    path,
    url,
    status: file.status,
    httpStatus: file.httpStatus,
    latencyMs: file.latencyMs,
    observedAt: new Date(observedAtMs).toISOString(),
    sha256,
    bytes: file.bytes,
    failure,
  };
}

export function validateMonitorSample(value, context = {}) {
  const root = exactKeys(
    value,
    ["schemaVersion", "kind", "observedAt", "bucket", "status", "identity", "manifest", "probes", "checkedFiles"],
    "monitor sample",
  );
  exact(root.schemaVersion, 1, "monitor sample schemaVersion", "MANIFEST_SCHEMA");
  exact(root.kind, MONITOR_SAMPLE_KIND, "monitor sample kind", "MANIFEST_SCHEMA");
  const observedAtMs = timestampMs(root.observedAt, "monitor sample observedAt");
  if (!Number.isSafeInteger(root.bucket) || root.bucket < 0) fail("MANIFEST_SCHEMA", "monitor sample bucket is invalid");
  exact(root.bucket, fiveMinuteBucket(observedAtMs), "monitor sample UTC five-minute bucket", "MANIFEST_SCHEMA");
  if (root.status !== "passed" && root.status !== "failed") fail("MANIFEST_SCHEMA", "monitor sample status is invalid");

  let identity = null;
  if (root.identity !== null) identity = validateSampleIdentity(root.identity);
  let expectedIdentity;
  if (context.expectedIdentity !== undefined) {
    expectedIdentity = validateSampleIdentity(context.expectedIdentity, "expected monitor identity");
    if (identity === null) fail("IDENTITY_MISMATCH", "monitor sample identity is absent");
    assertSameIdentity(identity, expectedIdentity, "monitor sample identity");
  }

  let manifestIdentity = null;
  if (root.manifest !== null) {
    if (identity === null) fail("IDENTITY_MISMATCH", "sample manifest cannot bind a missing identity");
    manifestIdentity = validateManifestIdentity(root.manifest, identity, context.manifest);
  } else if (context.manifest !== undefined) {
    fail("IDENTITY_MISMATCH", "monitor sample did not byte-verify the canonical manifest");
  }

  if (!Array.isArray(root.probes) || root.probes.length !== PROBE_PATHS.length) {
    fail("MANIFEST_SCHEMA", "monitor sample must contain exactly " + PROBE_PATHS.length + " endpoint probes");
  }
  const probes = root.probes.map((probe, index) => validateProbe(probe, PROBE_PATHS[index], observedAtMs, index));

  if (!Array.isArray(root.checkedFiles)) fail("MANIFEST_SCHEMA", "monitor checkedFiles must be an array");
  const expectedShard = context.manifest === undefined ? undefined : selectFileShard(context.manifest.files, root.bucket);
  if (expectedShard !== undefined && root.checkedFiles.length !== expectedShard.length) {
    fail("IDENTITY_MISMATCH", "monitor sample file shard is missing or has unexpected entries");
  }
  const checkedFiles = root.checkedFiles.map((file, index) =>
    validateCheckedFile(file, observedAtMs, expectedShard?.[index], index),
  );
  const duplicatePaths = new Set();
  for (const file of checkedFiles) {
    if (duplicatePaths.has(file.path)) fail("MANIFEST_SCHEMA", "monitor checked file path is duplicated");
    duplicatePaths.add(file.path);
  }

  const shouldPass = identity !== null &&
    manifestIdentity !== null &&
    probes.every((probe) => probe.status === "passed") &&
    checkedFiles.every((file) => file.status === "passed");
  exact(root.status, shouldPass ? "passed" : "failed", "monitor sample aggregate status", "MANIFEST_SCHEMA");

  if (context.notBefore !== undefined && observedAtMs < toMilliseconds(context.notBefore, "sample lower bound") - 5_000) {
    fail("MANIFEST_SCHEMA", "monitor sample predates its trusted workflow run");
  }
  if (context.notAfter !== undefined && observedAtMs > toMilliseconds(context.notAfter, "sample upper bound") + 5_000) {
    fail("MANIFEST_SCHEMA", "monitor sample postdates its trusted workflow run");
  }
  if (context.now !== undefined && context.maxAgeMs !== undefined) {
    const age = toMilliseconds(context.now, "sample evaluation time") - observedAtMs;
    if (age < 0 || age > context.maxAgeMs) fail("MANIFEST_SCHEMA", "monitor sample is stale or future-dated");
  }
  return {
    schemaVersion: 1,
    kind: MONITOR_SAMPLE_KIND,
    observedAt: new Date(observedAtMs).toISOString(),
    bucket: root.bucket,
    status: root.status,
    identity,
    manifest: manifestIdentity,
    probes,
    checkedFiles,
  };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    fail("MANIFEST_SCHEMA", label + " is absent or unreadable");
  }
  try {
    return JSON.parse(text);
  } catch {
    fail("INVALID_JSON", label + " is not valid JSON");
  }
}

function requiredOption(values, name) {
  const value = values[name];
  if (typeof value !== "string") fail("CONFIGURATION", "--" + name + " is required");
  return value;
}

function identityFromOptions(values) {
  return validateRcIdentity(
    {
      releaseSha: requiredOption(values, "release-sha"),
      artifactDigest: requiredOption(values, "artifact-digest"),
      manifestSha256: requiredOption(values, "manifest-sha256"),
      contentSetSha256: requiredOption(values, "content-set-sha256"),
      url: requiredOption(values, "url"),
      deploymentId: requiredOption(values, "deployment-id"),
    },
    { workflowHeadSha: requiredOption(values, "workflow-head-sha") },
  );
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  const { values } = parseArgs({
    args: argv.slice(1),
    strict: true,
    options: {
      output: { type: "string" },
      sample: { type: "string" },
      "release-sha": { type: "string" },
      "artifact-digest": { type: "string" },
      "manifest-sha256": { type: "string" },
      "content-set-sha256": { type: "string" },
      url: { type: "string" },
      "deployment-id": { type: "string" },
      "workflow-head-sha": { type: "string" },
    },
  });
  if (command === "probe") {
    const output = requiredOption(values, "output");
    let sample;
    try {
      sample = await runMonitor({ identity: identityFromOptions(values) });
    } catch (error) {
      sample = createConfigurationFailureSample(error);
    }
    await writeJson(output, sample);
    console.log("Ariada Wiki release monitor sample recorded as " + sample.status + ".");
    return;
  }
  if (command === "assert") {
    const identity = identityFromOptions(values);
    const sample = validateMonitorSample(
      await readJson(requiredOption(values, "sample"), "monitor sample"),
      { expectedIdentity: identity, now: new Date(), maxAgeMs: MAX_SAMPLE_AGE_MS },
    );
    if (sample.status !== "passed") fail("NETWORK", "Ariada Wiki release monitor sample is unhealthy");
    console.log("Ariada Wiki release monitor sample is healthy.");
    return;
  }
  fail("CONFIGURATION", "usage: wiki-rc-monitor.mjs <probe|assert> [options]");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error("wiki-rc-monitor: " + sanitizeMessage(error?.message ?? error));
    process.exitCode = 1;
  });
}
