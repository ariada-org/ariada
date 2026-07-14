import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CANARY_ENVIRONMENT,
  MAX_CANARY_AGE_SECONDS,
  MIN_CANARY_AGE_SECONDS,
  MONITOR_CADENCE_SECONDS,
  MONITOR_MIN_SAMPLES,
  PROMOTION_APPROVAL_ENVIRONMENT,
  PRODUCTION_WAIT_TIMER_MINUTES,
  TRUSTED_GATE_WORKFLOW_PATH,
  TRUSTED_MONITOR_WORKFLOW_PATH,
  buildArtifactName,
  canaryArtifactName,
  decodePromotionEvidenceArchives,
  downloadArtifactArchive,
  evaluatePromotionGate,
  monitorArtifactName,
  normalizeProductionApprovals,
  requireUniqueCandidate,
  validateArtifactMetadata,
  validateCanaryAge,
  validateCloudflareCanaryUrl,
  validateFinalHeadApproval,
  validateMergedPullRequest,
  validateReleaseManifest,
  validateReleaseManifestCopies,
  validateDistinctPromotionArtifactIds,
  resolveTrustedArtifactById,
  validateSampleProducerEvidence,
  validateWorkflowRun,
} from "./wiki-rc-gate.mjs";
import {
  calculateContentSetSha256,
  serializeContentReleaseManifest,
  sha256Hex,
} from "./wiki-rc-content-manifest.mjs";
import {
  PROBE_PATHS,
  runMonitor,
  validateRcIdentity,
} from "./wiki-rc-monitor.mjs";
import {
  buildMonitorAggregate,
  decodeCanaryArchive,
} from "./wiki-rc-monitor-aggregate.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HEAD_SHA = "1".repeat(40);
const RELEASE_SHA = "2".repeat(40);
const BASE_SHA = "3".repeat(40);
const OLD_RELEASE_SHA = "4".repeat(40);
const TAR_SHA = "a".repeat(64);
const BUILD_API_DIGEST = `sha256:${"b".repeat(64)}`;
const CANARY_API_DIGEST = `sha256:${"c".repeat(64)}`;
const MONITOR_API_DIGEST = `sha256:${"d".repeat(64)}`;
const DEPLOYMENT_ID = "a1b2c3d4";
const CANARY_URL = `https://${DEPLOYMENT_ID}.ariada-wiki.pages.dev`;
const REPOSITORY = "predopta/adopta";
const START_MS = Date.parse("2026-07-01T00:00:00.000Z");
const MERGED_AT = "2026-06-30T20:00:00.000Z";
const RELEASE_BODIES = new Map([
  ["assets/app.js", Buffer.from("console.log('wiki');\n")],
  ["index.html", Buffer.from("<!doctype html><title>Wiki</title>\n")],
]);
const RELEASE_FILES = [
  { path: "assets/app.js", url: "/assets/app.js", sha256: sha256Hex(RELEASE_BODIES.get("assets/app.js")), bytes: RELEASE_BODIES.get("assets/app.js").length },
  { path: "index.html", url: "/", sha256: sha256Hex(RELEASE_BODIES.get("index.html")), bytes: RELEASE_BODIES.get("index.html").length },
];
const CONTENT_SET_SHA = calculateContentSetSha256(RELEASE_FILES);
const RELEASE_MANIFEST = {
  schemaVersion: 1,
  kind: "ariada-wiki-release",
  releaseSha: RELEASE_SHA,
  generatedAt: "2026-06-30T20:00:00.000Z",
  contentSetSha256: CONTENT_SET_SHA,
  files: RELEASE_FILES,
};
const RELEASE_MANIFEST_BYTES = serializeContentReleaseManifest(RELEASE_MANIFEST);
const RELEASE_MANIFEST_SHA = sha256Hex(RELEASE_MANIFEST_BYTES);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.contents, "utf8");
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const localEntry = Buffer.concat([local, name, data]);
    locals.push(localEntry);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(Buffer.concat([central, name]));
    localOffset += localEntry.length;
  }
  const centralDirectory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...locals, centralDirectory, end]);
}

