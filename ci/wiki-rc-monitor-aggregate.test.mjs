import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  PROBE_PATHS,
  canonicalUrlForPath,
  computeContentSetSha256,
  fiveMinuteBucket,
  runMonitor,
  validateRcIdentity,
} from "./wiki-rc-monitor.mjs";
import {
  MIN_DISPATCH_PERCENT,
  TRUSTED_MONITOR_WORKFLOW_PATH,
  artifactObservationBucket,
  buildMonitorAggregate,
  canaryArtifactName,
  decodeCanaryArchive,
  decodeSampleArchive,
  githubArtifactArchive,
  monitorEvidenceArtifactName,
  monitorSampleArtifactName,
  paginateGithub,
  selectScheduleFallbackRunIds,
  validateArtifactMetadata,
  validateWorkflowRun,
} from "./wiki-rc-monitor-aggregate.mjs";

const RELEASE_SHA = "1".repeat(40);
const FINAL_TAR_SHA = "2".repeat(64);
const DEPLOYMENT_ID = "a1b2c3d4";
const ORIGIN = `https://${DEPLOYMENT_ID}.ariada-wiki.pages.dev`;
const REPOSITORY = "agonist/ariada-wiki";
const DISPATCH_ACTOR = "senko[bot]";
const SCHEDULE_ACTOR = "github-actions[bot]";
const SAMPLE_ARTIFACT_NAME = monitorSampleArtifactName(RELEASE_SHA);
const CANARY_STARTED_MS = Date.parse("2026-07-12T12:00:00.000Z");
const BUCKET_COUNT = 577;
const FINAL_MS = CANARY_STARTED_MS + 48 * 60 * 60 * 1000;
const NOW = new Date(FINAL_MS + 60_000).toISOString();

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixtureData() {
  const bodies = new Map();
  const files = Array.from({ length: 576 }, (_, index) => {
    const path = `assets/file-${String(index).padStart(4, "0")}.bin`;
    const body = Buffer.from(`public-wiki-byte-sequence-${index}\n`);
    bodies.set(path, body);
    return {
      path,
      url: canonicalUrlForPath(path),
      sha256: digest(body),
      bytes: body.length,
    };
  });
  const manifest = {
    schemaVersion: 1,
    kind: "ariada-wiki-release",
    releaseSha: RELEASE_SHA,
    generatedAt: "2026-07-12T11:55:00.000Z",
    contentSetSha256: computeContentSetSha256(files),
    files,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const identity = validateRcIdentity({
    releaseSha: RELEASE_SHA,
    artifactDigest: FINAL_TAR_SHA,
    manifestSha256: digest(manifestBytes),
    contentSetSha256: manifest.contentSetSha256,
    url: ORIGIN,
    deploymentId: DEPLOYMENT_ID,
  }, { workflowHeadSha: RELEASE_SHA });
  return { bodies, files, identity, manifest, manifestBytes };
}

const DATA = fixtureData();

function fakeFetch(input) {
  const url = new URL(String(input));
  if (url.pathname === "/.well-known/ariada-release.json") {
    return Promise.resolve(new Response(DATA.manifestBytes, {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  }
  const file = DATA.files.find((entry) => entry.url === url.pathname);
  if (file) return Promise.resolve(new Response(DATA.bodies.get(file.path), { status: 200 }));
  if (PROBE_PATHS.includes(url.pathname)) return Promise.resolve(new Response("ok", { status: 200 }));
  return Promise.resolve(new Response("missing", { status: 404 }));
}

const samplePromises = new Map();
function sampleAt(milliseconds) {
  const observedAt = new Date(milliseconds).toISOString();
  if (!samplePromises.has(observedAt)) {
    samplePromises.set(observedAt, runMonitor({
      identity: DATA.identity,
      fetchImpl: fakeFetch,
      now: () => new Date(observedAt),
    }));
  }
  return samplePromises.get(observedAt).then((sample) => structuredClone(sample));
}

function apiDigest(label) {
  return `sha256:${digest(Buffer.from(label))}`;
}

function makeRun({ id, event, observedMs, current = false, actor }) {
  const login = actor ?? (event === "workflow_dispatch" ? DISPATCH_ACTOR : SCHEDULE_ACTOR);
  return {
    id,
    name: "Ariada Wiki RC monitor",
    workflow_id: 424242,
    event,
    status: current ? "in_progress" : "completed",
    conclusion: current ? null : "success",
    path: TRUSTED_MONITOR_WORKFLOW_PATH,
    head_branch: "main",
    head_sha: RELEASE_SHA,
    actor: { login },
    triggering_actor: { login },
    created_at: new Date(observedMs - 30_000).toISOString(),
    updated_at: new Date(observedMs + (current ? 60_000 : 30_000)).toISOString(),
    repository: { id: 101, full_name: REPOSITORY },
    head_repository: { id: 101, full_name: REPOSITORY },
  };
}

function makeArtifact(run) {
  return {
    id: run.id + 1_000_000,
    name: SAMPLE_ARTIFACT_NAME,
    size_in_bytes: 12_000,
    expired: false,
    digest: apiDigest(`artifact-${run.id}`),
    created_at: run.updated_at,
    updated_at: run.updated_at,
    workflow_run: {
      id: run.id,
      repository_id: 101,
      head_repository_id: 101,
      head_branch: run.head_branch,
      head_sha: run.head_sha,
    },
  };
}

function makeCanary() {
  return {
    releaseSha: RELEASE_SHA,
    finalTarSha256: FINAL_TAR_SHA,
    manifestSha256: DATA.identity.manifestSha256,
    contentSetSha256: DATA.identity.contentSetSha256,
    deploymentId: DEPLOYMENT_ID,
    hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    repository: REPOSITORY,
    workflowPath: ".github/workflows/ariada-wiki-rc.yml",
    workflowHeadSha: RELEASE_SHA,
    headBranch: "main",
    event: "workflow_dispatch",
    actor: "release-manager",
    triggeringActor: "release-manager",
    runId: 9000,
    artifactId: 9001,
    artifactName: canaryArtifactName(RELEASE_SHA),
    artifactApiDigest: apiDigest("canary-archive"),
    startedAt: new Date(CANARY_STARTED_MS).toISOString(),
    verifiedAt: new Date(CANARY_STARTED_MS + 60_000).toISOString(),
  };
}

async function buildFixture({
  dispatchBuckets = new Set(Array.from({ length: BUCKET_COUNT }, (_, index) => index)),
  scheduleBuckets = new Set(),
  fullConcurrentSchedule = false,
} = {}) {
  const runs = [];
  const artifacts = [];
  const sampleRecords = [];
  let id = 10_000;
  let currentRunId;

  for (let index = 0; index < BUCKET_COUNT; index += 1) {
    const observedMs = CANARY_STARTED_MS + index * 300_000;
    const sample = await sampleAt(observedMs);
    if (dispatchBuckets.has(index)) {
      const current = index === BUCKET_COUNT - 1;
      const run = makeRun({ id: id++, event: "workflow_dispatch", observedMs, current });
      const artifact = makeArtifact(run);
      runs.push(run);
      artifacts.push(artifact);
      sampleRecords.push({
        runId: run.id,
        artifactId: artifact.id,
        artifactApiDigest: artifact.digest,
        sample: structuredClone(sample),
      });
      if (current) currentRunId = run.id;
    }
    if (fullConcurrentSchedule || scheduleBuckets.has(index)) {
      const run = makeRun({ id: id++, event: "schedule", observedMs });
      const artifact = makeArtifact(run);
      runs.push(run);
      artifacts.push(artifact);
      sampleRecords.push({
        runId: run.id,
        artifactId: artifact.id,
        artifactApiDigest: artifact.digest,
        sample: structuredClone(sample),
      });
    }
  }

  if (!currentRunId) {
    const observedMs = FINAL_MS;
    const sample = await sampleAt(observedMs);
    const run = makeRun({ id: id++, event: "workflow_dispatch", observedMs, current: true });
    const artifact = makeArtifact(run);
    runs.push(run);
    artifacts.push(artifact);
    sampleRecords.push({ runId: run.id, artifactId: artifact.id, artifactApiDigest: artifact.digest, sample });
    currentRunId = run.id;
  }

  return {
    identity: DATA.identity,
    canonicalManifest: DATA.manifest,
    canary: makeCanary(),
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId,
    runs,
    artifacts,
    sampleRecords,
    now: NOW,
  };
}

function build(input) {
  return buildMonitorAggregate(input);
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, value] of entries) {
    const nameBytes = Buffer.from(name);
    const bytes = Buffer.from(value);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBytes, bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBytes);
    offset += local.length + nameBytes.length + bytes.length;
  }
  const locals = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(locals.length, 16);
  return Buffer.concat([locals, centralDirectory, eocd]);
}

function streamingResponse(chunks, {
  status = 200,
  headers = {},
  onCancel = () => {},
} = {}) {
  let index = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(new Uint8Array(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
    cancel(reason) {
      onCancel(reason);
    },
  }), { status, headers });
}

