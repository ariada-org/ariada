import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  PROBE_PATHS,
  canonicalUrlForPath,
  computeContentSetSha256,
  fiveMinuteBucket,
  runMonitor,
  selectFileShard,
  validateMonitorSample,
  validateRcIdentity,
  validateReleaseManifest,
  validateReleaseManifestBytes,
} from "./wiki-rc-monitor.mjs";

const RELEASE_SHA = "1".repeat(40);
const FINAL_TAR_SHA = "2".repeat(64);
const DEPLOYMENT_ID = "a1b2c3d4";
const ORIGIN = `https://${DEPLOYMENT_ID}.ariada-wiki.pages.dev`;
const GENERATED_AT = "2026-07-12T11:55:00.000Z";
const OBSERVED_AT = "2026-07-12T12:00:00.000Z";

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function releaseFixture(fileCount = 576) {
  const bodies = new Map();
  const files = Array.from({ length: fileCount }, (_, index) => {
    const path = `assets/file-${String(index).padStart(4, "0")}.bin`;
    const body = Buffer.from(`ariada-public-file-${index}\n`);
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
    generatedAt: GENERATED_AT,
    contentSetSha256: computeContentSetSha256(files),
    files,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const identityInput = {
    releaseSha: RELEASE_SHA,
    artifactDigest: FINAL_TAR_SHA,
    manifestSha256: digest(manifestBytes),
    contentSetSha256: manifest.contentSetSha256,
    url: ORIGIN,
    deploymentId: DEPLOYMENT_ID,
  };
  const identity = validateRcIdentity(identityInput, { workflowHeadSha: RELEASE_SHA });
  return { bodies, files, identity, identityInput, manifest, manifestBytes };
}

function monitorFetch(fixture, {
  manifestBytes = fixture.manifestBytes,
  failedProbe,
  corruptPath,
} = {}) {
  return async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/.well-known/ariada-release.json") {
      return new Response(manifestBytes, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (failedProbe === url.pathname) {
      return new Response("upstream failure", { status: 503 });
    }
    const file = fixture.files.find((entry) => entry.url === url.pathname);
    if (file) {
      const bytes = corruptPath === file.path ? Buffer.from("tampered") : fixture.bodies.get(file.path);
      return new Response(bytes, { status: 200 });
    }
    if (PROBE_PATHS.includes(url.pathname)) {
      return new Response(`ok:${url.pathname}`, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
}

async function healthySample(fixture = releaseFixture()) {
  const sample = await runMonitor({
    identity: fixture.identity,
    fetchImpl: monitorFetch(fixture),
    now: () => new Date(OBSERVED_AT),
  });
  return { fixture, sample };
}

test("validates immutable URL, deployment identity, workflow SHA, and exact hashes", () => {
  const fixture = releaseFixture(1);
  assert.equal(fixture.identity.hostname, `${DEPLOYMENT_ID}.ariada-wiki.pages.dev`);
  assert.equal(fixture.identity.workflowHeadSha, RELEASE_SHA);

  assert.throws(() => validateRcIdentity({
    ...fixture.identityInput,
    url: `${ORIGIN}/preview`,
  }, { workflowHeadSha: RELEASE_SHA }), /immutable|origin|URL|path/i);
  assert.throws(() => validateRcIdentity({
    ...fixture.identityInput,
    deploymentId: "deadbeef",
  }, { workflowHeadSha: RELEASE_SHA }), /deployment/i);
  assert.throws(() => validateRcIdentity({
    ...fixture.identityInput,
    releaseSha: RELEASE_SHA.toUpperCase().replaceAll("1", "A"),
  }, { workflowHeadSha: RELEASE_SHA }), /release|40/i);
  assert.throws(() => validateRcIdentity(fixture.identityInput, {
    workflowHeadSha: "3".repeat(40),
  }), /workflow/i);
});

test("strictly validates canonical manifest bytes, ordering, URLs, and content-set identity", () => {
  const fixture = releaseFixture(3);
  assert.deepEqual(
    validateReleaseManifestBytes(fixture.manifestBytes, fixture.identity).manifest,
    fixture.manifest,
  );

  const injected = { ...fixture.manifest, injected: true };
  assert.throws(() => validateReleaseManifest(injected, fixture.identity), /unexpected|fields/i);
  const unsorted = { ...fixture.manifest, files: [...fixture.files].reverse() };
  assert.throws(() => validateReleaseManifest(unsorted, fixture.identity), /sorted/i);
  const wrongUrl = structuredClone(fixture.manifest);
  wrongUrl.files[0].url = "/wrong";
  assert.throws(() => validateReleaseManifest(wrongUrl, fixture.identity), /canonical|URL/i);
  const alteredBytes = Buffer.from(`${fixture.manifestBytes.toString("utf8")}\n`);
  assert.throws(
    () => validateReleaseManifestBytes(alteredBytes, fixture.identity),
    /manifest.*SHA|bytes|digest/i,
  );
});

test("manifest byte mismatch is recorded as a failed sample", async () => {
  const fixture = releaseFixture();
  const altered = Buffer.from(`${fixture.manifestBytes.toString("utf8")}\n`);
  const sample = await runMonitor({
    identity: fixture.identity,
    fetchImpl: monitorFetch(fixture, { manifestBytes: altered }),
    now: () => new Date(OBSERVED_AT),
  });
  assert.equal(sample.status, "failed");
  assert.equal(sample.checkedFiles.length, 0);
  assert.match(JSON.stringify(sample.probes), /manifest|SHA|digest/i);
});

test("endpoint failure is retained without hiding successful probes", async () => {
  const fixture = releaseFixture();
  const sample = await runMonitor({
    identity: fixture.identity,
    fetchImpl: monitorFetch(fixture, { failedProbe: "/ru/modules/s1/" }),
    now: () => new Date(OBSERVED_AT),
  });
  assert.equal(sample.status, "failed");
  const failed = sample.probes.find((probe) => probe.path === "/ru/modules/s1/");
  assert.equal(failed.status, "failed");
  assert.equal(failed.httpStatus, 503);
  assert.ok(sample.probes.some((probe) => probe.status === "passed"));
});

test("deterministic UTC shard checks exact deployed file bytes", async () => {
  const fixture = releaseFixture();
  const bucket = fiveMinuteBucket(OBSERVED_AT);
  const expectedShard = selectFileShard(fixture.files, bucket);
  assert.equal(expectedShard.length, 1);

  const success = await runMonitor({
    identity: fixture.identity,
    fetchImpl: monitorFetch(fixture),
    now: () => new Date(OBSERVED_AT),
  });
  assert.equal(success.status, "passed");
  assert.equal(success.bucket, bucket);
  assert.deepEqual(success.checkedFiles.map((entry) => entry.path), expectedShard.map((entry) => entry.path));
  assert.equal(success.checkedFiles[0].sha256, expectedShard[0].sha256);
  assert.equal(success.checkedFiles[0].bytes, expectedShard[0].bytes);

  const mismatch = await runMonitor({
    identity: fixture.identity,
    fetchImpl: monitorFetch(fixture, { corruptPath: expectedShard[0].path }),
    now: () => new Date(OBSERVED_AT),
  });
  assert.equal(mismatch.status, "failed");
  assert.equal(mismatch.checkedFiles[0].status, "failed");
  assert.match(mismatch.checkedFiles[0].failure.message, /SHA|size|bytes/i);
});

test("strict sample schema rejects injection, stale evidence, and identity mismatch", async () => {
  const { fixture, sample } = await healthySample();
  assert.equal(validateMonitorSample(sample, {
    expectedIdentity: fixture.identity,
    manifest: fixture.manifest,
    notBefore: "2026-07-12T11:59:00.000Z",
    notAfter: "2026-07-12T12:01:00.000Z",
  }).status, "passed");

  assert.throws(() => validateMonitorSample({ ...sample, injected: true }, {
    expectedIdentity: fixture.identity,
    manifest: fixture.manifest,
  }), /unexpected|fields/i);
  assert.throws(() => validateMonitorSample(sample, {
    expectedIdentity: fixture.identity,
    manifest: fixture.manifest,
    notAfter: "2026-07-12T11:59:54.000Z",
  }), /postdates|stale|boundary/i);
  const mismatched = structuredClone(sample);
  mismatched.identity.deploymentId = "deadbeef";
  assert.throws(() => validateMonitorSample(mismatched, {
    expectedIdentity: fixture.identity,
    manifest: fixture.manifest,
  }), /deployment|identity/i);
});