function zipRootEntries(archive) {
  const endOffset = archive.length - 22;
  assert.equal(archive.readUInt32LE(endOffset), 0x06054b50);
  const count = archive.readUInt16LE(endOffset + 10);
  let cursor = archive.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    entries.push(archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function runFixture({
  id,
  path,
  event,
  status = "completed",
  conclusion = "success",
  actor = "workflow-actor",
  triggeringActor = "workflow-trigger",
  createdAt = "2026-06-30T20:01:00.000Z",
  updatedAt = "2026-06-30T20:02:00.000Z",
} = {}) {
  return {
    id: String(id),
    workflowId: path === TRUSTED_MONITOR_WORKFLOW_PATH ? "22" : "11",
    path,
    event,
    status,
    conclusion,
    headSha: RELEASE_SHA,
    headBranch: "main",
    repository: REPOSITORY,
    headRepository: REPOSITORY,
    actor,
    triggeringActor,
    createdAt,
    updatedAt,
  };
}

function artifactFixture({ id, name, run, apiDigestValue, createdAt }) {
  return {
    id: String(id),
    name,
    apiDigest: apiDigestValue,
    runId: run.id,
    headSha: RELEASE_SHA,
    createdAt,
    expiresAt: "2026-07-14T00:00:00.000Z",
    sizeInBytes: 2048,
  };
}

function samplesFixture(monitorWorkflow, count = MONITOR_MIN_SAMPLES + 1) {
  return Array.from({ length: count }, (_, index) => {
    const observedAt = START_MS + index * MONITOR_CADENCE_SECONDS * 1000;
    const source = index === count - 1;
    const bucket = Math.floor(observedAt / (MONITOR_CADENCE_SECONDS * 1000));
    return {
      runId: source ? monitorWorkflow.id : String(10_000 + index),
      artifactId: String(20_000 + index),
      artifactName: `ariada-wiki-monitor-sample-${RELEASE_SHA}`,
      artifactApiDigest: `sha256:${(BigInt(index) + 1n).toString(16).padStart(64, "0")}`,
      event: "workflow_dispatch",
      observedAt: new Date(observedAt).toISOString(),
      bucket,
      status: "passed",
      releaseSha: RELEASE_SHA,
      workflowHeadSha: RELEASE_SHA,
      finalTarSha256: TAR_SHA,
      deploymentId: DEPLOYMENT_ID,
      manifestSha256: RELEASE_MANIFEST_SHA,
      contentSetSha256: CONTENT_SET_SHA,
      checkedFiles: structuredClone(RELEASE_FILES.filter((unused, fileIndex) => fileIndex % 576 === bucket % 576)),
    };
  });
}

function producerRunsFixture(samples, monitorWorkflow) {
  let digestIndex = 10_000n;
  const artifactDigest = () => `sha256:${(digestIndex++).toString(16).padStart(64, "0")}`;
  const common = ({ runId, event, actor, triggeringActor, conclusion, runCreatedAt, runUpdatedAt, artifactId, artifactApiDigest, sampleInspected, sampleObservedAt, sampleStatus, selected }) => ({
    runId: String(runId),
    event,
    workflowPath: TRUSTED_MONITOR_WORKFLOW_PATH,
    workflowHeadSha: RELEASE_SHA,
    headBranch: "main",
    repository: REPOSITORY,
    actor,
    triggeringActor,
    conclusion,
    runCreatedAt,
    runUpdatedAt,
    artifactId: String(artifactId),
    artifactName: `ariada-wiki-monitor-sample-${RELEASE_SHA}`,
    artifactApiDigest,
    sampleInspected,
    sampleObservedAt,
    sampleStatus,
    selected,
  });
  const producers = samples.map((sample, index) => {
    const source = sample.runId === monitorWorkflow.id;
    const observedAtMs = Date.parse(sample.observedAt);
    return common({
      runId: sample.runId,
      event: sample.event,
      actor: monitorWorkflow.actor,
      triggeringActor: monitorWorkflow.triggeringActor,
      conclusion: source ? null : "success",
      runCreatedAt: source ? monitorWorkflow.createdAt : new Date(Math.max(START_MS, observedAtMs - 1_000)).toISOString(),
      runUpdatedAt: sample.observedAt,
      artifactId: sample.artifactId,
      artifactApiDigest: sample.artifactApiDigest,
      sampleInspected: true,
      sampleObservedAt: sample.observedAt,
      sampleStatus: sample.status,
      selected: true,
    });
  });
  const concurrentObservedAt = new Date(Date.parse(samples[100].observedAt) + 30_000).toISOString();
  producers.push(common({
    runId: 90_000,
    event: "workflow_dispatch",
    actor: monitorWorkflow.actor,
    triggeringActor: monitorWorkflow.triggeringActor,
    conclusion: "success",
    runCreatedAt: new Date(Date.parse(concurrentObservedAt) - 1_000).toISOString(),
    runUpdatedAt: new Date(Date.parse(concurrentObservedAt) + 1_000).toISOString(),
    artifactId: 91_000,
    artifactApiDigest: artifactDigest(),
    sampleInspected: true,
    sampleObservedAt: concurrentObservedAt,
    sampleStatus: "passed",
    selected: false,
  }));
  for (let index = 0; index < 576; index += 1) {
    const createdAtMs = START_MS + index * MONITOR_CADENCE_SECONDS * 1000;
    producers.push(common({
      runId: 30_000 + index,
      event: "schedule",
      actor: index % 2 === 0 ? "scheduled-fallback-a" : "scheduled-fallback-b",
      triggeringActor: index % 2 === 0 ? "scheduled-trigger-a" : "scheduled-trigger-b",
      conclusion: "success",
      runCreatedAt: new Date(createdAtMs).toISOString(),
      runUpdatedAt: new Date(createdAtMs + 1_000).toISOString(),
      artifactId: 40_000 + index,
      artifactApiDigest: artifactDigest(),
      sampleInspected: false,
      sampleObservedAt: null,
      sampleStatus: null,
      selected: false,
    }));
  }
  producers.sort((left, right) => {
    const timestampDelta = Date.parse(left.runCreatedAt) - Date.parse(right.runCreatedAt);
    return timestampDelta || (BigInt(left.runId) < BigInt(right.runId) ? -1 : 1);
  });
  return producers;
}

function validFixture() {
  const buildWorkflow = runFixture({
    id: 101,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    actor: "post-merge-builder",
    triggeringActor: "artifact-producer",
  });
  const canaryWorkflow = runFixture({
    id: 202,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    actor: "canary-verifier",
    triggeringActor: "canary-dispatcher",
    createdAt: new Date(START_MS - 120_000).toISOString(),
    updatedAt: new Date(START_MS + 30_000).toISOString(),
  });
  const monitorWorkflow = runFixture({
    id: 303,
    path: TRUSTED_MONITOR_WORKFLOW_PATH,
    event: "workflow_dispatch",
    actor: "senko-monitor-dispatcher",
    triggeringActor: "senko-monitor-dispatcher",
    createdAt: new Date(START_MS + MIN_CANARY_AGE_SECONDS * 1000).toISOString(),
    updatedAt: new Date(START_MS + MIN_CANARY_AGE_SECONDS * 1000).toISOString(),
  });
  const productionWorkflow = runFixture({
    id: 404,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    status: "in_progress",
    conclusion: null,
    actor: "production-workflow-actor",
    triggeringActor: "production-dispatcher",
    createdAt: new Date(START_MS).toISOString(),
    updatedAt: new Date(START_MS + MIN_CANARY_AGE_SECONDS * 1000).toISOString(),
  });
  const buildArtifact = artifactFixture({
    id: 501,
    name: buildArtifactName(RELEASE_SHA),
    run: buildWorkflow,
    apiDigestValue: BUILD_API_DIGEST,
    createdAt: "2026-06-30T20:03:00.000Z",
  });
  const canaryArtifact = artifactFixture({
    id: 502,
    name: canaryArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
    run: canaryWorkflow,
    apiDigestValue: CANARY_API_DIGEST,
    createdAt: new Date(START_MS + 60_000).toISOString(),
  });
  const monitorArtifact = artifactFixture({
    id: 503,
    name: monitorArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
    run: monitorWorkflow,
    apiDigestValue: MONITOR_API_DIGEST,
    createdAt: new Date(START_MS + MIN_CANARY_AGE_SECONDS * 1000).toISOString(),
  });
  const build = {
    schemaVersion: 2,
    kind: "ariada-wiki-build-resolution",
    repository: REPOSITORY,
    defaultBranch: "main",
    releaseSha: RELEASE_SHA,
    pullRequest: {
      number: 77,
      state: "closed",
      merged: true,
      author: "pr-author",
      headSha: HEAD_SHA,
      headRef: "release/ariada-wiki-rc",
      headRepository: REPOSITORY,
      baseSha: BASE_SHA,
      baseRef: "main",
      baseRepository: REPOSITORY,
      mergeCommitSha: RELEASE_SHA,
      mergedAt: MERGED_AT,
      mergedBy: "pr-merger",
    },
    finalHeadApproval: {
      id: "91",
      actor: "pr-reviewer",
      commitSha: HEAD_SHA,
      submittedAt: "2026-06-30T19:00:00.000Z",
    },
    mergeCommit: {
      sha: RELEASE_SHA,
      parentShas: [BASE_SHA, HEAD_SHA],
      author: "merge-author",
      committer: "final-code-pusher",
    },
    buildWorkflow,
    buildArtifact,
    resolvedAt: "2026-06-30T20:04:00.000Z",
  };
  const nowMs = START_MS + MIN_CANARY_AGE_SECONDS * 1000;
  const resolution = {
    schemaVersion: 2,
    kind: "ariada-wiki-promotion-resolution",
    repository: REPOSITORY,
    defaultBranch: "main",
    releaseSha: RELEASE_SHA,
    canaryUrl: CANARY_URL,
    build,
    canaryWorkflow,
    canaryArtifact,
    monitorWorkflow,
    monitorArtifact,
    githubDeployment: {
      id: "701",
      sha: RELEASE_SHA,
      ref: RELEASE_SHA,
      environment: CANARY_ENVIRONMENT,
      creator: "github-deployment-creator",
      createdAt: "2026-06-30T23:58:00.000Z",
      status: {
        id: "702",
        state: "success",
        environmentUrl: CANARY_URL,
        creator: "cloudflare-deployment-actor",
        createdAt: new Date(START_MS).toISOString(),
      },
    },
    productionWorkflow,
    productionEnvironment: {
      name: PROMOTION_APPROVAL_ENVIRONMENT,
      waitTimerMinutes: PRODUCTION_WAIT_TIMER_MINUTES,
      requiredReviewer: "predopta",
      preventSelfReview: true,
      protectedBranches: true,
      customBranchPolicies: false,
    },
    productionApprovals: [{ actor: "predopta", state: "approved", environment: PROMOTION_APPROVAL_ENVIRONMENT }],
    resolvedAt: new Date(nowMs).toISOString(),
  };
  const canaryEvidence = {
    schemaVersion: 1,
    kind: "ariada-wiki-canary-evidence",
    releaseSha: RELEASE_SHA,
    finalTarSha256: TAR_SHA,
    releaseManifestSha256: RELEASE_MANIFEST_SHA,
    contentSetSha256: CONTENT_SET_SHA,
    deploymentId: DEPLOYMENT_ID,
    hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    startedAt: new Date(START_MS).toISOString(),
    verifiedAt: new Date(START_MS).toISOString(),
  };
  const samples = samplesFixture(monitorWorkflow);
  const monitorEvidence = {
    schemaVersion: 1,
    kind: "ariada-wiki-monitor-evidence",
    artifactName: monitorArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
    releaseSha: RELEASE_SHA,
    finalTarSha256: TAR_SHA,
    deploymentId: DEPLOYMENT_ID,
    hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    canary: {
      runId: canaryWorkflow.id,
      artifactId: canaryArtifact.id,
      artifactName: canaryArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
      artifactApiDigest: canaryArtifact.apiDigest,
      workflowPath: TRUSTED_GATE_WORKFLOW_PATH,
      workflowHeadSha: RELEASE_SHA,
      actor: canaryWorkflow.actor,
      triggeringActor: canaryWorkflow.triggeringActor,
      startedAt: canaryEvidence.startedAt,
      verifiedAt: canaryEvidence.verifiedAt,
    },
    manifest: {
      releaseSha: RELEASE_SHA,
      manifestSha256: RELEASE_MANIFEST_SHA,
      contentSetSha256: CONTENT_SET_SHA,
      generatedAt: RELEASE_MANIFEST.generatedAt,
      fileCount: RELEASE_FILES.length,
    },
    cadenceSeconds: MONITOR_CADENCE_SECONDS,
    producerRuns: producerRunsFixture(samples, monitorWorkflow),
    window: {
      startedAt: samples[0].observedAt,
      endedAt: samples.at(-1).observedAt,
      bucketCount: samples.length,
      dispatchBucketCount: samples.length,
      dispatchCoverageBasisPoints: 10_000,
    },
    samples,
    coverage: {
      requiredFileCount: RELEASE_FILES.length,
      coveredFileCount: RELEASE_FILES.length,
      files: structuredClone(RELEASE_FILES),
    },
    generatedAt: samples.at(-1).observedAt,
  };
  return { resolution, canaryEvidence, releaseManifestBytes: Buffer.from(RELEASE_MANIFEST_BYTES), monitorEvidence, nowMs };
}

function promotionArchiveFixture() {
  const fixture = validFixture();
  const canaryArchiveBytes = storedZip([
    { name: "canary-evidence.json", contents: `${JSON.stringify(fixture.canaryEvidence)}\n` },
    { name: "release-manifest.json", contents: fixture.releaseManifestBytes },
  ]);
  fixture.resolution.canaryArtifact.apiDigest = `sha256:${sha256Hex(canaryArchiveBytes)}`;
  fixture.resolution.canaryArtifact.sizeInBytes = canaryArchiveBytes.length;
  fixture.monitorEvidence.canary.artifactApiDigest = fixture.resolution.canaryArtifact.apiDigest;
  const monitorArchiveBytes = storedZip([
    { name: "monitor.json", contents: `${JSON.stringify(fixture.monitorEvidence)}\n` },
  ]);
  fixture.resolution.monitorArtifact.apiDigest = `sha256:${sha256Hex(monitorArchiveBytes)}`;
  fixture.resolution.monitorArtifact.sizeInBytes = monitorArchiveBytes.length;
  return { ...fixture, canaryArchiveBytes, monitorArchiveBytes };
}

function expectGateFailure(mutator, pattern) {
  const fixture = validFixture();
  mutator(fixture);
  assert.throws(
    () => evaluatePromotionGate({
      resolution: fixture.resolution,
      canaryEvidence: fixture.canaryEvidence,
      releaseManifestBytes: fixture.releaseManifestBytes,
      monitorEvidence: fixture.monitorEvidence,
      now: fixture.nowMs,
    }),
    pattern,
  );
}

test("governance constants preserve the exact 48-hour policy", () => {
  assert.equal(MIN_CANARY_AGE_SECONDS, 172800);
  assert.equal(MONITOR_CADENCE_SECONDS, 300);
  assert.equal(MONITOR_MIN_SAMPLES, 576);
  assert.equal(PRODUCTION_WAIT_TIMER_MINUTES, 2880);
});

test("strict canonical Cloudflare origin derives the immutable deployment ID", () => {
  assert.deepEqual(validateCloudflareCanaryUrl(CANARY_URL), {
    raw: CANARY_URL,
    origin: CANARY_URL,
    hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    deploymentId: DEPLOYMENT_ID,
  });
  assert.equal(validateCloudflareCanaryUrl(`${CANARY_URL}/`).deploymentId, DEPLOYMENT_ID);
  for (const invalid of [
    ` ${CANARY_URL}`,
    `${CANARY_URL} `,
    CANARY_URL.toUpperCase(),
    `http://${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    `https://user@${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    `https://${DEPLOYMENT_ID}.ariada-wiki.pages.dev:443`,
    `${CANARY_URL}/wiki`,
    `${CANARY_URL}?sha=${RELEASE_SHA}`,
    `${CANARY_URL}#release`,
    "https://ariada-wiki.pages.dev",
    "https://main.ariada-wiki.pages.dev",
  ]) {
    assert.throws(() => validateCloudflareCanaryUrl(invalid));
  }
});

test("merged pull request derives releaseSha from current main, not final PR head", () => {
  const pull = validateMergedPullRequest({
    number: 77,
    state: "closed",
    merged: true,
    draft: false,
    user: { login: "pr-author" },
    head: { sha: HEAD_SHA, ref: "feature", repo: { full_name: REPOSITORY } },
    base: { sha: BASE_SHA, ref: "main", repo: { full_name: REPOSITORY } },
    merge_commit_sha: RELEASE_SHA,
    merged_at: MERGED_AT,
    merged_by: { login: "pr-merger" },
  }, { repository: REPOSITORY, defaultBranch: "main", currentMainSha: RELEASE_SHA });
  assert.equal(pull.headSha, HEAD_SHA);
  assert.equal(pull.mergeCommitSha, RELEASE_SHA);
  assert.notEqual(pull.headSha, pull.mergeCommitSha);
});

test("merged PR validation fails closed on merge/base/head relationship attacks", () => {
  const base = {
    number: 77,
    state: "closed",
    merged: true,
    draft: false,
    user: { login: "pr-author" },
    head: { sha: HEAD_SHA, ref: "feature", repo: { full_name: REPOSITORY } },
    base: { sha: BASE_SHA, ref: "main", repo: { full_name: REPOSITORY } },
    merge_commit_sha: RELEASE_SHA,
    merged_at: MERGED_AT,
    merged_by: { login: "pr-merger" },
  };
  const context = { repository: REPOSITORY, defaultBranch: "main", currentMainSha: RELEASE_SHA };
  for (const mutate of [
    (value) => { value.merged = false; },
    (value) => { value.state = "open"; },
    (value) => { value.base.ref = "release"; },
    (value) => { value.base.repo.full_name = "attacker/repo"; },
    (value) => { value.head.repo.full_name = "attacker/repo"; },
    (value) => { value.merge_commit_sha = "4".repeat(40); },
    (value) => { value.merged_by = null; },
  ]) {
    const value = structuredClone(base);
    mutate(value);
    assert.throws(() => validateMergedPullRequest(value, context));
  }
});

test("PR approval is bound to the final PR head and independent of its author", () => {
  const pull = { headSha: HEAD_SHA, author: "pr-author", mergedAt: MERGED_AT };
  const approval = validateFinalHeadApproval([
    { id: 10, state: "APPROVED", commit_id: BASE_SHA, submitted_at: "2026-06-30T18:00:00.000Z", user: { login: "stale-reviewer" } },
    { id: 11, state: "APPROVED", commit_id: HEAD_SHA, submitted_at: "2026-06-30T19:00:00.000Z", user: { login: "final-reviewer" } },
  ], pull);
  assert.equal(approval.actor, "final-reviewer");
  assert.equal(approval.commitSha, HEAD_SHA);
  assert.throws(() => validateFinalHeadApproval([
    { id: 12, state: "APPROVED", commit_id: BASE_SHA, submitted_at: "2026-06-30T19:00:00.000Z", user: { login: "reviewer" } },
  ], pull), /final pull request head/u);
  assert.throws(() => validateFinalHeadApproval([
    { id: 13, state: "APPROVED", commit_id: HEAD_SHA, submitted_at: "2026-06-30T19:00:00.000Z", user: { login: "pr-author" } },
  ], pull), /must differ/u);
});

test("production approval parser accepts the real environments-array API contract", () => {
  const history = [{
    state: "approved",
    comment: "Ship it!",
    environments: [{
      id: 161088068,
      node_id: "MDExOkVudmlyb25tZW50MTYxMDg4MDY4",
      name: PROMOTION_APPROVAL_ENVIRONMENT,
      url: `https://api.github.com/repos/${REPOSITORY}/environments/${PROMOTION_APPROVAL_ENVIRONMENT}`,
      html_url: `https://github.com/${REPOSITORY}/deployments/activity_log?environments_filter=${PROMOTION_APPROVAL_ENVIRONMENT}`,
    }],
    user: { login: "predopta", id: 42, type: "User" },
  }];
  assert.deepEqual(normalizeProductionApprovals(history), [{
    actor: "predopta",
    state: "approved",
    environment: PROMOTION_APPROVAL_ENVIRONMENT,
  }]);
  assert.throws(() => normalizeProductionApprovals([{
    ...history[0],
    environments: [{ name: "staging" }],
  }]), /ariada-wiki-promotion-approval approvals are absent/u);
  assert.throws(() => normalizeProductionApprovals([{
    state: "approved",
    environment: { name: PROMOTION_APPROVAL_ENVIRONMENT },
    user: { login: "predopta" },
  }]), /environments are absent/u);
});

test("workflow and artifact provenance reject path, event, SHA, producer, and name spoofing", () => {
  const apiRun = {
    id: 101,
    workflow_id: 11,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    status: "completed",
    conclusion: "success",
    head_sha: RELEASE_SHA,
    head_branch: "main",
    repository: { full_name: REPOSITORY },
    head_repository: { full_name: REPOSITORY },
    actor: { login: "builder" },
    triggering_actor: { login: "producer" },
    created_at: "2026-06-30T20:01:00.000Z",
    updated_at: "2026-06-30T20:02:00.000Z",
  };
  const context = {
    workflowId: "11",
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    releaseSha: RELEASE_SHA,
    defaultBranch: "main",
    repository: REPOSITORY,
    status: "completed",
    conclusion: "success",
  };
  const run = validateWorkflowRun(apiRun, context);
  for (const [field, replacement] of [
    ["path", ".github/workflows/attacker.yml"],
    ["event", "workflow_dispatch"],
    ["head_sha", HEAD_SHA],
    ["actor", null],
    ["triggering_actor", null],
  ]) {
    assert.throws(() => validateWorkflowRun({ ...apiRun, [field]: replacement }, context));
  }
  const artifact = {
    id: 501,
    name: buildArtifactName(RELEASE_SHA),
    digest: BUILD_API_DIGEST,
    expired: false,
    size_in_bytes: 2048,
    created_at: "2026-06-30T20:03:00.000Z",
    expires_at: "2026-07-14T00:00:00.000Z",
    workflow_run: { id: 101, head_sha: RELEASE_SHA },
  };
  const artifactContext = {
    name: buildArtifactName(RELEASE_SHA),
    run,
    resolutionTime: "2026-07-01T00:00:00.000Z",
  };
  assert.equal(validateArtifactMetadata(artifact, artifactContext).id, "501");
  assert.throws(() => validateArtifactMetadata({ ...artifact, name: "operator-name" }, artifactContext));
  assert.throws(() => validateArtifactMetadata({ ...artifact, digest: `sha256:${"f".repeat(63)}` }, artifactContext));
  assert.throws(() => requireUniqueCandidate([artifact, artifact], "trusted artifact"), /ambiguous/u);
});

test("artifact expiry is live strictly after resolution and timestamps cannot contradict", () => {
  const run = validateWorkflowRun({
    id: 101,
    workflow_id: 11,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    status: "completed",
    conclusion: "success",
    head_sha: RELEASE_SHA,
    head_branch: "main",
    repository: { full_name: REPOSITORY },
    head_repository: { full_name: REPOSITORY },
    actor: { login: "builder" },
    triggering_actor: { login: "producer" },
    created_at: "2026-06-30T20:01:00.000Z",
    updated_at: "2026-06-30T20:02:00.000Z",
  }, {
    workflowId: "11",
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    releaseSha: RELEASE_SHA,
    defaultBranch: "main",
    repository: REPOSITORY,
    status: "completed",
    conclusion: "success",
  });
  const resolutionTime = "2026-07-01T00:00:00.000Z";
  const artifact = {
    id: 501,
    name: buildArtifactName(RELEASE_SHA),
    digest: BUILD_API_DIGEST,
    expired: false,
    size_in_bytes: 2048,
    created_at: "2026-06-30T20:03:00.000Z",
    expires_at: "2026-07-01T00:00:00.001Z",
    workflow_run: { id: 101, head_sha: RELEASE_SHA },
  };
  const context = { name: artifact.name, run, resolutionTime };
  assert.equal(validateArtifactMetadata(artifact, context).expiresAt, artifact.expires_at);
  assert.throws(() => validateArtifactMetadata({ ...artifact, expires_at: resolutionTime }, context), /strictly later/u);
  assert.throws(() => validateArtifactMetadata({ ...artifact, expires_at: "2026-06-30T23:59:59.999Z" }, context), /strictly later/u);
  assert.throws(() => validateArtifactMetadata({ ...artifact, expires_at: "invalid" }, context), /ISO-8601/u);
  assert.throws(() => validateArtifactMetadata({ ...artifact, expires_at: "2026-06-30T20:03:00.000Z" }, context), /contradicts/u);
  assert.throws(() => validateArtifactMetadata({
    ...artifact,
    created_at: "2026-07-01T00:00:00.001Z",
    expires_at: "2026-07-02T00:00:00.000Z",
  }, context), /later than resolution/u);
  assert.throws(() => validateArtifactMetadata({ ...artifact, expired: true }, context), /expired state/u);
  assert.throws(() => validateArtifactMetadata(artifact, { name: artifact.name, run }), /evaluation time/u);
});

test("raw artifact transport requires exact final HTTP 200 after redirect", async () => {
  const bytes = Buffer.from("raw-archive-bytes");
  for (const status of [201, 204, 206, 207]) {
    let requestIndex = 0;
    const fetchImpl = async () => {
      requestIndex += 1;
      if (requestIndex === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://artifact-storage.example/archive.zip" },
        });
      }
      return new Response(status === 204 ? null : bytes, { status });
    };
    await assert.rejects(
      () => downloadArtifactArchive({
        repository: REPOSITORY,
        token: "transport-token",
        artifactId: "912",
        fetchImpl,
      }),
      new RegExp(`HTTP ${status}`, "u"),
      `final status ${status} must fail closed`,
    );
  }
});

