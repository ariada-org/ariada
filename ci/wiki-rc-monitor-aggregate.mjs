#!/usr/bin/env node

import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import {
  CADENCE_MS,
  SHARD_COUNT,
  fiveMinuteBucket,
  releaseManifestIdentity,
  validateMonitorSample,
  validateRcIdentity,
  validateReleaseManifest,
  validateReleaseManifestBytes,
} from "./wiki-rc-monitor.mjs";

// Integration contract:
// - Senko dispatches this workflow on the default branch every five minutes with
//   aggregate=false. GitHub schedule is an optional fallback stream only.
// - A trusted operator dispatches aggregate=true after the 48-hour window.
// - GitHub's workflow-run API returns `path` as the plain workflow path. The ref
//   is trusted separately through head_branch/head_sha; `path@main` is invalid.
// - ARIADA_WIKI_CANARY_ARTIFACT_ID identifies the trusted RC workflow artifact
//   containing exactly canary-evidence.json and release-manifest.json. The gate
//   retrieves both this artifact and the final aggregate by numeric artifact ID;
//   it never discovers either artifact through repository-global name listing.
// - After upload, ARIADA_WIKI_MONITOR_ARTIFACT_ID identifies the release-specific
//   aggregate artifact consumed by the independent promotion gate.

export const TRUSTED_MONITOR_WORKFLOW_PATH =
  ".github/workflows/ariada-wiki-monitor.yml";
export const TRUSTED_CANARY_WORKFLOW_PATH = ".github/workflows/ariada-wiki-rc.yml";
export const MONITOR_ARTIFACT_NAME_PREFIX = "ariada-wiki-monitor-sample-";
export const CANARY_ARTIFACT_NAME_PREFIX = "ariada-wiki-canary-evidence-";
export const MONITOR_EVIDENCE_ARTIFACT_NAME_PREFIX = "ariada-wiki-monitor-evidence-";
export const MONITOR_SAMPLE_FILE = "sample.json";
export const CANARY_EVIDENCE_FILE = "canary-evidence.json";
export const RELEASE_MANIFEST_FILE = "release-manifest.json";
export const MIN_SAMPLES = SHARD_COUNT;
export const MIN_WINDOW_MS = 48 * 60 * 60 * 1000;
export const MIN_GAP_MS = 4 * 60 * 1000;
export const MAX_GAP_MS = 6 * 60 * 1000;
export const MAX_FINAL_AGE_MS = 10 * 60 * 1000;
export const MIN_DISPATCH_PERCENT = 95;
export const MAX_RUN_PAGES_PER_EVENT = 10;
export const MAX_ARTIFACT_PAGES = 20;
export const MAX_ARCHIVE_DOWNLOADS = 800;
export const DOWNLOAD_CONCURRENCY = 12;
export const MAX_SAMPLE_ARCHIVE_BYTES = 4 * 1024 * 1024;
export const MAX_CANARY_ARCHIVE_BYTES = 4 * 1024 * 1024;
export const MAX_ZIP_ENTRY_BYTES = 2 * 1024 * 1024;
export const MAX_EVIDENCE_BUCKETS = 800;

const TERMINAL_CONCLUSIONS = new Set([
  "success",
  "failure",
  "cancelled",
  "timed_out",
  "action_required",
  "neutral",
  "skipped",
  "stale",
  "startup_failure",
]);

export class AggregateError extends Error {
  constructor(message) {
    super(message);
    this.name = "AggregateError";
  }
}

function fail(message) {
  throw new AggregateError(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function object(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function exactKeys(value, expected, label) {
  object(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted), `${label} has unexpected or missing fields`);
}

function string(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
  return value;
}

function integer(value, label) {
  assert(Number.isSafeInteger(value) && value > 0, `${label} must be a positive safe integer`);
  return value;
}

function timestamp(value, label) {
  string(value, label);
  const milliseconds = Date.parse(value);
  assert(Number.isFinite(milliseconds), `${label} must be an ISO timestamp`);
  assert(new Date(milliseconds).toISOString() === value, `${label} must be canonical UTC ISO-8601`);
  return milliseconds;
}

function apiTimestamp(value, label) {
  string(value, label);
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value),
    `${label} must be a GitHub API UTC timestamp`);
  const milliseconds = Date.parse(value);
  assert(Number.isFinite(milliseconds), `${label} must be a GitHub API UTC timestamp`);
  const canonical = new Date(milliseconds).toISOString();
  assert(value === canonical || value === canonical.replace(".000Z", "Z"),
    `${label} must be a canonical GitHub API UTC timestamp`);
  return milliseconds;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizedApiDigest(value, label) {
  assert(typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value), `${label} must be sha256:<64 lowercase hex>`);
  return value;
}

function releaseArtifactName(prefix, releaseSha) {
  assert(typeof releaseSha === "string" && /^[0-9a-f]{40}$/.test(releaseSha),
    "artifact release SHA must be exactly 40 lowercase hexadecimal characters");
  return `${prefix}${releaseSha}`;
}

export function monitorSampleArtifactName(releaseSha) {
  return releaseArtifactName(MONITOR_ARTIFACT_NAME_PREFIX, releaseSha);
}

export function canaryArtifactName(releaseSha) {
  return releaseArtifactName(CANARY_ARTIFACT_NAME_PREFIX, releaseSha);
}

export function monitorEvidenceArtifactName(releaseSha) {
  return releaseArtifactName(MONITOR_EVIDENCE_ARTIFACT_NAME_PREFIX, releaseSha);
}

function actorLogin(value, label) {
  object(value, label);
  return string(value.login, `${label}.login`);
}

function runId(value, label = "run id") {
  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) {
    const parsed = Number(value);
    assert(Number.isSafeInteger(parsed), `${label} is outside the safe integer range`);
    return parsed;
  }
  return integer(value, label);
}

function compareRunIds(left, right) {
  return runId(left) - runId(right);
}

function expectedIdentity(identity) {
  object(identity, "identity");
  return validateRcIdentity(
    {
      releaseSha: identity.releaseSha,
      artifactDigest: identity.artifactDigest,
      manifestSha256: identity.manifestSha256,
      contentSetSha256: identity.contentSetSha256,
      url: identity.url ?? identity.origin,
      deploymentId: identity.deploymentId,
    },
    { workflowHeadSha: identity.releaseSha },
  );
}