function requestHeader(call, name) {
  return new Headers(call.options.headers).get(name);
}

test("bounded artifact download accepts a complete stream without Content-Length", async () => {
  const expected = Buffer.from("bounded artifact bytes");
  const received = await githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 12345,
    token: "test-token",
    maxBytes: 1024,
    fetchImpl: async (url, options) => {
      assert.equal(url, `https://api.github.com/repos/agonist/ariada-wiki/actions/artifacts/12345/zip`);
      assert.equal(options.redirect, "manual");
      assert.equal(requestHeader({ options }, "range"), null);
      return streamingResponse([expected.subarray(0, 7), expected.subarray(7)]);
    },
  });
  assert.deepEqual(received, expected);
});

test("bounded artifact download rejects lying Content-Length values", async () => {
  for (const declaredLength of [2, 8]) {
    await assert.rejects(() => githubArtifactArchive({
      repository: REPOSITORY,
      artifactId: 12345,
      token: "test-token",
      maxBytes: 1024,
      fetchImpl: async () => streamingResponse([Buffer.from("abc")], {
        headers: { "content-length": String(declaredLength) },
      }),
    }), /Content-Length|declared.*bound/i);
  }
});

test("bounded artifact download requires exact HTTP 200 and rejects Content-Range", async () => {
  for (const status of [201, 206]) {
    await assert.rejects(() => githubArtifactArchive({
      repository: REPOSITORY,
      artifactId: 12345,
      token: "test-token",
      maxBytes: 1024,
      fetchImpl: async () => streamingResponse([Buffer.from("abc")], { status }),
    }), /must end with HTTP 200/i);
  }
  await assert.rejects(() => githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 12345,
    token: "test-token",
    maxBytes: 1024,
    fetchImpl: async () => streamingResponse([Buffer.from("abc")], {
      headers: { "content-range": "bytes 0-2/3" },
    }),
  }), /Content-Range/i);
});