test("raw artifact transport rejects Content-Range and invalid or mismatched Content-Length", async () => {
  const bytes = Buffer.from("zip");
  const cases = [
    {
      name: "content range",
      headers: { "content-range": "bytes 0-2/3", "content-length": "3" },
      pattern: /Content-Range/u,
    },
    {
      name: "malformed length",
      headers: { "content-length": "three" },
      pattern: /valid nonnegative integer/u,
    },
    {
      name: "negative length",
      headers: { "content-length": "-1" },
      pattern: /valid nonnegative integer/u,
    },
    {
      name: "short declared length",
      headers: { "content-length": "2" },
      pattern: /does not match/u,
    },
    {
      name: "long declared length",
      headers: { "content-length": "4" },
      pattern: /does not match/u,
    },
    {
      name: "over-limit declared length",
      headers: { "content-length": String(16 * 1024 * 1024 + 1) },
      pattern: /exceeds the size bound/u,
    },
  ];
  for (const entry of cases) {
    await assert.rejects(
      () => downloadArtifactArchive({
        repository: REPOSITORY,
        token: "transport-token",
        artifactId: "912",
        fetchImpl: async () => new Response(bytes, { status: 200, headers: entry.headers }),
      }),
      entry.pattern,
      entry.name,
    );
  }
});