export function validateWorkflowRun(run, {
  identity,
  repository,
  defaultBranch = "main",
  dispatchActor,
  currentRunId,
  workflowPath = TRUSTED_MONITOR_WORKFLOW_PATH,
  allowedEvents = ["workflow_dispatch", "schedule"],
} = {}) {
  object(run, "workflow run");
  const id = runId(run.id, "workflow run.id");
  const event = string(run.event, `workflow run ${id}.event`);
  assert(allowedEvents.includes(event), `workflow run ${id} has untrusted event ${event}`);
  assert(run.path === workflowPath, `workflow run ${id} path must be exactly ${workflowPath}`);
  assert(!run.path.includes("@"), `workflow run ${id} path must not contain a ref`);
  assert(run.head_branch === defaultBranch, `workflow run ${id} is not on ${defaultBranch}`);
  assert(run.head_sha === identity.releaseSha, `workflow run ${id} head_sha does not match releaseSha`);
  assert(run.repository?.full_name === repository, `workflow run ${id} repository mismatch`);
  assert(run.head_repository?.full_name === repository, `workflow run ${id} head repository mismatch`);
  integer(run.workflow_id, `workflow run ${id}.workflow_id`);

  const actor = actorLogin(run.actor, `workflow run ${id}.actor`);
  const triggeringActor = actorLogin(run.triggering_actor, `workflow run ${id}.triggering_actor`);
  if (event === "workflow_dispatch") {
    assert(actor === dispatchActor, `workflow run ${id} dispatch actor is untrusted`);
    assert(triggeringActor === dispatchActor, `workflow run ${id} triggering actor is untrusted`);
  }

  const isCurrent = currentRunId !== undefined && currentRunId !== null &&
    id === runId(currentRunId, "currentRunId");
  if (isCurrent) {
    assert(event === "workflow_dispatch", "current aggregate run must be workflow_dispatch");
    assert(run.status === "in_progress", "current aggregate run must be in progress");
    assert(run.conclusion === null, "current aggregate run must not have a conclusion yet");
  } else {
    assert(run.status === "completed", `historical workflow run ${id} is not completed`);
    assert(TERMINAL_CONCLUSIONS.has(run.conclusion), `historical workflow run ${id} has invalid conclusion`);
  }

  const createdAtMs = apiTimestamp(run.created_at, `workflow run ${id}.created_at`);
  const updatedAtMs = apiTimestamp(run.updated_at, `workflow run ${id}.updated_at`);
  assert(updatedAtMs >= createdAtMs, `workflow run ${id} timestamps are reversed`);

  return {
    id,
    event,
    workflowPath: run.path,
    workflowId: run.workflow_id,
    workflowHeadSha: run.head_sha,
    headBranch: run.head_branch,
    repository,
    actor,
    triggeringActor,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    createdAtMs,
    updatedAtMs,
    isCurrent,
  };
}

export function validateArtifactMetadata(artifact, run, {
  expectedName = monitorSampleArtifactName(run.workflowHeadSha),
  maxBytes = MAX_SAMPLE_ARCHIVE_BYTES,
} = {}) {
  object(artifact, "artifact");
  const id = integer(artifact.id, "artifact.id");
  assert(artifact.name === expectedName, `artifact ${id} name must be exactly ${expectedName}`);
  assert(artifact.expired === false, `artifact ${id} is expired`);
  assert(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= maxBytes,
    `artifact ${id} size is invalid`);
  const digest = normalizedApiDigest(artifact.digest, `artifact ${id}.digest`);
  object(artifact.workflow_run, `artifact ${id}.workflow_run`);
  assert(runId(artifact.workflow_run.id, `artifact ${id}.workflow_run.id`) === run.id,
    `artifact ${id} run id mismatch`);
  assert(artifact.workflow_run.head_branch === run.headBranch, `artifact ${id} head branch mismatch`);
  assert(artifact.workflow_run.head_sha === run.workflowHeadSha, `artifact ${id} head SHA mismatch`);
  const createdAtMs = apiTimestamp(artifact.created_at, `artifact ${id}.created_at`);
  const updatedAtMs = apiTimestamp(artifact.updated_at, `artifact ${id}.updated_at`);
  assert(updatedAtMs >= createdAtMs, `artifact ${id} timestamps are reversed`);
  assert(createdAtMs >= run.createdAtMs - 5_000, `artifact ${id} predates its workflow run`);
  assert(updatedAtMs <= run.updatedAtMs + 5_000, `artifact ${id} is outside its workflow run boundary`);
  return {
    id,
    name: artifact.name,
    sizeInBytes: artifact.size_in_bytes,
    digest,
    runId: run.id,
    createdAt: artifact.created_at,
    updatedAt: artifact.updated_at,
    createdAtMs,
    updatedAtMs,
    evidenceBucket: fiveMinuteBucket(createdAtMs),
  };
}

export function artifactObservationBucket(artifact) {
  object(artifact, "artifact");
  if (Number.isSafeInteger(artifact.evidenceBucket) && artifact.evidenceBucket >= 0) {
    return artifact.evidenceBucket;
  }
  return fiveMinuteBucket(apiTimestamp(artifact.created_at, `artifact ${artifact.id}.created_at`));
}

export function selectScheduleFallbackRunIds({
  runs,
  artifactsByRun,
  missingDispatchBuckets,
} = {}) {
  assert(Array.isArray(runs), "fallback workflow runs must be an array");
  assert(artifactsByRun instanceof Map, "fallback artifactsByRun must be a Map");
  assert(missingDispatchBuckets instanceof Set, "missing dispatch buckets must be a Set");
  return runs
    .filter((run) => run.event === "schedule")
    .map((run) => {
      const artifact = artifactsByRun.get(run.id);
      assert(artifact, `schedule workflow run ${run.id} has no trusted artifact metadata`);
      return { runId: run.id, bucket: artifactObservationBucket(artifact) };
    })
    .filter(({ bucket }) => missingDispatchBuckets.has(bucket))
    .sort((left, right) => left.bucket - right.bucket || left.runId - right.runId)
    .map(({ runId: id }) => id);
}