test("artifact redirect is HTTPS-only, manual, single-hop, and strips authorization", async () => {
  const expected = Buffer.from("redirected archive");
  const calls = [];
  const received = await githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 67890,
    token: "test-token",
    maxBytes: 1024,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://objects.example.test/signed/archive.zip" },
        });
      }
      return streamingResponse([expected], {
        headers: { "content-length": String(expected.length) },
      });
    },
  });
  assert.deepEqual(received, expected);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal(calls[1].options.redirect, "manual");
  assert.equal(requestHeader(calls[0], "authorization"), "Bearer test-token");
  assert.equal(requestHeader(calls[1], "authorization"), null);
  assert.equal(requestHeader(calls[0], "range"), null);
  assert.equal(requestHeader(calls[1], "range"), null);

  await assert.rejects(() => githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 67890,
    token: "test-token",
    maxBytes: 1024,
    fetchImpl: async () => new Response(null, {
      status: 302,
      headers: { location: "http://objects.example.test/archive.zip" },
    }),
  }), /HTTPS/i);

  let redirectCalls = 0;
  await assert.rejects(() => githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 67890,
    token: "test-token",
    maxBytes: 1024,
    fetchImpl: async () => {
      redirectCalls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: `https://objects.example.test/hop-${redirectCalls}` },
      });
    },
  }), /must end with HTTP 200/i);
  assert.equal(redirectCalls, 2);
});