test("raw artifact transport fails closed on a truncated response stream", async () => {
  let reads = 0;
  const body = new ReadableStream({
    pull(controller) {
      reads += 1;
      if (reads === 1) controller.enqueue(Uint8Array.from([0x50, 0x4b]));
      else controller.error(new Error("truncated transport"));
    },
  });
  await assert.rejects(
    () => downloadArtifactArchive({
      repository: REPOSITORY,
      token: "transport-token",
      artifactId: "912",
      fetchImpl: async () => new Response(body, {
        status: 200,
        headers: { "content-length": "3" },
      }),
    }),
    /failed while reading/u,
  );
});

test("raw artifact transport enforces the byte cap while streaming", async () => {
  let chunks = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (chunks < 17) {
        chunks += 1;
        controller.enqueue(new Uint8Array(1024 * 1024));
      } else {
        controller.close();
      }
    },
  });
  await assert.rejects(
    () => downloadArtifactArchive({
      repository: REPOSITORY,
      token: "transport-token",
      artifactId: "912",
      fetchImpl: async () => new Response(body, { status: 200 }),
    }),
    /streamed size bound/u,
  );
});

test("exact HTTP 200 succeeds and redirected archive requests strip authorization and Range", async () => {
  const bytes = Buffer.from("exact-raw-archive");
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({
      url: String(url),
      headers: new Headers(options.headers),
      redirect: options.redirect,
    });
    if (requests.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://artifact-storage.example/archive.zip" },
      });
    }
    return new Response(bytes, {
      status: 200,
      headers: { "content-length": String(bytes.length) },
    });
  };
  const received = await downloadArtifactArchive({
    repository: REPOSITORY,
    token: "transport-token",
    artifactId: "912",
    fetchImpl,
  });
  assert.deepEqual(received, bytes);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].redirect, "manual");
  assert.equal(requests[0].headers.get("authorization"), "Bearer transport-token");
  assert.equal(requests[0].headers.get("range"), null);
  assert.equal(requests[1].redirect, "error");
  assert.equal(requests[1].headers.get("authorization"), null);
  assert.equal(requests[1].headers.get("range"), null);
});

function directArtifactApiFixture({ selectedArtifactId = 802, selectedReleaseSha = RELEASE_SHA } = {}) {
  const runs = new Map([
    [700, {
      id: 700,
      workflow_id: 11,
      path: TRUSTED_GATE_WORKFLOW_PATH,
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      head_sha: OLD_RELEASE_SHA,
      head_branch: "main",
      repository: { full_name: REPOSITORY },
      head_repository: { full_name: REPOSITORY },
      actor: { login: "old-canary-actor" },
      triggering_actor: { login: "old-canary-trigger" },
      created_at: "2026-06-20T00:00:00.000Z",
      updated_at: "2026-06-20T00:01:00.000Z",
    }],
    [701, {
      id: 701,
      workflow_id: 11,
      path: TRUSTED_GATE_WORKFLOW_PATH,
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      head_sha: RELEASE_SHA,
      head_branch: "main",
      repository: { full_name: REPOSITORY },
      head_repository: { full_name: REPOSITORY },
      actor: { login: "first-retry-actor" },
      triggering_actor: { login: "first-retry-trigger" },
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:01:00.000Z",
    }],
    [702, {
      id: 702,
      workflow_id: 11,
      path: TRUSTED_GATE_WORKFLOW_PATH,
      event: "workflow_dispatch",
      status: "completed",
      conclusion: "success",
      head_sha: selectedReleaseSha,
      head_branch: "main",
      repository: { full_name: REPOSITORY },
      head_repository: { full_name: REPOSITORY },
      actor: { login: "selected-retry-actor" },
      triggering_actor: { login: "selected-retry-trigger" },
      created_at: "2026-07-01T00:02:00.000Z",
      updated_at: "2026-07-01T00:03:00.000Z",
    }],
  ]);
  const artifact = (id, name, runId, headSha, digestCharacter) => ({
    id,
    name,
    digest: `sha256:${digestCharacter.repeat(64)}`,
    expired: false,
    size_in_bytes: 2048,
    created_at: runs.get(runId).updated_at,
    expires_at: "2026-07-14T00:00:00.000Z",
    workflow_run: { id: runId, head_sha: headSha },
  });
  const artifacts = new Map([
    [800, artifact(800, canaryArtifactName(OLD_RELEASE_SHA, DEPLOYMENT_ID), 700, OLD_RELEASE_SHA, "8")],
    [801, artifact(801, canaryArtifactName(RELEASE_SHA, DEPLOYMENT_ID), 701, RELEASE_SHA, "9")],
    [802, artifact(802, canaryArtifactName(selectedReleaseSha, DEPLOYMENT_ID), 702, selectedReleaseSha, "a")],
  ]);
  const requested = [];
  const client = {
    repository: REPOSITORY,
    async json(path) {
      requested.push(path);
      const artifactMatch = /\/actions\/artifacts\/(\d+)$/u.exec(path);
      if (artifactMatch !== null) {
        const value = artifacts.get(Number(artifactMatch[1]));
        if (value === undefined) throw new Error("artifact not found");
        return structuredClone(value);
      }
      const runMatch = /\/actions\/runs\/(\d+)$/u.exec(path);
      if (runMatch !== null) return structuredClone(runs.get(Number(runMatch[1])));
      if (path.includes("/actions/workflows/")) {
        return { id: 11, path: TRUSTED_GATE_WORKFLOW_PATH, state: "active" };
      }
      throw new Error(`unexpected API request: ${path}`);
    },
  };
  return { artifacts, runs, client, requested, selectedArtifactId };
}