function locateEndOfCentralDirectory(archive) {
  const minimum = Math.max(0, archive.length - 65_557);
  for (let offset = archive.length - 22; offset >= minimum; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  fail("artifact archive has no ZIP end-of-central-directory record");
}

function zipEntries(archive, maxArchiveBytes) {
  assert(Buffer.isBuffer(archive), "artifact archive must be a Buffer");
  assert(archive.length > 0 && archive.length <= maxArchiveBytes, "artifact archive exceeds the size bound");
  const eocd = locateEndOfCentralDirectory(archive);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  assert(entryCount !== 0xffff && centralSize !== 0xffffffff && centralOffset !== 0xffffffff,
    "ZIP64 artifact archives are not accepted");
  assert(entryCount > 0 && entryCount <= 10, "artifact archive entry count is invalid");
  assert(centralOffset + centralSize <= eocd, "artifact central directory is out of bounds");

  const entries = [];
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assert(cursor + 46 <= archive.length && archive.readUInt32LE(cursor) === 0x02014b50,
      "artifact central directory is malformed");
    const flags = archive.readUInt16LE(cursor + 8);
    const compression = archive.readUInt16LE(cursor + 10);
    const compressedBytes = archive.readUInt32LE(cursor + 20);
    const uncompressedBytes = archive.readUInt32LE(cursor + 24);
    const nameBytes = archive.readUInt16LE(cursor + 28);
    const extraBytes = archive.readUInt16LE(cursor + 30);
    const commentBytes = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    assert((flags & 0x1) === 0, "encrypted artifact entries are not accepted");
    assert(compression === 0 || compression === 8, "unsupported artifact ZIP compression");
    assert(uncompressedBytes <= MAX_ZIP_ENTRY_BYTES, "artifact ZIP entry exceeds the size bound");
    assert(cursor + 46 + nameBytes + extraBytes + commentBytes <= archive.length,
      "artifact central-directory entry is out of bounds");
    const name = archive.subarray(cursor + 46, cursor + 46 + nameBytes).toString("utf8");
    assert(name.length > 0 && !name.includes("\\") && !name.startsWith("/") && !name.split("/").includes(".."),
      "artifact ZIP entry has an unsafe name");
    assert(localOffset + 30 <= archive.length && archive.readUInt32LE(localOffset) === 0x04034b50,
      "artifact local ZIP header is malformed");
    const localNameBytes = archive.readUInt16LE(localOffset + 26);
    const localExtraBytes = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
    assert(dataOffset + compressedBytes <= archive.length, "artifact ZIP entry data is out of bounds");
    const compressed = archive.subarray(dataOffset, dataOffset + compressedBytes);
    const bytes = compression === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_ZIP_ENTRY_BYTES });
    assert(bytes.length === uncompressedBytes, "artifact ZIP entry size mismatch");
    entries.push({ name, bytes });
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  assert(cursor === centralOffset + centralSize, "artifact central-directory size mismatch");
  return entries;
}