test("overflowing artifact stream is cancelled and no partial bytes are returned", async () => {
  let cancelled = false;
  const chunks = [Buffer.from("1234"), Buffer.from("5678")];
  let chunkIndex = 0;
  await assert.rejects(() => githubArtifactArchive({
    repository: REPOSITORY,
    artifactId: 12345,
    token: "test-token",
    maxBytes: 5,
    fetchImpl: async () => new Response(new ReadableStream({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(new Uint8Array(chunks[chunkIndex]));
          chunkIndex += 1;
        }
      },
      cancel() {
        cancelled = true;
      },
    })),
  }), /size bound|configured size|stream failed/i);
  assert.equal(cancelled, true);
});

test("archive digest is verified before ZIP parsing and matching archive succeeds", () => {
  const archive = storedZip([["sample.json", JSON.stringify({ healthy: true })]]);
  assert.deepEqual(decodeSampleArchive(archive, `sha256:${digest(archive)}`), { healthy: true });
  assert.throws(
    () => decodeSampleArchive(Buffer.from("not a zip archive"), apiDigest("different bytes")),
    /API digest|does not match/i,
  );
});

test("real GitHub workflow-run API path is plain and ref trust is separate", () => {
  const run = makeRun({ id: 123, event: "workflow_dispatch", observedMs: CANARY_STARTED_MS });
  assert.equal(validateWorkflowRun(run, {
    identity: DATA.identity,
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId: 999,
  }).workflowPath, TRUSTED_MONITOR_WORKFLOW_PATH);

  assert.throws(() => validateWorkflowRun({ ...run, path: `${TRUSTED_MONITOR_WORKFLOW_PATH}@main` }, {
    identity: DATA.identity,
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId: 999,
  }), /path.*exactly|must not contain/i);
  assert.throws(() => validateWorkflowRun({ ...run, head_branch: "release" }, {
    identity: DATA.identity,
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId: 999,
  }), /main/i);
});

test("release artifacts have immutable SHA-qualified names and exact API provenance", () => {
  const run = makeRun({ id: 124, event: "workflow_dispatch", observedMs: CANARY_STARTED_MS });
  const normalizedRun = validateWorkflowRun(run, {
    identity: DATA.identity,
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId: 999,
  });
  const artifact = makeArtifact(run);
  assert.equal(SAMPLE_ARTIFACT_NAME, `ariada-wiki-monitor-sample-${RELEASE_SHA}`);
  assert.equal(canaryArtifactName(RELEASE_SHA), `ariada-wiki-canary-evidence-${RELEASE_SHA}`);
  assert.equal(monitorEvidenceArtifactName(RELEASE_SHA), `ariada-wiki-monitor-evidence-${RELEASE_SHA}`);
  assert.equal(validateArtifactMetadata(artifact, normalizedRun).name, SAMPLE_ARTIFACT_NAME);
  assert.throws(
    () => validateArtifactMetadata({ ...artifact, name: "ariada-wiki-monitor-sample" }, normalizedRun),
    /name must be exactly/i,
  );
});

test("canonical canary archive binds exact manifest bytes, content set, and final tar", () => {
  const evidence = {
    schemaVersion: 1,
    kind: "ariada-wiki-canary-evidence",
    releaseSha: RELEASE_SHA,
    finalTarSha256: FINAL_TAR_SHA,
    releaseManifestSha256: DATA.identity.manifestSha256,
    contentSetSha256: DATA.identity.contentSetSha256,
    deploymentId: DEPLOYMENT_ID,
    hostname: `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`,
    startedAt: new Date(CANARY_STARTED_MS).toISOString(),
    verifiedAt: new Date(CANARY_STARTED_MS + 60_000).toISOString(),
  };
  const archive = storedZip([
    ["canary-evidence.json", JSON.stringify(evidence)],
    ["release-manifest.json", DATA.manifestBytes],
  ]);
  const decoded = decodeCanaryArchive(archive, `sha256:${digest(archive)}`, DATA.identity);
  assert.deepEqual(decoded.manifest, DATA.manifest);

  const tamperedArchive = storedZip([
    ["canary-evidence.json", JSON.stringify(evidence)],
    ["release-manifest.json", Buffer.concat([DATA.manifestBytes, Buffer.from("\n")])],
  ]);
  assert.throws(
    () => decodeCanaryArchive(tamperedArchive, `sha256:${digest(tamperedArchive)}`, DATA.identity),
    /manifest.*SHA|bytes|digest/i,
  );
});