function directCanaryContext(artifactId = 802) {
  return {
    artifactId: String(artifactId),
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    releaseSha: RELEASE_SHA,
    defaultBranch: "main",
    name: canaryArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
    label: "canary verification",
    resolutionTime: START_MS + 10 * 60 * 1000,
  };
}

test("explicit artifact ID selects a retained retry without repository-global name uniqueness", async () => {
  const fixture = directArtifactApiFixture();
  const selected = await resolveTrustedArtifactById(fixture.client, directCanaryContext(fixture.selectedArtifactId));
  assert.equal(selected.artifact.id, String(fixture.selectedArtifactId));
  assert.equal(selected.run.id, "702");
  assert.deepEqual(fixture.requested.filter((path) => path.includes("/actions/artifacts/")), [
    `/repos/${REPOSITORY}/actions/artifacts/${fixture.selectedArtifactId}`,
  ]);
  assert.ok(fixture.requested.every((path) => !path.includes("?name=") && !path.endsWith("/actions/artifacts")));
  assert.equal(fixture.artifacts.size, 3, "old-release and same-release retry artifacts remain retained");
});

test("direct artifact lookup fails closed on ID, name, run, workflow, SHA, digest, expiry, reuse, and old release", async () => {
  const attacks = [
    (fixture) => { fixture.artifacts.get(802).id = 999; },
    (fixture) => { fixture.artifacts.get(802).name = canaryArtifactName(OLD_RELEASE_SHA, DEPLOYMENT_ID); },
    (fixture) => { fixture.artifacts.get(802).workflow_run.id = 700; },
    (fixture) => { fixture.runs.get(702).workflow_id = 99; },
    (fixture) => { fixture.runs.get(702).path = ".github/workflows/untrusted.yml"; },
    (fixture) => { fixture.runs.get(702).head_sha = OLD_RELEASE_SHA; },
    (fixture) => { fixture.artifacts.get(802).workflow_run.head_sha = OLD_RELEASE_SHA; },
    (fixture) => { fixture.artifacts.get(802).digest = "sha256:bad"; },
    (fixture) => { fixture.artifacts.get(802).expired = true; },
    (fixture) => { fixture.artifacts.get(802).expires_at = new Date(START_MS + 10 * 60 * 1000).toISOString(); },
    (fixture) => { fixture.artifacts.get(802).expires_at = new Date(START_MS + 10 * 60 * 1000 - 1).toISOString(); },
    (fixture) => { fixture.artifacts.get(802).expires_at = "invalid"; },
    (fixture) => { fixture.artifacts.get(802).expires_at = fixture.artifacts.get(802).created_at; },
    (fixture) => { fixture.artifacts.get(802).created_at = new Date(START_MS + 10 * 60 * 1000 + 1).toISOString(); },
  ];
  for (const attack of attacks) {
    const fixture = directArtifactApiFixture();
    attack(fixture);
    await assert.rejects(() => resolveTrustedArtifactById(fixture.client, directCanaryContext()));
  }
  const oldRelease = directArtifactApiFixture();
  await assert.rejects(() => resolveTrustedArtifactById(oldRelease.client, directCanaryContext(800)), /name|SHA|provenance/u);
  const missing = directArtifactApiFixture();
  await assert.rejects(() => resolveTrustedArtifactById(missing.client, directCanaryContext(999)), /not found/u);
  assert.throws(() => validateDistinctPromotionArtifactIds("802", "802"), /must be distinct/u);
  assert.deepEqual(validateDistinctPromotionArtifactIds("802", "900"), {
    canaryArtifactId: "802",
    monitorArtifactId: "900",
  });
});

test("release manifest binds exact content identities to releaseSha", () => {
  assert.deepEqual(validateReleaseManifest(RELEASE_MANIFEST, { releaseSha: RELEASE_SHA }), RELEASE_MANIFEST);
  assert.throws(() => validateReleaseManifest({ ...RELEASE_MANIFEST, releaseSha: HEAD_SHA }, { releaseSha: RELEASE_SHA }), /expected release SHA/u);
  assert.throws(() => validateReleaseManifest({ ...RELEASE_MANIFEST, contentSetSha256: "f".repeat(64) }, { releaseSha: RELEASE_SHA }), /contentSetSha256/u);
  assert.throws(() => validateReleaseManifest({ ...RELEASE_MANIFEST, files: [...RELEASE_FILES].reverse() }, { releaseSha: RELEASE_SHA }), /strictly sorted/u);
});

test("wrong deployed manifest bytes fail even when JSON remains schema-valid", () => {
  const wrongDeploymentManifest = serializeContentReleaseManifest({ ...RELEASE_MANIFEST, generatedAt: "2026-06-30T20:00:01.000Z" });
  assert.throws(() => validateReleaseManifestCopies({
    artifactBytes: RELEASE_MANIFEST_BYTES,
    archivedBytes: RELEASE_MANIFEST_BYTES,
    deployedBytes: wrongDeploymentManifest,
  }, { releaseSha: RELEASE_SHA }), /deployed release manifest bytes differ/u);
});

test("real monitor and aggregate output is consumed end-to-end by the gate", async () => {
  const fixture = validFixture();
  const archive = storedZip([
    { name: "canary-evidence.json", contents: `${JSON.stringify(fixture.canaryEvidence)}\n` },
    { name: "release-manifest.json", contents: RELEASE_MANIFEST_BYTES },
  ]);
  const archiveApiDigest = `sha256:${sha256Hex(archive)}`;
  fixture.resolution.canaryArtifact.apiDigest = archiveApiDigest;
  const identity = validateRcIdentity({
    releaseSha: RELEASE_SHA,
    artifactDigest: TAR_SHA,
    manifestSha256: RELEASE_MANIFEST_SHA,
    contentSetSha256: CONTENT_SET_SHA,
    url: CANARY_URL,
    deploymentId: DEPLOYMENT_ID,
  }, { workflowHeadSha: RELEASE_SHA });
  const decodedCanary = decodeCanaryArchive(archive, archiveApiDigest, identity);
  const fetchImpl = async (input) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname === "/.well-known/ariada-release.json") {
      return new Response(RELEASE_MANIFEST_BYTES, { status: 200, headers: { "content-type": "application/json" } });
    }
    const file = RELEASE_FILES.find((entry) => entry.url === pathname);
    if (file !== undefined) return new Response(RELEASE_BODIES.get(file.path), { status: 200 });
    if (PROBE_PATHS.includes(pathname)) return new Response("ok", { status: 200 });
    return new Response("missing", { status: 404 });
  };
  const sampleCount = MONITOR_MIN_SAMPLES + 1;
  const samples = await Promise.all(Array.from({ length: sampleCount }, (_, index) => {
    const observedAt = new Date(START_MS + index * MONITOR_CADENCE_SECONDS * 1000);
    return runMonitor({ identity, fetchImpl, now: () => observedAt });
  }));
  const currentRunId = Number(fixture.resolution.monitorWorkflow.id);
  const runs = [];
  const artifacts = [];
  const sampleRecords = [];
  for (const [index, sample] of samples.entries()) {
    const current = index === samples.length - 1;
    const runId = current ? currentRunId : 100_000 + index;
    const observedAtMs = Date.parse(sample.observedAt);
    const run = {
      id: runId,
      name: "Ariada Wiki RC monitor",
      workflow_id: 22,
      event: "workflow_dispatch",
      status: current ? "in_progress" : "completed",
      conclusion: current ? null : "success",
      path: TRUSTED_MONITOR_WORKFLOW_PATH,
      head_branch: "main",
      head_sha: RELEASE_SHA,
      actor: { login: fixture.resolution.monitorWorkflow.actor },
      triggering_actor: { login: fixture.resolution.monitorWorkflow.triggeringActor },
      created_at: new Date(observedAtMs - 30_000).toISOString(),
      updated_at: sample.observedAt,
      repository: { id: 101, full_name: REPOSITORY },
      head_repository: { id: 101, full_name: REPOSITORY },
    };
    const artifact = {
      id: 1_000_000 + runId,
      name: `ariada-wiki-monitor-sample-${RELEASE_SHA}`,
      size_in_bytes: 12_000,
      expired: false,
      digest: `sha256:${sha256Hex(Buffer.from(`sample-${runId}`))}`,
      created_at: run.updated_at,
      updated_at: run.updated_at,
      workflow_run: {
        id: run.id,
        repository_id: 101,
        head_repository_id: 101,
        head_branch: "main",
        head_sha: RELEASE_SHA,
      },
    };
    runs.push(run);
    artifacts.push(artifact);
    sampleRecords.push({
      runId,
      artifactId: artifact.id,
      artifactApiDigest: artifact.digest,
      sample,
    });
  }
  const monitorEvidence = buildMonitorAggregate({
    identity,
    canonicalManifest: decodedCanary.manifest,
    canary: {
      releaseSha: RELEASE_SHA,
      finalTarSha256: TAR_SHA,
      manifestSha256: RELEASE_MANIFEST_SHA,
      contentSetSha256: CONTENT_SET_SHA,
      deploymentId: DEPLOYMENT_ID,
      hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
      repository: REPOSITORY,
      workflowPath: TRUSTED_GATE_WORKFLOW_PATH,
      workflowHeadSha: RELEASE_SHA,
      headBranch: "main",
      event: "workflow_dispatch",
      actor: fixture.resolution.canaryWorkflow.actor,
      triggeringActor: fixture.resolution.canaryWorkflow.triggeringActor,
      runId: Number(fixture.resolution.canaryWorkflow.id),
      artifactId: Number(fixture.resolution.canaryArtifact.id),
      artifactName: canaryArtifactName(RELEASE_SHA, DEPLOYMENT_ID),
      artifactApiDigest: archiveApiDigest,
      startedAt: decodedCanary.evidence.startedAt,
      verifiedAt: decodedCanary.evidence.verifiedAt,
    },
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: fixture.resolution.monitorWorkflow.actor,
    currentRunId,
    runs,
    artifacts,
    sampleRecords,
    now: new Date(fixture.nowMs).toISOString(),
  });
  const result = evaluatePromotionGate({
    resolution: fixture.resolution,
    canaryEvidence: decodedCanary.evidence,
    releaseManifestBytes: decodedCanary.releaseManifestBytes,
    monitorEvidence,
    now: fixture.nowMs,
  });
  assert.equal(result.releaseSha, RELEASE_SHA);
  assert.equal(result.finalTarSha256, TAR_SHA);
  assert.equal(monitorEvidence.coverage.coveredFileCount, RELEASE_FILES.length);
});