function exactArchiveFiles(archive, expectedNames, maxArchiveBytes) {
  const entries = zipEntries(archive, maxArchiveBytes).filter((entry) => !entry.name.endsWith("/"));
  const names = entries.map((entry) => entry.name).sort();
  const expected = [...expectedNames].sort();
  assert(JSON.stringify(names) === JSON.stringify(expected), "artifact archive has unexpected or missing files");
  return new Map(entries.map((entry) => [entry.name, entry.bytes]));
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${label} is not valid JSON`);
  }
}

function verifyArchiveDigest(archive, apiDigest, label) {
  const expected = normalizedApiDigest(apiDigest, `${label} API digest`).slice("sha256:".length);
  assert(sha256(archive) === expected, `${label} archive does not match its GitHub API digest`);
}

export function decodeSampleArchive(archive, apiDigest) {
  verifyArchiveDigest(archive, apiDigest, "monitor sample");
  const files = exactArchiveFiles(archive, [MONITOR_SAMPLE_FILE], MAX_SAMPLE_ARCHIVE_BYTES);
  return parseJsonBytes(files.get(MONITOR_SAMPLE_FILE), MONITOR_SAMPLE_FILE);
}

export function decodeCanaryArchive(archive, apiDigest, identity) {
  verifyArchiveDigest(archive, apiDigest, "canary");
  const files = exactArchiveFiles(
    archive,
    [CANARY_EVIDENCE_FILE, RELEASE_MANIFEST_FILE],
    MAX_CANARY_ARCHIVE_BYTES,
  );
  const releaseManifestBytes = files.get(RELEASE_MANIFEST_FILE);
  const manifestResult = validateReleaseManifestBytes(releaseManifestBytes, identity);
  const manifest = manifestResult.manifest;
  const evidence = parseJsonBytes(files.get(CANARY_EVIDENCE_FILE), CANARY_EVIDENCE_FILE);
  exactKeys(evidence, [
    "schemaVersion",
    "kind",
    "releaseSha",
    "finalTarSha256",
    "releaseManifestSha256",
    "contentSetSha256",
    "deploymentId",
    "hostname",
    "startedAt",
    "verifiedAt",
  ], "canary evidence");
  assert(evidence.schemaVersion === 1, "canary evidence schemaVersion must be 1");
  assert(evidence.kind === "ariada-wiki-canary-evidence", "canary evidence kind mismatch");
  assert(evidence.releaseSha === identity.releaseSha, "canary releaseSha mismatch");
  assert(evidence.finalTarSha256 === identity.artifactDigest, "canary final tar SHA mismatch");
  assert(evidence.releaseManifestSha256 === identity.manifestSha256, "canary manifest SHA mismatch");
  assert(evidence.contentSetSha256 === identity.contentSetSha256, "canary content-set SHA mismatch");
  assert(evidence.deploymentId === identity.deploymentId, "canary deployment ID mismatch");
  assert(evidence.hostname === identity.hostname, "canary hostname mismatch");
  const startedAtMs = timestamp(evidence.startedAt, "canary evidence.startedAt");
  const verifiedAtMs = timestamp(evidence.verifiedAt, "canary evidence.verifiedAt");
  assert(verifiedAtMs >= startedAtMs, "canary evidence timestamps are reversed");
  return { evidence, manifest, releaseManifestBytes: manifestResult.bytes, startedAtMs, verifiedAtMs };
}

function validateCanaryContext(canary, identity, repository, defaultBranch) {
  object(canary, "canary");
  assert(canary.releaseSha === identity.releaseSha, "canary context releaseSha mismatch");
  assert(canary.finalTarSha256 === identity.artifactDigest, "canary context final tar SHA mismatch");
  assert(canary.manifestSha256 === identity.manifestSha256, "canary context manifest SHA mismatch");
  assert(canary.contentSetSha256 === identity.contentSetSha256, "canary context content-set SHA mismatch");
  assert(canary.deploymentId === identity.deploymentId, "canary context deployment ID mismatch");
  assert(canary.hostname === identity.hostname, "canary context hostname mismatch");
  assert(canary.repository === repository, "canary context repository mismatch");
  assert(canary.workflowPath === TRUSTED_CANARY_WORKFLOW_PATH, "canary workflow path mismatch");
  assert(canary.workflowHeadSha === identity.releaseSha, "canary workflow head SHA mismatch");
  assert(canary.headBranch === defaultBranch, "canary workflow branch mismatch");
  assert(canary.event === "workflow_dispatch", "canary workflow event mismatch");
  string(canary.actor, "canary actor");
  string(canary.triggeringActor, "canary triggering actor");
  integer(canary.runId, "canary runId");
  integer(canary.artifactId, "canary artifactId");
  assert(canary.artifactName === canaryArtifactName(identity.releaseSha), "canary artifact name mismatch");
  normalizedApiDigest(canary.artifactApiDigest, "canary artifactApiDigest");
  const startedAtMs = timestamp(canary.startedAt, "canary startedAt");
  const verifiedAtMs = timestamp(canary.verifiedAt, "canary verifiedAt");
  assert(verifiedAtMs >= startedAtMs, "canary timestamps are reversed");
  return { ...canary, startedAtMs, verifiedAtMs };
}

function selectCandidate(left, right, currentRunId) {
  const leftDispatch = left.run.event === "workflow_dispatch" ? 0 : 1;
  const rightDispatch = right.run.event === "workflow_dispatch" ? 0 : 1;
  if (leftDispatch !== rightDispatch) return leftDispatch - rightDispatch;
  const leftCurrent = left.run.id === currentRunId ? 0 : 1;
  const rightCurrent = right.run.id === currentRunId ? 0 : 1;
  if (leftCurrent !== rightCurrent) return leftCurrent - rightCurrent;
  const observed = left.sample.observedAt.localeCompare(right.sample.observedAt);
  if (observed !== 0) return observed;
  return compareRunIds(left.run.id, right.run.id);
}

export function buildMonitorAggregate({
  identity: identityInput,
  canonicalManifest,
  canary: canaryInput,
  repository,
  defaultBranch = "main",
  dispatchActor,
  currentRunId,
  runs,
  artifacts,
  sampleRecords,
  now = new Date().toISOString(),
} = {}) {
  assert(defaultBranch === "main", "the trusted default branch must be main");
  const identity = expectedIdentity(identityInput);
  const manifest = validateReleaseManifest(canonicalManifest, identity);
  const manifestIdentity = releaseManifestIdentity(manifest, identity.manifestSha256);
  const canary = validateCanaryContext(canaryInput, identity, repository, defaultBranch);
  const nowMs = timestamp(now, "aggregate generatedAt");
  assert(nowMs >= canary.startedAtMs, "aggregate time predates the canary");
  assert(Array.isArray(runs) && runs.length > 0, "workflow runs are required");
  assert(Array.isArray(artifacts) && artifacts.length > 0, "artifact metadata is required");
  assert(Array.isArray(sampleRecords) && sampleRecords.length > 0, "sample records are required");

  const normalizedRuns = runs.map((run) => validateWorkflowRun(run, {
    identity,
    repository,
    defaultBranch,
    dispatchActor,
    currentRunId,
  }));
  const runMap = new Map();
  for (const run of normalizedRuns) {
    assert(!runMap.has(run.id), `duplicate workflow run ${run.id}`);
    assert(run.createdAtMs >= canary.startedAtMs - CADENCE_MS,
      `workflow run ${run.id} predates the evidence boundary`);
    assert(run.createdAtMs <= nowMs, `workflow run ${run.id} is from the future`);
    runMap.set(run.id, run);
  }
  assert(runMap.has(runId(currentRunId, "currentRunId")), "current aggregate run is missing");

  const artifactByRun = new Map();
  const artifactById = new Map();
  for (const rawArtifact of artifacts) {
    const rawRunId = runId(rawArtifact.workflow_run?.id, "artifact workflow run id");
    const run = runMap.get(rawRunId);
    assert(run, `artifact ${rawArtifact.id} belongs to an untrusted workflow run`);
    const artifact = validateArtifactMetadata(rawArtifact, run);
    assert(!artifactByRun.has(run.id), `workflow run ${run.id} has duplicate exact-name artifacts`);
    assert(!artifactById.has(artifact.id), `duplicate artifact ${artifact.id}`);
    artifactByRun.set(run.id, artifact);
    artifactById.set(artifact.id, artifact);
  }
  for (const run of normalizedRuns) {
    assert(artifactByRun.has(run.id), `trusted workflow run ${run.id} has no exact-name sample artifact`);
  }

  const recordByRun = new Map();
  const normalizedRecords = [];
  for (const record of sampleRecords) {
    object(record, "sample record");
    const id = runId(record.runId, "sample record.runId");
    const run = runMap.get(id);
    assert(run, `sample record belongs to untrusted workflow run ${id}`);
    assert(!recordByRun.has(id), `workflow run ${id} has duplicate sample payloads`);
    const artifact = artifactByRun.get(id);
    assert(integer(record.artifactId, `sample record ${id}.artifactId`) === artifact.id,
      `sample record ${id} artifact ID mismatch`);
    assert(record.artifactApiDigest === artifact.digest, `sample record ${id} artifact API digest mismatch`);
    const sample = validateMonitorSample(record.sample, {
      expectedIdentity: identity,
      manifest,
      notBefore: canary.startedAt,
      notAfter: now,
    });
    const observedAtMs = timestamp(sample.observedAt, `sample record ${id}.observedAt`);
    assert(observedAtMs >= run.createdAtMs, `sample record ${id} predates its workflow run`);
    assert(observedAtMs <= run.updatedAtMs + 5_000, `sample record ${id} is outside its workflow run boundary`);
    assert(sample.bucket === artifact.evidenceBucket,
      `sample record ${id} is not in its artifact observation bucket`);
    assert(observedAtMs <= artifact.createdAtMs + 5_000,
      `sample record ${id} postdates its evidence artifact`);
    assert(sample.identity.workflowHeadSha === run.workflowHeadSha,
      `sample record ${id} workflow SHA mismatch`);
    if (!run.isCurrent) {
      if (run.conclusion === "success") {
        assert(sample.status === "passed", `successful workflow run ${id} has a failed sample`);
      } else {
        assert(sample.status === "failed", `failed workflow run ${id} does not expose a failed sample`);
      }
    }
    const normalized = { run, artifact, sample, observedAtMs };
    recordByRun.set(id, normalized);
    normalizedRecords.push(normalized);
  }

  for (const run of normalizedRuns) {
    if (run.event === "workflow_dispatch" || run.conclusion !== "success") {
      assert(recordByRun.has(run.id), `trusted workflow run ${run.id} sample payload was not inspected`);
    }
    if (!run.isCurrent) {
      assert(run.conclusion === "success", `trusted workflow run ${run.id} concluded ${run.conclusion}`);
    }
  }

  const current = recordByRun.get(runId(currentRunId, "currentRunId"));
  assert(current, "current aggregate run sample payload is missing");
  assert(current.sample.status === "passed", "current aggregate sample is not healthy");
  for (const record of normalizedRecords) {
    assert(record.sample.status === "passed", `trusted sample from run ${record.run.id} is not healthy`);
  }

  const startCandidates = normalizedRecords
    .filter((record) => record.observedAtMs >= canary.startedAtMs && record.observedAtMs <= canary.startedAtMs + CADENCE_MS)
    .sort((left, right) => left.observedAtMs - right.observedAtMs || selectCandidate(left, right, current.run.id));
  assert(startCandidates.length > 0, "no trusted sample was recorded in the first five-minute bucket");
  const startBucket = startCandidates[0].sample.bucket;
  const endBucket = current.sample.bucket;
  assert(endBucket >= startBucket, "current sample bucket predates the first sample bucket");
  const bucketCount = endBucket - startBucket + 1;
  assert(bucketCount >= MIN_SAMPLES, `at least ${MIN_SAMPLES} UTC five-minute buckets are required`);
  assert(bucketCount <= MAX_EVIDENCE_BUCKETS, "evidence window exceeds the bounded bucket count");

  const candidatesByBucket = new Map();
  for (const record of normalizedRecords) {
    if (record.sample.bucket < startBucket || record.sample.bucket > endBucket) continue;
    const candidates = candidatesByBucket.get(record.sample.bucket) ?? [];
    candidates.push(record);
    candidatesByBucket.set(record.sample.bucket, candidates);
  }

  const selected = [];
  for (let bucket = startBucket; bucket <= endBucket; bucket += 1) {
    const candidates = candidatesByBucket.get(bucket) ?? [];
    assert(candidates.length > 0, `missing trusted sample for UTC five-minute bucket ${bucket}`);
    candidates.sort((left, right) => selectCandidate(left, right, current.run.id));
    selected.push(candidates[0]);
  }
  assert(selected.at(-1).run.id === current.run.id,
    "the current aggregate dispatch must provide the final selected sample");

  const selectedRunIds = new Set(selected.map((record) => record.run.id));
  const timestamps = selected.map((record) => record.sample.observedAt);
  assert(new Set(timestamps).size === timestamps.length, "selected sample timestamps must be unique");
  for (let index = 1; index < selected.length; index += 1) {
    const gap = selected[index].observedAtMs - selected[index - 1].observedAtMs;
    assert(gap >= MIN_GAP_MS, `sample gap ${index} is below the rate bound`);
    assert(gap <= MAX_GAP_MS, `sample gap ${index} exceeds ${MAX_GAP_MS / 1000} seconds`);
    assert(selected[index].sample.bucket === selected[index - 1].sample.bucket + 1,
      "selected UTC buckets are not consecutive");
  }
  assert(selected[0].observedAtMs >= canary.startedAtMs, "first selected sample predates the canary");
  assert(selected[0].observedAtMs - canary.startedAtMs <= CADENCE_MS,
    "first selected sample is more than five minutes after the canary");
  assert(selected.at(-1).observedAtMs - canary.startedAtMs >= MIN_WINDOW_MS,
    "monitor evidence does not span 48 hours from the canary");
  const finalAge = nowMs - selected.at(-1).observedAtMs;
  assert(finalAge >= 0 && finalAge <= MAX_FINAL_AGE_MS, "final sample is stale or from the future");

  const dispatchCount = selected.filter((record) => record.run.event === "workflow_dispatch").length;
  assert(dispatchCount * 100 >= selected.length * MIN_DISPATCH_PERCENT,
    `trusted Senko dispatches must provide at least ${MIN_DISPATCH_PERCENT}% of selected buckets`);

  const covered = new Map();
  for (const record of selected) {
    for (const checked of record.sample.checkedFiles) {
      assert(checked.status === "passed", `selected run ${record.run.id} has a failed file check`);
      const previous = covered.get(checked.path);
      if (previous) {
        assert(previous.url === checked.url && previous.sha256 === checked.sha256 && previous.bytes === checked.bytes,
          `conflicting coverage evidence for ${checked.path}`);
      } else {
        covered.set(checked.path, {
          path: checked.path,
          url: checked.url,
          sha256: checked.sha256,
          bytes: checked.bytes,
        });
      }
    }
  }
  for (const file of manifest.files) {
    const checked = covered.get(file.path);
    assert(checked, `manifest file ${file.path} has no selected sample coverage`);
    assert(checked.url === file.url && checked.sha256 === file.sha256 && checked.bytes === file.bytes,
      `manifest file ${file.path} coverage does not match the canonical manifest`);
  }
  assert(covered.size === manifest.files.length, "coverage includes files outside the canonical manifest");

  const producerRuns = normalizedRuns
    .slice()
    .sort((left, right) => left.createdAtMs - right.createdAtMs || left.id - right.id)
    .map((run) => {
      const artifact = artifactByRun.get(run.id);
      const record = recordByRun.get(run.id);
      return {
        runId: run.id,
        event: run.event,
        workflowPath: run.workflowPath,
        workflowHeadSha: run.workflowHeadSha,
        headBranch: run.headBranch,
        repository: run.repository,
        actor: run.actor,
        triggeringActor: run.triggeringActor,
        conclusion: run.conclusion,
        runCreatedAt: run.createdAt,
        runUpdatedAt: run.updatedAt,
        artifactId: artifact.id,
        artifactName: artifact.name,
        artifactApiDigest: artifact.digest,
        sampleInspected: Boolean(record),
        sampleObservedAt: record?.sample.observedAt ?? null,
        sampleStatus: record?.sample.status ?? null,
        selected: selectedRunIds.has(run.id),
      };
    });

  return {
    schemaVersion: 1,
    kind: "ariada-wiki-monitor-evidence",
    artifactName: monitorEvidenceArtifactName(identity.releaseSha),
    releaseSha: identity.releaseSha,
    finalTarSha256: identity.artifactDigest,
    deploymentId: identity.deploymentId,
    hostname: identity.hostname,
    canary: {
      runId: canary.runId,
      artifactId: canary.artifactId,
      artifactName: canary.artifactName,
      artifactApiDigest: canary.artifactApiDigest,
      workflowPath: canary.workflowPath,
      workflowHeadSha: canary.workflowHeadSha,
      actor: canary.actor,
      triggeringActor: canary.triggeringActor,
      startedAt: canary.startedAt,
      verifiedAt: canary.verifiedAt,
    },
    manifest: manifestIdentity,
    cadenceSeconds: CADENCE_MS / 1000,
    window: {
      startedAt: selected[0].sample.observedAt,
      endedAt: selected.at(-1).sample.observedAt,
      bucketCount: selected.length,
      dispatchBucketCount: dispatchCount,
      dispatchCoverageBasisPoints: Math.floor((dispatchCount * 10_000) / selected.length),
    },
    producerRuns,
    samples: selected.map((record) => ({
      runId: record.run.id,
      artifactId: record.artifact.id,
      artifactName: record.artifact.name,
      artifactApiDigest: record.artifact.digest,
      event: record.run.event,
      observedAt: record.sample.observedAt,
      bucket: record.sample.bucket,
      status: record.sample.status,
      releaseSha: record.sample.identity.releaseSha,
      workflowHeadSha: record.sample.identity.workflowHeadSha,
      finalTarSha256: record.sample.identity.artifactDigest,
      deploymentId: record.sample.identity.deploymentId,
      manifestSha256: record.sample.manifest.manifestSha256,
      contentSetSha256: record.sample.manifest.contentSetSha256,
      checkedFiles: record.sample.checkedFiles.map(({ path, url, sha256: digest, bytes }) => ({
        path,
        url,
        sha256: digest,
        bytes,
      })),
    })),
    coverage: {
      requiredFileCount: manifest.files.length,
      coveredFileCount: covered.size,
      files: manifest.files.map(({ path, url, sha256: digest, bytes }) => ({
        path,
        url,
        sha256: digest,
        bytes,
      })),
    },
    generatedAt: now,
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) fail(`GitHub API ${response.status} for ${new URL(url).pathname}`);
  try {
    return await response.json();
  } catch {
    fail(`GitHub API returned invalid JSON for ${new URL(url).pathname}`);
  }
}

const ARTIFACT_REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function artifactContentLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  assert(/^(?:0|[1-9][0-9]*)$/.test(value), "GitHub artifact Content-Length is invalid");
  const length = Number(value);
  assert(Number.isSafeInteger(length), "GitHub artifact Content-Length is outside the safe integer range");
  return length;
}

async function readBoundedArtifactBody(response, maxBytes) {
  assert(!response.headers.has("content-range"), "GitHub artifact response must not include Content-Range");
  const declaredLength = artifactContentLength(response);
  if (declaredLength !== null) {
    assert(declaredLength > 0, "GitHub artifact archive must not be empty");
    assert(declaredLength <= maxBytes, "GitHub artifact archive exceeds the size bound");
  }
  assert(response.body !== null, "GitHub artifact response body is missing");

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = Buffer.from(result.value);
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes || (declaredLength !== null && receivedBytes > declaredLength)) {
        await reader.cancel("GitHub artifact archive exceeded its declared bound");
        fail("GitHub artifact archive exceeds its declared or configured size bound");
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof AggregateError) throw error;
    try {
      await reader.cancel("GitHub artifact stream failed");
    } catch {
      // The stream may already be errored or closed; no partial bytes are trusted.
    }
    fail("GitHub artifact archive stream failed before completion");
  }

  assert(receivedBytes > 0, "GitHub artifact archive must not be empty");
  assert(receivedBytes <= maxBytes, "GitHub artifact archive exceeds the size bound");
  if (declaredLength !== null) {
    assert(receivedBytes === declaredLength, "GitHub artifact Content-Length does not match received bytes");
  }
  return Buffer.concat(chunks, receivedBytes);
}

export async function githubArtifactArchive({
  apiBase = "https://api.github.com",
  repository,
  artifactId,
  token,
  maxBytes,
  fetchImpl = fetch,
} = {}) {
  string(repository, "repository");
  const repositoryParts = repository.split("/");
  assert(repositoryParts.length === 2 && repositoryParts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part)),
    "repository must be an owner/name pair");
  const numericArtifactId = runId(artifactId, "artifactId");
  string(token, "GitHub token");
  assert(Number.isSafeInteger(maxBytes) && maxBytes > 0, "artifact download byte bound is invalid");
  assert(typeof fetchImpl === "function", "artifact fetch implementation is unavailable");

  const artifactUrl = apiUrl(
    apiBase,
    `/repos/${encodeURIComponent(repositoryParts[0])}/${encodeURIComponent(repositoryParts[1])}` +
      `/actions/artifacts/${numericArtifactId}/zip`,
  );
  const parsedArtifactUrl = new URL(artifactUrl);
  assert(parsedArtifactUrl.protocol === "https:" && parsedArtifactUrl.username === "" && parsedArtifactUrl.password === "",
    "GitHub artifact API URL must be credential-free HTTPS");
  const firstResponse = await fetchImpl(artifactUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  assert(!firstResponse.headers.has("content-range"),
    "GitHub artifact response must not include Content-Range");

  let finalResponse = firstResponse;
  if (ARTIFACT_REDIRECT_STATUSES.has(firstResponse.status)) {
    const location = firstResponse.headers.get("location");
    assert(location !== null, "GitHub artifact redirect is missing Location");
    let redirectUrl;
    try {
      redirectUrl = new URL(location, artifactUrl);
    } catch {
      fail("GitHub artifact redirect Location is invalid");
    }
    assert(redirectUrl.protocol === "https:" && redirectUrl.username === "" && redirectUrl.password === "",
      "GitHub artifact redirect must be credential-free HTTPS");
    if (firstResponse.body !== null) await firstResponse.body.cancel();
    finalResponse = await fetchImpl(redirectUrl.href, {
      headers: {
        Accept: "application/octet-stream",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
  }

  assert(finalResponse.status === 200,
    `GitHub artifact download must end with HTTP 200, received ${finalResponse.status}`);
  return readBoundedArtifactBody(finalResponse, maxBytes);
}

function apiUrl(apiBase, pathname, parameters = {}) {
  const url = new URL(pathname, apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.href;
}

export async function paginateGithub({
  requestJson,
  apiBase = "https://api.github.com",
  pathname,
  parameters = {},
  arrayField,
  maxPages,
  stopAfterPage,
}) {
  const collected = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await requestJson(apiUrl(apiBase, pathname, { ...parameters, per_page: 100, page }));
    object(payload, "GitHub paginated response");
    const values = payload[arrayField];
    assert(Array.isArray(values) && values.length <= 100, `GitHub response ${arrayField} is invalid`);
    collected.push(...values);
    if (values.length < 100 || stopAfterPage?.(values, collected)) return collected;
  }
  fail(`GitHub ${arrayField} pagination exceeded the ${maxPages}-page bound`);
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function likelySameIdentityRun(run, identity, repository, defaultBranch) {
  return run?.head_sha === identity.releaseSha &&
    run?.head_branch === defaultBranch &&
    run?.repository?.full_name === repository &&
    run?.head_repository?.full_name === repository;
}

function rawActor(run, field) {
  return run?.[field]?.login;
}

export async function collectMonitorAggregate({
  token,
  repository,
  identity: identityInput,
  currentRunId,
  dispatchActor,
  canaryArtifactId,
  defaultBranch = "main",
  now = new Date().toISOString(),
  apiBase = "https://api.github.com",
  requestJson: requestJsonInput,
  downloadArchive: downloadArchiveInput,
} = {}) {
  string(token, "GitHub token");
  string(repository, "repository");
  assert(defaultBranch === "main", "the trusted default branch must be main");
  const identity = expectedIdentity(identityInput);
  const currentId = runId(currentRunId, "currentRunId");
  const canaryArtifactNumericId = runId(canaryArtifactId, "canaryArtifactId");
  const generatedAtMs = timestamp(now, "aggregate generatedAt");
  const requestJson = requestJsonInput ?? ((url) => githubJson(url, token));
  const downloadArchive = downloadArchiveInput ?? ((artifactId, maxBytes) =>
    githubArtifactArchive({ apiBase, repository, artifactId, token, maxBytes }));

  const canaryArtifactRaw = await requestJson(apiUrl(
    apiBase,
    `/repos/${repository}/actions/artifacts/${canaryArtifactNumericId}`,
  ));
  const expectedCanaryArtifactName = canaryArtifactName(identity.releaseSha);
  assert(canaryArtifactRaw.name === expectedCanaryArtifactName, "canary artifact name mismatch");
  assert(canaryArtifactRaw.expired === false, "canary artifact is expired");
  assert(canaryArtifactRaw.id === canaryArtifactNumericId, "canary artifact ID mismatch");
  assert(Number.isSafeInteger(canaryArtifactRaw.size_in_bytes) && canaryArtifactRaw.size_in_bytes > 0 &&
    canaryArtifactRaw.size_in_bytes <= MAX_CANARY_ARCHIVE_BYTES, "canary artifact size is invalid");
  const canaryApiDigest = normalizedApiDigest(canaryArtifactRaw.digest, "canary artifact digest");
  const canaryRunId = runId(canaryArtifactRaw.workflow_run?.id, "canary artifact workflow run id");
  const canaryRunRaw = await requestJson(apiUrl(apiBase, `/repos/${repository}/actions/runs/${canaryRunId}`));
  const canaryRun = validateWorkflowRun(canaryRunRaw, {
    identity,
    repository,
    defaultBranch,
    dispatchActor: rawActor(canaryRunRaw, "actor"),
    currentRunId: null,
    workflowPath: TRUSTED_CANARY_WORKFLOW_PATH,
    allowedEvents: ["workflow_dispatch"],
  });
  assert(canaryRun.conclusion === "success", "canary workflow run was not successful");
  const canaryArtifact = validateArtifactMetadata(canaryArtifactRaw, canaryRun, {
    expectedName: expectedCanaryArtifactName,
    maxBytes: MAX_CANARY_ARCHIVE_BYTES,
  });
  assert(canaryArtifact.digest === canaryApiDigest, "canary artifact API digest changed during validation");
  assert(canaryArtifactRaw.workflow_run.head_branch === defaultBranch, "canary artifact branch mismatch");
  assert(canaryArtifactRaw.workflow_run.head_sha === identity.releaseSha, "canary artifact head SHA mismatch");
  const canaryArchive = await downloadArchive(canaryArtifactNumericId, MAX_CANARY_ARCHIVE_BYTES);
  const decodedCanary = decodeCanaryArchive(canaryArchive, canaryApiDigest, identity);
  assert(decodedCanary.startedAtMs >= canaryRun.createdAtMs, "canary start predates its workflow run");
  assert(decodedCanary.verifiedAtMs <= canaryArtifact.createdAtMs + 5_000,
    "canary evidence postdates its artifact");
  assert(decodedCanary.verifiedAtMs <= canaryRun.updatedAtMs + CADENCE_MS, "canary verification is outside its workflow run");

  const canary = {
    releaseSha: identity.releaseSha,
    finalTarSha256: identity.artifactDigest,
    manifestSha256: identity.manifestSha256,
    contentSetSha256: identity.contentSetSha256,
    deploymentId: identity.deploymentId,
    hostname: identity.hostname,
    repository,
    workflowPath: canaryRun.workflowPath,
    workflowHeadSha: canaryRun.workflowHeadSha,
    headBranch: canaryRun.headBranch,
    event: canaryRun.event,
    actor: canaryRun.actor,
    triggeringActor: canaryRun.triggeringActor,
    runId: canaryRun.id,
    artifactId: canaryArtifactNumericId,
    artifactName: expectedCanaryArtifactName,
    artifactApiDigest: canaryApiDigest,
    startedAt: decodedCanary.evidence.startedAt,
    verifiedAt: decodedCanary.evidence.verifiedAt,
  };

  const createdBoundary = new Date(decodedCanary.startedAtMs - CADENCE_MS).toISOString();
  const workflowEndpoint = `/repos/${repository}/actions/workflows/${encodeURIComponent(TRUSTED_MONITOR_WORKFLOW_PATH)}/runs`;
  const eventRuns = await Promise.all(["workflow_dispatch", "schedule"].map((event) =>
    paginateGithub({
      requestJson,
      apiBase,
      pathname: workflowEndpoint,
      parameters: { event, created: `>=${createdBoundary}` },
      arrayField: "workflow_runs",
      maxPages: MAX_RUN_PAGES_PER_EVENT,
    })));
  const currentRunRaw = await requestJson(apiUrl(apiBase, `/repos/${repository}/actions/runs/${currentId}`));
  const rawRunsById = new Map();
  for (const raw of [...eventRuns.flat(), currentRunRaw]) {
    const id = runId(raw.id, "workflow run.id");
    if (rawRunsById.has(id)) continue;
    rawRunsById.set(id, raw);
  }

  const trustedRunRaws = [];
  for (const raw of rawRunsById.values()) {
    const id = runId(raw.id, "workflow run.id");
    if (id !== currentId && !likelySameIdentityRun(raw, identity, repository, defaultBranch)) continue;
    if (id !== currentId && raw.event === "workflow_dispatch" &&
      (rawActor(raw, "actor") !== dispatchActor || rawActor(raw, "triggering_actor") !== dispatchActor)) continue;
    const normalized = validateWorkflowRun(raw, {
      identity,
      repository,
      defaultBranch,
      dispatchActor,
      currentRunId: currentId,
    });
    if (normalized.createdAtMs < decodedCanary.startedAtMs - CADENCE_MS || normalized.createdAtMs > generatedAtMs) continue;
    trustedRunRaws.push(raw);
  }
  assert(trustedRunRaws.some((run) => runId(run.id) === currentId), "current trusted aggregate run is unavailable");

  const cutoff = decodedCanary.startedAtMs - CADENCE_MS;
  const expectedSampleArtifactName = monitorSampleArtifactName(identity.releaseSha);
  let previousArtifactCreatedAt = Number.POSITIVE_INFINITY;
  const exactNameArtifacts = await paginateGithub({
    requestJson,
    apiBase,
    pathname: `/repos/${repository}/actions/artifacts`,
    parameters: { name: expectedSampleArtifactName },
    arrayField: "artifacts",
    maxPages: MAX_ARTIFACT_PAGES,
    stopAfterPage(values) {
      for (const artifact of values) {
        const created = apiTimestamp(artifact.created_at, `artifact ${artifact.id}.created_at`);
        assert(created <= previousArtifactCreatedAt, "GitHub artifact pagination is not newest-first");
        previousArtifactCreatedAt = created;
      }
      return values.length > 0 && values.every((artifact) => Date.parse(artifact.created_at) < cutoff);
    },
  });

  const trustedIds = new Set(trustedRunRaws.map((run) => runId(run.id)));
  const artifacts = exactNameArtifacts.filter((artifact) =>
    artifact.name === expectedSampleArtifactName && trustedIds.has(runId(artifact.workflow_run?.id)));
  const artifactsByRun = new Map();
  for (const artifact of artifacts) {
    const id = runId(artifact.workflow_run.id);
    const values = artifactsByRun.get(id) ?? [];
    values.push(artifact);
    artifactsByRun.set(id, values);
  }
  for (const raw of trustedRunRaws) {
    const id = runId(raw.id);
    assert((artifactsByRun.get(id) ?? []).length === 1,
      `trusted workflow run ${id} must have one exact-name artifact`);
  }

  const normalizedForSelection = trustedRunRaws.map((raw) => validateWorkflowRun(raw, {
    identity,
    repository,
    defaultBranch,
    dispatchActor,
    currentRunId: currentId,
  }));
  const normalizedArtifactsByRun = new Map();
  for (const run of normalizedForSelection) {
    normalizedArtifactsByRun.set(run.id, validateArtifactMetadata(artifactsByRun.get(run.id)[0], run, {
      expectedName: expectedSampleArtifactName,
    }));
  }
  for (const run of normalizedForSelection) {
    if (!run.isCurrent && run.conclusion !== "success") {
      fail(`trusted workflow run ${run.id} concluded ${run.conclusion}`);
    }
  }

  const dispatchRunIds = normalizedForSelection
    .filter((run) => run.event === "workflow_dispatch")
    .map((run) => run.id);
  assert(dispatchRunIds.length <= MAX_ARCHIVE_DOWNLOADS, "trusted dispatch artifact downloads exceed the bound");

  const dispatchBuckets = new Set(dispatchRunIds.map((id) =>
    artifactObservationBucket(normalizedArtifactsByRun.get(id))));
  const currentBucket = artifactObservationBucket(normalizedArtifactsByRun.get(currentId));
  const earliestPossibleBucket = fiveMinuteBucket(decodedCanary.evidence.startedAt);
  const provisionalBucketCount = currentBucket - earliestPossibleBucket + 1;
  assert(provisionalBucketCount > 0 && provisionalBucketCount <= MAX_EVIDENCE_BUCKETS,
    "provisional evidence bucket range is invalid");
  let provisionalDispatchBuckets = 0;
  for (let bucket = earliestPossibleBucket; bucket <= currentBucket; bucket += 1) {
    if (dispatchBuckets.has(bucket)) provisionalDispatchBuckets += 1;
  }
  assert(provisionalDispatchBuckets * 100 >= provisionalBucketCount * MIN_DISPATCH_PERCENT,
    `trusted Senko dispatches cannot provide ${MIN_DISPATCH_PERCENT}% of the evidence window`);

  const missingDispatchBuckets = new Set();
  for (let bucket = earliestPossibleBucket; bucket <= currentBucket; bucket += 1) {
    if (!dispatchBuckets.has(bucket)) missingDispatchBuckets.add(bucket);
  }
  const scheduleFallbackIds = selectScheduleFallbackRunIds({
    runs: normalizedForSelection,
    artifactsByRun: normalizedArtifactsByRun,
    missingDispatchBuckets,
  });
  const downloadIds = [...new Set([...dispatchRunIds, ...scheduleFallbackIds])];
  assert(downloadIds.length <= MAX_ARCHIVE_DOWNLOADS,
    "sample artifact downloads exceed the bounded GitHub API budget");

  async function downloadRecord(id) {
    const artifact = artifactsByRun.get(id)[0];
    const normalizedArtifact = normalizedArtifactsByRun.get(id);
    const apiDigest = normalizedApiDigest(artifact.digest, `artifact ${artifact.id}.digest`);
    const archive = await downloadArchive(artifact.id, MAX_SAMPLE_ARCHIVE_BYTES);
    const sample = validateMonitorSample(decodeSampleArchive(archive, apiDigest), {
      expectedIdentity: identity,
      manifest: decodedCanary.manifest,
      notBefore: decodedCanary.evidence.startedAt,
      notAfter: now,
    });
    assert(sample.bucket === artifactObservationBucket(normalizedArtifact),
      `sample from run ${id} is not in its artifact observation bucket`);
    return {
      runId: id,
      artifactId: artifact.id,
      artifactApiDigest: apiDigest,
      sample,
    };
  }

  const downloadedRecords = await mapConcurrent(downloadIds, DOWNLOAD_CONCURRENCY, downloadRecord);
  const recordByRun = new Map(downloadedRecords.map((record) => [record.runId, record]));
  const dispatchRecords = dispatchRunIds.map((id) => recordByRun.get(id));
  for (const record of dispatchRecords) {
    assert(record.sample.status === "passed", `trusted dispatch run ${record.runId} sample is not healthy`);
  }
  const currentRecord = recordByRun.get(currentId);
  assert(currentRecord, "current dispatch sample was not downloaded");
  assert(currentRecord.sample.bucket === currentBucket, "current sample and artifact bucket mismatch");
  const scheduleRecords = scheduleFallbackIds.map((id) => recordByRun.get(id));

  return buildMonitorAggregate({
    identity,
    canonicalManifest: decodedCanary.manifest,
    canary,
    repository,
    defaultBranch,
    dispatchActor,
    currentRunId: currentId,
    runs: trustedRunRaws,
    artifacts,
    sampleRecords: [...dispatchRecords, ...scheduleRecords],
    now,
  });
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) fail(`invalid argument near ${key ?? "end"}`);
    assert(!values.has(key), `duplicate argument ${key}`);
    values.set(key, value);
  }
  return values;
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const required = (name) => {
    const value = argumentsMap.get(name);
    if (!value) fail(`missing ${name}`);
    return value;
  };
  const token = process.env.GITHUB_TOKEN;
  if (!token) fail("GITHUB_TOKEN is required");
  const aggregate = await collectMonitorAggregate({
    token,
    repository: required("--repository"),
    identity: {
      releaseSha: required("--release-sha"),
      artifactDigest: required("--artifact-digest"),
      manifestSha256: required("--manifest-sha256"),
      contentSetSha256: required("--content-set-sha256"),
      url: required("--url"),
      deploymentId: required("--deployment-id"),
    },
    currentRunId: required("--current-run-id"),
    dispatchActor: required("--dispatch-actor"),
    canaryArtifactId: required("--canary-artifact-id"),
    now: process.env.ARIADA_WIKI_AGGREGATE_NOW || new Date().toISOString(),
  });
  await writeFile(required("--output"), `${JSON.stringify(aggregate)}\n`, { flag: "wx", mode: 0o600 });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