test("dispatch-only 48-hour soak succeeds with full canonical file coverage", async () => {
  const input = await buildFixture();
  const aggregate = build(input);
  assert.equal(aggregate.window.bucketCount, BUCKET_COUNT);
  assert.equal(aggregate.window.dispatchBucketCount, BUCKET_COUNT);
  assert.equal(aggregate.window.dispatchCoverageBasisPoints, 10_000);
  assert.equal(aggregate.artifactName, monitorEvidenceArtifactName(RELEASE_SHA));
  assert.equal(aggregate.coverage.requiredFileCount, 576);
  assert.equal(aggregate.coverage.coveredFileCount, 576);
  assert.equal(aggregate.samples.length, BUCKET_COUNT);
  assert.deepEqual(aggregate.samples.map((sample) => sample.observedAt),
    [...aggregate.samples.map((sample) => sample.observedAt)].sort());
});

test("dual stream has 1,154 real producers and deterministically selects dispatch", async () => {
  const input = await buildFixture({ fullConcurrentSchedule: true });
  assert.equal(input.artifacts.length, 1_154);
  assert.equal(input.sampleRecords.length, 1_154);
  const aggregate = build({
    ...input,
    runs: [...input.runs].reverse(),
    artifacts: [...input.artifacts].reverse(),
    sampleRecords: [...input.sampleRecords].reverse(),
  });
  assert.equal(aggregate.samples.length, BUCKET_COUNT);
  assert.ok(aggregate.samples.every((sample) => sample.event === "workflow_dispatch"));
  assert.equal(aggregate.producerRuns.length, 1_154);
  assert.ok(aggregate.producerRuns.some((producer) => producer.actor === SCHEDULE_ACTOR));
  assert.ok(aggregate.producerRuns.some((producer) => producer.triggeringActor === SCHEDULE_ACTOR));
  assert.equal(aggregate.producerRuns.filter((producer) => producer.selected && producer.event === "schedule").length, 0);
});

test("trusted schedule fills dropped dispatch buckets while dispatch remains at least 95%", async () => {
  const dropped = new Set([13, 57, 101, 211, 377, 499]);
  const dispatchBuckets = new Set(Array.from({ length: BUCKET_COUNT }, (_, index) => index)
    .filter((index) => !dropped.has(index)));
  const input = await buildFixture({ dispatchBuckets, fullConcurrentSchedule: true });
  const aggregate = build(input);
  assert.equal(aggregate.window.bucketCount, BUCKET_COUNT);
  assert.equal(aggregate.window.dispatchBucketCount, BUCKET_COUNT - dropped.size);
  assert.ok(aggregate.window.dispatchCoverageBasisPoints >= MIN_DISPATCH_PERCENT * 100);
  assert.deepEqual(
    aggregate.samples.filter((sample) => sample.event === "schedule").map((sample) => sample.bucket),
    [...dropped].map((index) => aggregate.samples[0].bucket + index),
  );
});

test("delayed schedule artifact fills its observation bucket, not its workflow creation bucket", async () => {
  const delayedIndex = 101;
  const dispatchBuckets = new Set(Array.from({ length: BUCKET_COUNT }, (_, index) => index)
    .filter((index) => index !== delayedIndex));
  const input = await buildFixture({
    dispatchBuckets,
    scheduleBuckets: new Set([delayedIndex]),
  });
  const rawRun = input.runs.find((run) => run.event === "schedule");
  const rawArtifact = input.artifacts.find((artifact) => artifact.workflow_run.id === rawRun.id);
  const normalizedRun = validateWorkflowRun(rawRun, {
    identity: DATA.identity,
    repository: REPOSITORY,
    defaultBranch: "main",
    dispatchActor: DISPATCH_ACTOR,
    currentRunId: input.currentRunId,
  });
  const normalizedArtifact = validateArtifactMetadata(rawArtifact, normalizedRun);
  const expectedBucket = input.sampleRecords.find((record) => record.runId === rawRun.id).sample.bucket;

  assert.equal(fiveMinuteBucket(rawRun.created_at), expectedBucket - 1);
  assert.equal(artifactObservationBucket(normalizedArtifact), expectedBucket);
  assert.deepEqual(selectScheduleFallbackRunIds({
    runs: [normalizedRun],
    artifactsByRun: new Map([[normalizedRun.id, normalizedArtifact]]),
    missingDispatchBuckets: new Set([expectedBucket]),
  }), [normalizedRun.id]);

  const aggregate = build(input);
  assert.equal(aggregate.samples[delayedIndex].event, "schedule");
  assert.equal(aggregate.samples[delayedIndex].bucket, expectedBucket);
});