test("valid promotion passes at exactly 172800 seconds", () => {
  const fixture = validFixture();
  const result = evaluatePromotionGate({
    resolution: fixture.resolution,
    canaryEvidence: fixture.canaryEvidence,
    releaseManifestBytes: fixture.releaseManifestBytes,
    monitorEvidence: fixture.monitorEvidence,
    now: fixture.nowMs,
  });
  assert.equal(result.canaryAgeSeconds, 172800);
  assert.equal(result.releaseSha, RELEASE_SHA);
  assert.equal(result.pullRequestHeadSha, HEAD_SHA);
});

test("promotion consumes only digest-verified raw canary and aggregate ZIP bytes", () => {
  const fixture = promotionArchiveFixture();
  const decoded = decodePromotionEvidenceArchives({
    resolution: fixture.resolution,
    canaryArchiveBytes: fixture.canaryArchiveBytes,
    monitorArchiveBytes: fixture.monitorArchiveBytes,
  });
  assert.deepEqual(decoded.canaryEvidence, fixture.canaryEvidence);
  assert.deepEqual(decoded.releaseManifestBytes, fixture.releaseManifestBytes);
  assert.deepEqual(decoded.monitorEvidence, fixture.monitorEvidence);
  assert.equal(evaluatePromotionGate({
    resolution: fixture.resolution,
    ...decoded,
    now: fixture.nowMs,
  }).releaseSha, RELEASE_SHA);
});

test("mutated raw ZIP bytes and mismatched API digests fail before payload trust", () => {
  for (const archiveName of ["canaryArchiveBytes", "monitorArchiveBytes"]) {
    const fixture = promotionArchiveFixture();
    fixture[archiveName] = Buffer.from(fixture[archiveName]);
    fixture[archiveName][Math.floor(fixture[archiveName].length / 2)] ^= 0x01;
    assert.throws(() => decodePromotionEvidenceArchives({
      resolution: fixture.resolution,
      canaryArchiveBytes: fixture.canaryArchiveBytes,
      monitorArchiveBytes: fixture.monitorArchiveBytes,
    }), /raw ZIP digest/u);
  }
  for (const artifactName of ["canaryArtifact", "monitorArtifact"]) {
    const fixture = promotionArchiveFixture();
    fixture.resolution[artifactName].apiDigest = `sha256:${"f".repeat(64)}`;
    assert.throws(() => decodePromotionEvidenceArchives({
      resolution: fixture.resolution,
      canaryArchiveBytes: fixture.canaryArchiveBytes,
      monitorArchiveBytes: fixture.monitorArchiveBytes,
    }), /raw ZIP digest/u);
  }
});

test("raw evidence ZIPs reject traversal, aliases, and extra files after digest verification", () => {
  for (const entries of [
    [
      { name: "../canary-evidence.json", contents: "{}\n" },
      { name: "release-manifest.json", contents: RELEASE_MANIFEST_BYTES },
    ],
    [
      { name: "canary-evidence.json", contents: "{}\n" },
      { name: "release-manifest.json", contents: RELEASE_MANIFEST_BYTES },
      { name: "extra.json", contents: "{}\n" },
    ],
  ]) {
    const fixture = promotionArchiveFixture();
    fixture.canaryArchiveBytes = storedZip(entries);
    fixture.resolution.canaryArtifact.apiDigest = `sha256:${sha256Hex(fixture.canaryArchiveBytes)}`;
    assert.throws(() => decodePromotionEvidenceArchives({
      resolution: fixture.resolution,
      canaryArchiveBytes: fixture.canaryArchiveBytes,
      monitorArchiveBytes: fixture.monitorArchiveBytes,
    }), /unsafe entry path|exact expected root entries/u);
  }
});

test("normalized artifact expiry remains strict at promotion resolution time", () => {
  expectGateFailure((fixture) => {
    fixture.resolution.canaryArtifact.expiresAt = fixture.resolution.resolvedAt;
  }, /strictly later/u);
  expectGateFailure((fixture) => {
    fixture.resolution.canaryArtifact.expiresAt = new Date(fixture.nowMs - 1).toISOString();
  }, /strictly later/u);
  expectGateFailure((fixture) => {
    fixture.resolution.monitorArtifact.expiresAt = "invalid";
  }, /ISO-8601/u);
  expectGateFailure((fixture) => {
    fixture.resolution.monitorArtifact.expiresAt = fixture.resolution.monitorArtifact.createdAt;
  }, /contradicts/u);
  expectGateFailure((fixture) => {
    fixture.resolution.monitorArtifact.createdAt = new Date(fixture.nowMs + 1).toISOString();
  }, /later than resolution/u);
});

test("canary age fails one second before and passes at the exact boundary", () => {
  const startedAt = new Date(START_MS).toISOString();
  assert.throws(
    () => validateCanaryAge(startedAt, START_MS + MIN_CANARY_AGE_SECONDS * 1000 - 1000),
    /younger than 172800/u,
  );
  assert.equal(validateCanaryAge(startedAt, START_MS + MIN_CANARY_AGE_SECONDS * 1000), MIN_CANARY_AGE_SECONDS * 1000);
});

test("promotion rejects missing, failed, sparse, stale, and reused monitor evidence", () => {
  expectGateFailure((fixture) => { fixture.monitorEvidence = undefined; }, /must be an object/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.samples[200].status = "failed"; }, /status/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.samples = fixture.monitorEvidence.samples.slice(0, -2);
    fixture.monitorEvidence.window.bucketCount = fixture.monitorEvidence.samples.length;
    fixture.monitorEvidence.window.dispatchBucketCount = fixture.monitorEvidence.samples.length;
    fixture.monitorEvidence.window.endedAt = fixture.monitorEvidence.samples.at(-1).observedAt;
  }, /at least 576/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.samples[300].observedAt = new Date(Date.parse(fixture.monitorEvidence.samples[299].observedAt) + 361_000).toISOString();
  }, /cadence bounds|UTC bucket/u);
  expectGateFailure((fixture) => {
    fixture.nowMs += 601_000;
    fixture.resolution.resolvedAt = new Date(fixture.nowMs).toISOString();
  }, /final monitor sample is stale/u);
  expectGateFailure((fixture) => {
    fixture.nowMs = START_MS + (MAX_CANARY_AGE_SECONDS + 1) * 1000;
    fixture.resolution.resolvedAt = new Date(fixture.nowMs).toISOString();
  }, /maximum soak age/u);
});

test("promotion rejects identity substitution across build, canary, deployment, and monitor", () => {
  expectGateFailure((fixture) => { fixture.resolution.build.releaseSha = HEAD_SHA; }, /release SHA/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.canary.workflowHeadSha = HEAD_SHA; }, /workflow head SHA/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.canary.artifactApiDigest = `sha256:${"f".repeat(64)}`; }, /API digest/u);
  expectGateFailure((fixture) => { fixture.resolution.githubDeployment.sha = HEAD_SHA; }, /deployment SHA/u);
  expectGateFailure((fixture) => { fixture.resolution.githubDeployment.status.environmentUrl = "https://ffffffff.ariada-wiki.pages.dev"; }, /status URL/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.samples[100].releaseSha = HEAD_SHA; }, /release SHA/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.samples[100].deploymentId = "ffffffff"; }, /deployment ID/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.artifactName = monitorArtifactName(OLD_RELEASE_SHA, DEPLOYMENT_ID); }, /artifact name/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.canary.artifactName = canaryArtifactName(OLD_RELEASE_SHA, DEPLOYMENT_ID); }, /artifact name/u);
  expectGateFailure((fixture) => { fixture.canaryEvidence.releaseManifestSha256 = "f".repeat(64); }, /release manifest digest/u);
  expectGateFailure((fixture) => { fixture.monitorEvidence.manifest.contentSetSha256 = "f".repeat(64); }, /content-set digest/u);
});