test("schedule-only evidence fails and an untrusted dispatch cannot fill it", async () => {
  const onlyCurrentDispatch = new Set([BUCKET_COUNT - 1]);
  const scheduleBuckets = new Set(Array.from({ length: BUCKET_COUNT - 1 }, (_, index) => index));
  const scheduleOnly = await buildFixture({ dispatchBuckets: onlyCurrentDispatch, scheduleBuckets });
  assert.throws(() => build(scheduleOnly), /95%|Senko dispatch/i);

  const untrusted = await buildFixture();
  const historicalDispatch = untrusted.runs.find((run) => run.event === "workflow_dispatch" && run.id !== untrusted.currentRunId);
  historicalDispatch.actor.login = "untrusted-user";
  historicalDispatch.triggering_actor.login = "untrusted-user";
  assert.throws(() => build(untrusted), /dispatch actor is untrusted|triggering actor is untrusted/i);
});

test("content mismatch and missing manifest coverage are rejected", async () => {
  const mismatch = await buildFixture();
  const selected = mismatch.sampleRecords[120].sample.checkedFiles[0];
  selected.sha256 = "f".repeat(64);
  assert.throws(() => build(mismatch), /checked|SHA|canonical|manifest/i);

  const missing = await buildFixture();
  missing.sampleRecords[220].sample.checkedFiles = [];
  assert.throws(() => build(missing), /checkedFiles|shard|coverage|manifest file/i);
});

test("failed trusted runs, missing artifacts, and run-boundary provenance are fail-closed", async () => {
  const failed = await buildFixture();
  const historical = failed.runs.find((run) => run.id !== failed.currentRunId);
  historical.conclusion = "failure";
  assert.throws(() => build(failed), /failed sample|concluded failure/i);

  const missingArtifact = await buildFixture();
  missingArtifact.artifacts.pop();
  assert.throws(() => build(missingArtifact), /no exact-name sample artifact/i);

  const boundary = await buildFixture({ fullConcurrentSchedule: true });
  const schedule = boundary.runs.find((run) => run.event === "schedule");
  schedule.updated_at = new Date(Date.parse(schedule.created_at) + 1_000).toISOString();
  assert.throws(() => build(boundary), /outside its workflow run boundary/i);
});

test("exact-name artifact pagination passes 1,000 and collects more than 1,152", async () => {
  const total = 1_153;
  const all = Array.from({ length: total }, (_, index) => ({ id: index + 1, name: SAMPLE_ARTIFACT_NAME }));
  const requested = [];
  const values = await paginateGithub({
    requestJson: async (url) => {
      const parsed = new URL(url);
      requested.push(parsed);
      const page = Number(parsed.searchParams.get("page"));
      return { artifacts: all.slice((page - 1) * 100, page * 100) };
    },
    pathname: `/repos/${REPOSITORY}/actions/artifacts`,
    parameters: { name: SAMPLE_ARTIFACT_NAME },
    arrayField: "artifacts",
    maxPages: 20,
  });
  assert.equal(values.length, total);
  assert.equal(requested.length, 12);
  assert.ok(requested.every((url) => url.searchParams.get("per_page") === "100"));
  assert.ok(requested.every((url) => url.searchParams.get("name") === SAMPLE_ARTIFACT_NAME));
});

test("pagination remains bounded and fails closed on a runaway API traversal", async () => {
  let calls = 0;
  await assert.rejects(() => paginateGithub({
    requestJson: async () => {
      calls += 1;
      return { artifacts: Array.from({ length: 100 }, (_, index) => ({ id: calls * 100 + index })) };
    },
    pathname: `/repos/${REPOSITORY}/actions/artifacts`,
    arrayField: "artifacts",
    maxPages: 20,
  }), /20-page bound/i);
  assert.equal(calls, 20);
});