test("promotion rejects modified manifests and incomplete or mismatched content coverage", () => {
  expectGateFailure((fixture) => {
    fixture.releaseManifestBytes = serializeContentReleaseManifest({ ...RELEASE_MANIFEST, generatedAt: "2026-06-30T20:00:01.000Z" });
  }, /release manifest digest/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.coverage.files[0].sha256 = "f".repeat(64);
  }, /coverage|exact manifest/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.coverage.files.pop();
  }, /coverage|exact manifest/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.samples[42].manifestSha256 = "f".repeat(64);
  }, /manifest byte digest/u);
  expectGateFailure((fixture) => {
    fixture.monitorEvidence.samples[42].contentSetSha256 = "f".repeat(64);
  }, /content-set digest/u);
});

test("production reviewer differs from every required actor category", () => {
  const paths = [
    ["build", "pullRequest", "author"],
    ["build", "pullRequest", "mergedBy"],
    ["build", "mergeCommit", "committer"],
    ["build", "buildWorkflow", "actor"],
    ["build", "buildWorkflow", "triggeringActor"],
    ["githubDeployment", "creator"],
    ["githubDeployment", "status", "creator"],
    ["canaryWorkflow", "actor"],
    ["canaryWorkflow", "triggeringActor"],
    ["monitorWorkflow", "triggeringActor"],
    ["monitorWorkflow", "actor"],
    ["productionWorkflow", "triggeringActor"],
    ["productionWorkflow", "actor"],
  ];
  for (const path of paths) {
    expectGateFailure((fixture) => {
      if (path[0] === "canaryWorkflow") {
        fixture.resolution.canaryWorkflow[path.at(-1)] = "predopta";
        fixture.monitorEvidence.canary[path.at(-1)] = "predopta";
        return;
      }
      if (path[0] === "monitorWorkflow") {
        fixture.resolution.monitorWorkflow.actor = "predopta";
        fixture.resolution.monitorWorkflow.triggeringActor = "predopta";
        for (const producer of fixture.monitorEvidence.producerRuns) {
          if (producer.event === "workflow_dispatch") {
            producer.actor = "predopta";
            producer.triggeringActor = "predopta";
          }
        }
        return;
      }
      let target = fixture.resolution;
      for (const segment of path.slice(0, -1)) target = target[segment];
      target[path.at(-1)] = "predopta";
    }, /not independent/u);
  }
});

test("all required actor evidence fails closed when absent", () => {
  const paths = [
    ["build", "pullRequest", "author"],
    ["build", "mergeCommit", "committer"],
    ["build", "buildWorkflow", "actor"],
    ["build", "buildWorkflow", "triggeringActor"],
    ["githubDeployment", "creator"],
    ["githubDeployment", "status", "creator"],
    ["canaryWorkflow", "actor"],
    ["monitorWorkflow", "triggeringActor"],
    ["monitorWorkflow", "actor"],
    ["productionWorkflow", "triggeringActor"],
  ];
  for (const path of paths) {
    expectGateFailure((fixture) => {
      let target = fixture.resolution;
      for (const segment of path.slice(0, -1)) target = target[segment];
      target[path.at(-1)] = null;
    });
  }
});

test("reviewer matching any selected or fallback producer actor is rejected", () => {
  const fixture = validFixture();
  assert.equal(fixture.monitorEvidence.producerRuns.length, 1_154);
  const producerActors = new Set(fixture.monitorEvidence.producerRuns.flatMap(({ actor, triggeringActor }) => [actor, triggeringActor]));
  assert.ok(producerActors.has("scheduled-fallback-a"));
  assert.ok(producerActors.has("scheduled-trigger-b"));
  assert.ok(producerActors.has("senko-monitor-dispatcher"));
  expectGateFailure((value) => {
    const fallback = value.monitorEvidence.producerRuns.find((producer) => producer.event === "schedule" && !producer.selected);
    fallback.actor = "predopta";
  }, /not independent/u);
  expectGateFailure((value) => {
    const fallback = value.monitorEvidence.producerRuns.find((producer) => producer.event === "schedule" && !producer.selected);
    fallback.triggeringActor = "predopta";
  }, /not independent/u);
  expectGateFailure((value) => {
    value.resolution.monitorWorkflow.actor = "predopta";
    value.resolution.monitorWorkflow.triggeringActor = "predopta";
    for (const producer of value.monitorEvidence.producerRuns) {
      if (producer.event === "workflow_dispatch") {
        producer.actor = "predopta";
        producer.triggeringActor = "predopta";
      }
    }
  }, /not independent/u);
});

test("exact producerRuns schema rejects malformed or missing provenance", () => {
  const fixture = validFixture();
  const producerActors = validateSampleProducerEvidence(fixture.monitorEvidence.producerRuns, {
    samples: fixture.monitorEvidence.samples,
    releaseSha: RELEASE_SHA,
    repository: REPOSITORY,
    monitorWorkflow: fixture.resolution.monitorWorkflow,
    generatedAtMs: fixture.nowMs,
  });
  assert.equal(producerActors.length, 2_308);
  expectGateFailure((value) => { delete value.monitorEvidence.producerRuns; }, /missing or unexpected fields/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns = []; }, /producer evidence is absent/u);
  expectGateFailure((value) => { delete value.monitorEvidence.producerRuns[0].actor; }, /missing or unexpected fields/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].actor = ""; }, /canonical non-empty string/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].workflowPath = ".github/workflows/untrusted.yml"; }, /workflow path/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].repository = "attacker/repo"; }, /repository/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].workflowHeadSha = HEAD_SHA; }, /release SHA/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].artifactApiDigest = "sha256:bad"; }, /artifact digest/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[0].artifactName = `ariada-wiki-monitor-sample-${OLD_RELEASE_SHA}`; }, /artifact name/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[1].runId = value.monitorEvidence.producerRuns[0].runId; }, /run IDs must be unique/u);
  expectGateFailure((value) => { value.monitorEvidence.producerRuns[1].artifactId = value.monitorEvidence.producerRuns[0].artifactId; }, /artifact IDs must be unique/u);
  expectGateFailure((value) => {
    const selected = value.monitorEvidence.producerRuns.find((producer) => producer.selected);
    selected.selected = false;
  }, /selected producer/u);
  expectGateFailure((value) => {
    const fallback = value.monitorEvidence.producerRuns.find((producer) => producer.sampleObservedAt === null);
    fallback.selected = true;
  }, /cannot be selected/u);
  expectGateFailure((value) => {
    const dispatch = value.monitorEvidence.producerRuns.find((producer) => producer.event === "workflow_dispatch");
    dispatch.triggeringActor = "attacker";
  }, /trusted dispatch triggering actor/u);
  expectGateFailure((value) => {
    const sourceIndex = value.monitorEvidence.producerRuns.findIndex((producer) => producer.runId === value.resolution.monitorWorkflow.id);
    value.monitorEvidence.producerRuns.splice(sourceIndex, 1);
  }, /source producer count|selected producer/u);
});

test("production approval and environment evidence fail closed", () => {
  expectGateFailure((fixture) => { fixture.resolution.productionApprovals = []; }, /approvals are absent/u);
  expectGateFailure((fixture) => { fixture.resolution.productionApprovals[0].actor = "operator"; }, /predopta/u);
  expectGateFailure((fixture) => { fixture.resolution.productionApprovals[0].state = "rejected"; }, /predopta/u);
  expectGateFailure((fixture) => { fixture.resolution.productionEnvironment.waitTimerMinutes = 2879; }, /wait timer/u);
  expectGateFailure((fixture) => { fixture.resolution.productionEnvironment.preventSelfReview = false; }, /prevent_self_review/u);
  expectGateFailure((fixture) => { fixture.resolution.productionEnvironment.protectedBranches = false; }, /protected branches/u);
});

test("workflow has stable checks, complete governance suites, pinned actions, and no deployment", async () => {
  const [workflow, gateSource] = await Promise.all([
    readFile(resolve(ROOT, ".github/workflows/ariada-wiki-rc.yml"), "utf8"),
    readFile(resolve(ROOT, "ci/wiki-rc-gate.mjs"), "utf8"),
  ]);
  assert.doesNotMatch(workflow, /^\+/mu);
  assert.match(workflow, /name: Ariada Wiki RC \/ Gate governance/u);
  assert.match(workflow, /name: Ariada Wiki RC \/ Wiki validation/u);
  assert.match(workflow, /name: Ariada Wiki RC \/ Companion validation/u);
  assert.match(workflow, /ci\/wiki-rc-gate\.test\.mjs/u);
  assert.match(workflow, /ci\/wiki-rc-content-manifest\.test\.mjs/u);
  assert.match(workflow, /ci\/wiki-rc-monitor\.test\.mjs/u);
  assert.match(workflow, /ci\/wiki-rc-monitor-aggregate\.test\.mjs/u);
  assert.match(workflow, /actionlint[\s\S]*ariada-wiki-rc\.yml[\s\S]*ariada-wiki-monitor\.yml/u);
  assert.match(workflow, /pnpm --filter ariada-wiki (?:test|check|build)/u);
  assert.match(workflow, /pnpm --filter ariada-org (?:test:contracts|build)/u);
  assert.match(workflow, /environment:\s*\n\s*name: ariada-wiki-promotion-approval/u);
  assert.doesNotMatch(workflow, /^\s+deployment:\s*(?:false|true)\s*$/mu);
  assert.match(workflow, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/u);
  assert.doesNotMatch(workflow, /secrets\.CANARY_URL|CANARY_URL:\s*\$\{\{\s*secrets\./u);
  assert.doesNotMatch(workflow, /wrangler\s+pages\s+deploy|deploy\s+production|\bsleep\b/u);
  assert.match(workflow, /name: ariada-wiki-canary-evidence-\$\{\{ steps\.resolve\.outputs\.release-sha \}\}/u);
  assert.match(workflow, /ARIADA_WIKI_RELEASE_MANIFEST_SHA256/u);
  assert.match(workflow, /ARIADA_WIKI_RELEASE_CONTENT_SET_SHA256/u);
  assert.match(workflow, /ARIADA_WIKI_CANARY_ARTIFACT_ID/u);
  assert.match(workflow, /ARIADA_WIKI_MONITOR_ARTIFACT_ID/u);
  assert.match(workflow, /--canary-artifact-id "\$CANARY_ARTIFACT_ID"/u);
  assert.match(workflow, /--monitor-artifact-id "\$MONITOR_ARTIFACT_ID"/u);
  const promotionJob = workflow.slice(workflow.indexOf("  promotion-gate:"));
  assert.doesNotMatch(promotionJob, /uses: actions\/download-artifact@/u);
  assert.equal([...promotionJob.matchAll(/node ci\/wiki-rc-gate\.mjs download-artifact/gu)].length, 2);
  assert.match(promotionJob, /--artifact-id "\$ARTIFACT_ID"[\s\S]*--output \.wiki-rc\/canary-evidence\.zip/u);
  assert.match(promotionJob, /--artifact-id "\$ARTIFACT_ID"[\s\S]*--output \.wiki-rc\/monitor-evidence\.zip/u);
  assert.match(promotionJob, /--canary-archive \.wiki-rc\/canary-evidence\.zip/u);
  assert.match(promotionJob, /--monitor-archive \.wiki-rc\/monitor-evidence\.zip/u);
  assert.match(gateSource, /verifyArtifactArchiveDigest[\s\S]*decodeExactZip/u);
  const promotionResolver = gateSource.slice(
    gateSource.indexOf("async function resolvePromotionCommand"),
    gateSource.indexOf("async function promotionGateCommand"),
  );
  assert.match(promotionResolver, /resolveTrustedArtifactById/u);
  assert.doesNotMatch(promotionResolver, /resolveTrustedArtifact\(client/u);
  assert.doesNotMatch(promotionResolver, /actions\/artifacts\?/u);
  assert.equal([...workflow.matchAll(/pnpm --filter ariada-wiki test\s+pnpm --filter ariada-wiki build\s+pnpm --filter ariada-wiki check/gu)].length, 2);
  assert.equal([...workflow.matchAll(/pnpm --filter ariada-org test:contracts\s+pnpm --filter ariada-org build/gu)].length, 1);
  const packageStart = workflow.indexOf("- name: Create deterministic immutable release artifact");
  const manifestGeneration = workflow.indexOf("node ci/wiki-rc-content-manifest.mjs generate", packageStart);
  const tarCreation = workflow.indexOf("tar --format=ustar", packageStart);
  assert.ok(packageStart >= 0 && manifestGeneration > packageStart && tarCreation > manifestGeneration, "release manifest must be generated before the final tar");
  assert.doesNotMatch(workflow, /\.wiki-rc\/ariada-release\.json|node --input-type=module <<'NODE'/u);
  for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)) {
    assert.match(match[1], /@[0-9a-f]{40}$/u, `action is not commit-pinned: ${match[1]}`);
  }
});

test("workflow omits the known-red companion check and preserves executable RC gates", async () => {
  const workflow = await readFile(resolve(ROOT, ".github/workflows/ariada-wiki-rc.yml"), "utf8");
  assert.doesNotMatch(workflow, /(?:^|\n)\s*pnpm --filter ariada-org check(?:\s|$)/u);
  assert.equal([...workflow.matchAll(/pnpm install --frozen-lockfile/gu)].length, 3);
  assert.match(
    workflow,
    /node --test\s+ci\/wiki-rc-content-manifest\.test\.mjs\s+ci\/wiki-rc-gate\.test\.mjs\s+ci\/wiki-rc-monitor\.test\.mjs\s+ci\/wiki-rc-monitor-aggregate\.test\.mjs/u,
  );
  assert.equal([...workflow.matchAll(/pnpm --filter ariada-wiki test\s+pnpm --filter ariada-wiki build\s+pnpm --filter ariada-wiki check/gu)].length, 2);
  assert.equal([...workflow.matchAll(/pnpm --filter ariada-org test:contracts\s+pnpm --filter ariada-org build/gu)].length, 1);
});

test("canary upload ZIP contains exact evidence and release-manifest root entries", async () => {
  const workflow = await readFile(resolve(ROOT, ".github/workflows/ariada-wiki-rc.yml"), "utf8");
  const outputMatch = /node ci\/wiki-rc-gate\.mjs verify-canary[\s\S]*?--output ([^\s\\]+)/u.exec(workflow);
  const uploadMatch = /- name: Upload trusted canary evidence[\s\S]*?\n\s+path: \|\n((?:\s{12}\.wiki-rc\/[^\n]+\n)+)/u.exec(workflow);
  const promotionMatch = /node ci\/wiki-rc-gate\.mjs promotion-gate[\s\S]*?--canary-archive ([^\s\\]+)/u.exec(workflow);
  const monitorPromotionMatch = /node ci\/wiki-rc-gate\.mjs promotion-gate[\s\S]*?--monitor-archive ([^\s\\]+)/u.exec(workflow);
  assert.ok(outputMatch, "verify-canary output path is missing");
  assert.ok(uploadMatch, "canary upload path is missing");
  assert.ok(promotionMatch, "promotion raw canary archive path is missing");
  assert.ok(monitorPromotionMatch, "promotion raw monitor archive path is missing");
  const producerPath = ".wiki-rc/canary-evidence.json";
  const manifestPath = ".wiki-rc/release-manifest.json";
  const uploadedPaths = uploadMatch[1].trim().split(/\s+/u);
  assert.equal(outputMatch[1], producerPath);
  assert.deepEqual(uploadedPaths, [producerPath, manifestPath]);
  assert.equal(promotionMatch[1], ".wiki-rc/canary-evidence.zip");
  assert.equal(monitorPromotionMatch[1], ".wiki-rc/monitor-evidence.zip");
  const fixture = validFixture();
  const archive = storedZip(uploadedPaths.map((path) => ({
    name: basename(path),
    contents: path === producerPath ? `${JSON.stringify(fixture.canaryEvidence)}\n` : RELEASE_MANIFEST_BYTES,
  })));
  assert.deepEqual(zipRootEntries(archive), ["canary-evidence.json", "release-manifest.json"]);
  const identity = validateRcIdentity({
    releaseSha: RELEASE_SHA,
    artifactDigest: TAR_SHA,
    manifestSha256: RELEASE_MANIFEST_SHA,
    contentSetSha256: CONTENT_SET_SHA,
    url: CANARY_URL,
    deploymentId: DEPLOYMENT_ID,
  }, { workflowHeadSha: RELEASE_SHA });
  const decoded = decodeCanaryArchive(archive, `sha256:${sha256Hex(archive)}`, identity);
  assert.deepEqual(decoded.evidence, fixture.canaryEvidence);
  assert.deepEqual(decoded.releaseManifestBytes, RELEASE_MANIFEST_BYTES);
  assert.doesNotMatch(workflow, /(?:^|\/)canary\.json(?:\s|\\|$)/mu);
});

test("release documentation describes post-merge identities and current components", async () => {
  const docs = await readFile(resolve(ROOT, "docs/releases/ARIADA-WIKI-RC.md"), "utf8");
  assert.match(docs, /apps\/ariada-wiki/u);
  assert.match(docs, /apps\/ariada-org[\s\S]*companion/u);
  assert.match(docs, /merge_commit_sha/u);
  assert.match(docs, /releaseSha/u);
  assert.match(docs, /final PR head/u);
  assert.match(docs, /GitHub deployment creator/u);
  assert.match(docs, /Cloudflare deployment actor/u);
  assert.match(docs, /172800/u);
  assert.match(docs, /ariada-wiki-promotion-approval/u);
  assert.match(docs, /ARIADA_WIKI_RELEASE_MANIFEST_SHA256/u);
  assert.match(docs, /ARIADA_WIKI_RELEASE_CONTENT_SET_SHA256/u);
  assert.match(docs, /ARIADA_WIKI_CANARY_ARTIFACT_ID/u);
  assert.match(docs, /ARIADA_WIKI_MONITOR_ARTIFACT_ID/u);
  assert.match(docs, /ariada-wiki-canary-evidence-<releaseSha>/u);
  assert.match(docs, /ariada-wiki-monitor-evidence-<releaseSha>/u);
  assert.doesNotMatch(docs, /CANARY_URL secret/u);
});
