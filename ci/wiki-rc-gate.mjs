#!/usr/bin/env node

import { createHash } from "node:crypto";
import { appendFile, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { inflateRawSync } from "node:zlib";

import {
  MAX_RELEASE_MANIFEST_BYTES,
  parseContentReleaseManifestBytes,
  validateContentEntries,
  validateContentReleaseManifest,
  validateReleaseTarGzip,
} from "./wiki-rc-content-manifest.mjs";

export const MIN_CANARY_AGE_SECONDS = 172_800;
export const MAX_CANARY_AGE_SECONDS = 259_200;
export const MONITOR_CADENCE_SECONDS = 300;
export const MONITOR_MAX_GAP_SECONDS = 360;
export const MONITOR_FINAL_FRESHNESS_SECONDS = 600;
export const MONITOR_MIN_SAMPLES = 576;
export const TRUSTED_GATE_WORKFLOW_PATH = ".github/workflows/ariada-wiki-rc.yml";
export const TRUSTED_MONITOR_WORKFLOW_PATH = ".github/workflows/ariada-wiki-monitor.yml";
export const PRODUCTION_ENVIRONMENT = "ariada-wiki-production";
export const CANARY_ENVIRONMENT = "ariada-wiki-canary";
export const REQUIRED_PRODUCTION_REVIEWER = "predopta";
export const PRODUCTION_WAIT_TIMER_MINUTES = 2_880;
export const MIN_DISPATCH_COVERAGE_BASIS_POINTS = 9_500;

const BUILD_RESOLUTION_KIND = "ariada-wiki-build-resolution";
const CANARY_EVIDENCE_KIND = "ariada-wiki-canary-evidence";
const MONITOR_EVIDENCE_KIND = "ariada-wiki-monitor-evidence";
const PROMOTION_RESOLUTION_KIND = "ariada-wiki-promotion-resolution";
const API_VERSION = "2022-11-28";
const API_TIMEOUT_MS = 20_000;
const MAX_API_BODY_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_EVIDENCE_ENTRY_BYTES = 12 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 8;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const API_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ID_PATTERN = /^[1-9][0-9]*$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

export class GateError extends Error {
  constructor(message) {
    super(message);
    this.name = "GateError";
  }
}

function fail(message) {
  throw new GateError(message);
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
  if (typeof value !== "string" || value === "" || value !== value.trim()) {
    fail(`${label} must be a canonical non-empty string`);
  }
  return value;
}

function exact(value, expected, label) {
  if (value !== expected) fail(`${label} does not match trusted provenance`);
  return value;
}

function positiveId(value, label) {
  const parsed = canonicalString(String(value ?? ""), label);
  if (!ID_PATTERN.test(parsed)) fail(`${label} must be a positive integer identifier`);
  return parsed;
}

function sha(value, label) {
  const parsed = canonicalString(value, label);
  if (!SHA_PATTERN.test(parsed)) fail(`${label} must be a 40-character lowercase hexadecimal SHA`);
  return parsed;
}

function digest(value, label) {
  const parsed = canonicalString(value, label);
  if (!DIGEST_PATTERN.test(parsed)) fail(`${label} must be a 64-character lowercase hexadecimal digest`);
  return parsed;
}

function apiDigest(value, label) {
  const parsed = canonicalString(value, label);
  if (!API_DIGEST_PATTERN.test(parsed)) fail(`${label} must be a GitHub sha256: artifact digest`);
  return parsed;
}

function timestamp(value, label) {
  const parsed = canonicalString(value, label);
  const milliseconds = Date.parse(parsed);
  if (!ISO_PATTERN.test(parsed) || !Number.isFinite(milliseconds)) fail(`${label} must be an ISO-8601 UTC timestamp`);
  return { iso: new Date(milliseconds).toISOString(), milliseconds };
}

function evaluationTime(value) {
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === "string" ? Date.parse(value) : Number(value);
  if (!Number.isFinite(milliseconds)) fail("evaluation time is invalid");
  return milliseconds;
}

export function validateCanaryAge(startedAt, now = Date.now()) {
  const startedAtMs = timestamp(startedAt, "canary startedAt").milliseconds;
  const age = evaluationTime(now) - startedAtMs;
  if (age < MIN_CANARY_AGE_SECONDS * 1000) fail(`canary is younger than ${MIN_CANARY_AGE_SECONDS} seconds`);
  if (age > MAX_CANARY_AGE_SECONDS * 1000) fail("canary evidence exceeds the maximum soak age");
  return age;
}

function repositoryName(value) {
  const parsed = canonicalString(value, "repository");
  if (!REPOSITORY_PATTERN.test(parsed)) fail("repository must have owner/repository form");
  return parsed;
}

function actor(value, label) {
  const login = typeof value === "string" ? value : record(value, label).login;
  const parsed = canonicalString(login, `${label} login`);
  if (parsed.length > 100 || /\s/u.test(parsed)) fail(`${label} login is invalid`);
  return parsed;
}

function sameActor(left, right) {
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

function workflowPath(value) {
  return canonicalString(value, "workflow run path").split("@", 1)[0];
}

function workflowRunKeys() {
  return [
    "id",
    "workflowId",
    "path",
    "event",
    "status",
    "conclusion",
    "headSha",
    "headBranch",
    "repository",
    "headRepository",
    "actor",
    "triggeringActor",
    "createdAt",
    "updatedAt",
  ];
}

function artifactKeys() {
  return ["id", "name", "apiDigest", "runId", "headSha", "createdAt", "expiresAt", "sizeInBytes"];
}

export function buildArtifactName(releaseSha) {
  return `ariada-wiki-rc-${sha(releaseSha, "release SHA")}`;
}

export function canaryArtifactName(releaseSha, deploymentId) {
  const normalizedReleaseSha = sha(releaseSha, "release SHA");
  validateCloudflareCanaryUrl(`https://${canonicalString(deploymentId, "deployment ID")}.ariada-wiki.pages.dev`);
  return `ariada-wiki-canary-evidence-${normalizedReleaseSha}`;
}

export function monitorArtifactName(releaseSha, deploymentId) {
  const normalizedReleaseSha = sha(releaseSha, "release SHA");
  validateCloudflareCanaryUrl(`https://${canonicalString(deploymentId, "deployment ID")}.ariada-wiki.pages.dev`);
  return `ariada-wiki-monitor-evidence-${normalizedReleaseSha}`;
}

export function validateCloudflareCanaryUrl(value) {
  const raw = canonicalString(value, "canary URL");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    fail("canary URL is invalid");
  }
  if (parsed.protocol !== "https:") fail("canary URL must use HTTPS");
  if (parsed.username !== "" || parsed.password !== "") fail("canary URL must not contain credentials");
  if (parsed.port !== "") fail("canary URL must not contain a port");
  if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
    fail("canary URL must be a bare canonical origin");
  }
  if (raw !== parsed.origin && raw !== `${parsed.origin}/`) fail("canary URL must use the strict canonical origin form");
  const match = /^([0-9a-f]{8})\.ariada-wiki\.pages\.dev$/u.exec(parsed.hostname);
  if (match === null) fail("canary URL must be an immutable Ariada Wiki Cloudflare Pages deployment host");
  return {
    raw,
    origin: parsed.origin,
    hostname: parsed.hostname,
    deploymentId: match[1],
  };
}

export function requireUniqueCandidate(values, label) {
  if (!Array.isArray(values) || values.length === 0) fail(`${label} is absent`);
  if (values.length !== 1) fail(`${label} is ambiguous`);
  return values[0];
}

export function validateWorkflowRun(value, context) {
  const run = record(value, "workflow run");
  const normalized = {
    id: positiveId(run.id, "workflow run id"),
    workflowId: positiveId(run.workflow_id, "workflow run workflow_id"),
    path: workflowPath(run.path),
    event: canonicalString(run.event, "workflow run event"),
    status: canonicalString(run.status, "workflow run status"),
    conclusion: run.conclusion,
    headSha: sha(run.head_sha, "workflow run head_sha"),
    headBranch: canonicalString(run.head_branch, "workflow run head_branch"),
    repository: canonicalString(record(run.repository, "workflow run repository").full_name, "workflow repository"),
    headRepository: canonicalString(record(run.head_repository, "workflow run head repository").full_name, "workflow head repository"),
    actor: actor(run.actor, "workflow actor"),
    triggeringActor: actor(run.triggering_actor, "workflow triggering actor"),
    createdAt: timestamp(run.created_at, "workflow run created_at").iso,
    updatedAt: timestamp(run.updated_at, "workflow run updated_at").iso,
  };
  exact(normalized.workflowId, positiveId(context.workflowId, "trusted workflow id"), "workflow id");
  exact(normalized.path, context.path, "workflow path");
  exact(normalized.event, context.event, "workflow event");
  exact(normalized.headSha, context.releaseSha, "workflow head SHA");
  exact(normalized.headBranch, context.defaultBranch, "workflow head branch");
  exact(normalized.repository, context.repository, "workflow repository");
  exact(normalized.headRepository, context.repository, "workflow head repository");
  exact(normalized.status, context.status, "workflow status");
  exact(normalized.conclusion, context.conclusion, "workflow conclusion");
  return normalized;
}

function validateNormalizedRun(value, context) {
  const run = exactKeys(value, workflowRunKeys(), `${context.label} workflow`);
  exact(positiveId(run.id, `${context.label} workflow id`), String(run.id), `${context.label} workflow id form`);
  positiveId(run.workflowId, `${context.label} workflow definition id`);
  exact(run.path, context.path, `${context.label} workflow path`);
  exact(run.event, context.event, `${context.label} workflow event`);
  exact(run.status, context.status, `${context.label} workflow status`);
  exact(run.conclusion, context.conclusion, `${context.label} workflow conclusion`);
  exact(sha(run.headSha, `${context.label} workflow head SHA`), context.releaseSha, `${context.label} workflow head SHA`);
  exact(run.headBranch, context.defaultBranch, `${context.label} workflow head branch`);
  exact(run.repository, context.repository, `${context.label} workflow repository`);
  exact(run.headRepository, context.repository, `${context.label} workflow head repository`);
  actor(run.actor, `${context.label} workflow actor`);
  actor(run.triggeringActor, `${context.label} workflow triggering actor`);
  timestamp(run.createdAt, `${context.label} workflow createdAt`);
  timestamp(run.updatedAt, `${context.label} workflow updatedAt`);
  return run;
}

export function validateArtifactMetadata(value, context) {
  const artifact = record(value, "artifact metadata");
  const source = record(artifact.workflow_run, "artifact workflow_run");
  const createdAt = timestamp(artifact.created_at, "artifact created_at");
  const expiresAt = timestamp(artifact.expires_at, "artifact expires_at");
  const resolvedAtMs = evaluationTime(context.resolutionTime);
  const normalized = {
    id: positiveId(artifact.id, "artifact id"),
    name: canonicalString(artifact.name, "artifact name"),
    apiDigest: apiDigest(artifact.digest, "artifact digest"),
    runId: positiveId(source.id, "artifact workflow run id"),
    headSha: sha(source.head_sha, "artifact workflow run head SHA"),
    createdAt: createdAt.iso,
    expiresAt: expiresAt.iso,
    sizeInBytes: artifact.size_in_bytes,
  };
  exact(normalized.name, context.name, "artifact name");
  exact(artifact.expired, false, "artifact expired state");
  exact(normalized.runId, context.run.id, "artifact workflow run id");
  exact(normalized.headSha, context.run.headSha, "artifact workflow run head SHA");
  if (expiresAt.milliseconds <= createdAt.milliseconds) fail("artifact expires_at contradicts artifact created_at");
  if (createdAt.milliseconds > resolvedAtMs) fail("artifact created_at is later than resolution time");
  if (expiresAt.milliseconds <= resolvedAtMs) fail("artifact expires_at must be strictly later than resolution time");
  if (!Number.isSafeInteger(normalized.sizeInBytes) || normalized.sizeInBytes < 1) fail("artifact size is absent");
  return normalized;
}

function validateNormalizedArtifact(value, context) {
  const artifact = exactKeys(value, artifactKeys(), `${context.label} artifact`);
  const createdAt = timestamp(artifact.createdAt, `${context.label} artifact createdAt`);
  const expiresAt = timestamp(artifact.expiresAt, `${context.label} artifact expiresAt`);
  const resolvedAtMs = evaluationTime(context.resolutionTime);
  positiveId(artifact.id, `${context.label} artifact id`);
  exact(artifact.name, context.name, `${context.label} artifact name`);
  apiDigest(artifact.apiDigest, `${context.label} artifact digest`);
  exact(positiveId(artifact.runId, `${context.label} artifact run id`), context.run.id, `${context.label} artifact run id`);
  exact(sha(artifact.headSha, `${context.label} artifact head SHA`), context.releaseSha, `${context.label} artifact head SHA`);
  if (expiresAt.milliseconds <= createdAt.milliseconds) fail(`${context.label} artifact expiresAt contradicts createdAt`);
  if (createdAt.milliseconds > resolvedAtMs) fail(`${context.label} artifact createdAt is later than resolution time`);
  if (expiresAt.milliseconds <= resolvedAtMs) fail(`${context.label} artifact expiresAt must be strictly later than resolution time`);
  if (!Number.isSafeInteger(artifact.sizeInBytes) || artifact.sizeInBytes < 1) fail(`${context.label} artifact size is absent`);
  return artifact;
}

export function validateMergedPullRequest(value, context) {
  const pull = record(value, "pull request");
  const head = record(pull.head, "pull request head");
  const base = record(pull.base, "pull request base");
  const normalized = {
    number: Number(pull.number),
    state: pull.state,
    merged: pull.merged,
    author: actor(pull.user, "pull request author"),
    headSha: sha(head.sha, "pull request final head SHA"),
    headRef: canonicalString(head.ref, "pull request head ref"),
    headRepository: canonicalString(record(head.repo, "pull request head repository").full_name, "pull request head repository"),
    baseSha: sha(base.sha, "pull request base SHA"),
    baseRef: canonicalString(base.ref, "pull request base ref"),
    baseRepository: canonicalString(record(base.repo, "pull request base repository").full_name, "pull request base repository"),
    mergeCommitSha: sha(pull.merge_commit_sha, "pull request merge commit SHA"),
    mergedAt: timestamp(pull.merged_at, "pull request merged_at").iso,
    mergedBy: actor(pull.merged_by, "pull request merger"),
  };
  if (!Number.isSafeInteger(normalized.number) || normalized.number < 1) fail("pull request number is invalid");
  exact(normalized.state, "closed", "pull request state");
  exact(normalized.merged, true, "pull request merged state");
  exact(pull.draft, false, "pull request draft state");
  exact(normalized.headRepository, context.repository, "pull request head repository");
  exact(normalized.baseRepository, context.repository, "pull request base repository");
  exact(normalized.baseRef, context.defaultBranch, "pull request base branch");
  exact(normalized.mergeCommitSha, context.currentMainSha, "pull request merge commit and current main SHA");
  return normalized;
}

export function validateFinalHeadApproval(reviews, pullRequest) {
  if (!Array.isArray(reviews) || reviews.length === 0) fail("pull request reviews are absent");
  const mergedAtMs = timestamp(pullRequest.mergedAt, "pull request mergedAt").milliseconds;
  const candidates = [];
  for (const review of reviews) {
    if (review?.state !== "APPROVED" || review?.commit_id !== pullRequest.headSha) continue;
    const reviewer = actor(review.user, "final-head approving reviewer");
    if (sameActor(reviewer, pullRequest.author)) fail("final-head approving reviewer must differ from the pull request author");
    const submitted = timestamp(review.submitted_at, "final-head approval submitted_at");
    if (submitted.milliseconds > mergedAtMs) fail("final-head approval cannot postdate the merge");
    candidates.push({
      id: positiveId(review.id, "final-head approval id"),
      actor: reviewer,
      commitSha: sha(review.commit_id, "final-head approval commit SHA"),
      submittedAt: submitted.iso,
    });
  }
  if (candidates.length === 0) fail("an approval bound to the final pull request head is required");
  candidates.sort((left, right) => {
    const byTime = Date.parse(right.submittedAt) - Date.parse(left.submittedAt);
    return byTime === 0 ? Number(right.id) - Number(left.id) : byTime;
  });
  return candidates[0];
}

function validateMergeCommit(value, context) {
  const commit = record(value, "merge commit");
  exact(sha(commit.sha, "merge commit SHA"), context.releaseSha, "merge commit SHA");
  if (!Array.isArray(commit.parents) || commit.parents.length === 0) fail("merge commit parents are absent");
  const parentShas = commit.parents.map((parent, index) => sha(record(parent, `merge commit parent ${index}`).sha, `merge commit parent ${index} SHA`));
  if (new Set(parentShas).size !== parentShas.length) fail("merge commit parents contain duplicates");
  if (parentShas.length > 1 && !parentShas.includes(context.finalHeadSha)) {
    fail("multi-parent merge commit is not related to the final pull request head");
  }
  return {
    sha: context.releaseSha,
    parentShas,
    author: commit.author === null ? null : actor(commit.author, "merge commit author"),
    committer: actor(commit.committer, "final code pusher"),
  };
}

function validateWorkflowDefinition(value, expectedPath) {
  const workflow = record(value, "workflow definition");
  exact(canonicalString(workflow.path, "workflow definition path"), expectedPath, "workflow definition path");
  exact(workflow.state, "active", "workflow definition state");
  return { id: positiveId(workflow.id, "workflow definition id"), path: expectedPath };
}

function archiveContentLength(response, label) {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  if (!/^[0-9]+$/u.test(value)) fail(`${label} Content-Length is not a valid nonnegative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(`${label} Content-Length is not a valid nonnegative integer`);
  if (parsed > MAX_EVIDENCE_ARCHIVE_BYTES) fail(`${label} Content-Length exceeds the size bound`);
  return parsed;
}

async function readBoundedArchiveBody(response, label) {
  if (response.body === null) fail(`${label} raw ZIP response body is absent`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail(`${label} raw ZIP response returned invalid bytes`);
      total += value.byteLength;
      if (total > MAX_EVIDENCE_ARCHIVE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The size violation remains authoritative if cancellation also fails.
        }
        fail(`${label} raw ZIP exceeds the streamed size bound`);
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (error instanceof GateError) throw error;
    fail(`${label} raw ZIP download failed while reading the response body`);
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

class GitHubClient {
  constructor({ repository, token, fetchImpl = fetch }) {
    this.repository = repositoryName(repository);
    this.token = canonicalString(token, "GitHub token");
    this.fetchImpl = fetchImpl;
  }

  async json(path, label) {
    let response;
    try {
      response = await this.fetchImpl(`https://api.github.com${path}`, {
        method: "GET",
        redirect: "error",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "user-agent": "ariada-wiki-rc-gate/2",
          "x-github-api-version": API_VERSION,
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
    } catch {
      fail(`${label} is unavailable from the GitHub API`);
    }
    if (!response.ok) fail(`${label} is unavailable from the GitHub API (HTTP ${response.status})`);
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_API_BODY_BYTES) fail(`${label} exceeds the GitHub API response bound`);
    try {
      return JSON.parse(text);
    } catch {
      fail(`${label} returned invalid GitHub API JSON`);
    }
  }

  async artifactArchive(artifactId, label) {
    let apiResponse;
    try {
      apiResponse = await this.fetchImpl(
        `https://api.github.com/repos/${this.repository}/actions/artifacts/${positiveId(artifactId, `${label} artifact id`)}/zip`,
        {
          method: "GET",
          redirect: "manual",
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${this.token}`,
            "user-agent": "ariada-wiki-rc-gate/2",
            "x-github-api-version": API_VERSION,
          },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        },
      );
    } catch {
      fail(`${label} raw ZIP is unavailable from the GitHub API`);
    }
    let archiveResponse = apiResponse;
    if ([301, 302, 303, 307, 308].includes(apiResponse.status)) {
      const location = apiResponse.headers.get("location");
      let archiveUrl;
      try {
        archiveUrl = new URL(canonicalString(location, `${label} archive redirect`));
      } catch {
        fail(`${label} raw ZIP returned an invalid redirect`);
      }
      if (archiveUrl.protocol !== "https:" || archiveUrl.username !== "" || archiveUrl.password !== "") {
        fail(`${label} raw ZIP returned an unsafe redirect`);
      }
      try {
        archiveResponse = await this.fetchImpl(archiveUrl, {
          method: "GET",
          redirect: "error",
          headers: { "user-agent": "ariada-wiki-rc-gate/2" },
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
        });
      } catch {
        fail(`${label} raw ZIP download failed`);
      }
    }
    if (archiveResponse.status !== 200) fail(`${label} raw ZIP download failed (HTTP ${archiveResponse.status})`);
    if (archiveResponse.headers.has("content-range")) fail(`${label} raw ZIP response must not contain Content-Range`);
    const advertisedLength = archiveContentLength(archiveResponse, label);
    const bytes = await readBoundedArchiveBody(archiveResponse, label);
    if (advertisedLength !== null && advertisedLength !== bytes.length) {
      fail(`${label} Content-Length does not match the received byte length`);
    }
    if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_ARCHIVE_BYTES) fail(`${label} raw ZIP is empty or exceeds the size bound`);
    return bytes;
  }
}

export async function downloadArtifactArchive({ repository, token, artifactId, fetchImpl = fetch }) {
  const client = new GitHubClient({ repository, token, fetchImpl });
  return client.artifactArchive(artifactId, "selected evidence artifact");
}

async function resolveWorkflow(client, path) {
  return validateWorkflowDefinition(
    await client.json(`/repos/${client.repository}/actions/workflows/${encodeURIComponent(basename(path))}`, `trusted workflow ${path}`),
    path,
  );
}

async function resolveTrustedArtifact(client, context) {
  const workflow = await resolveWorkflow(client, context.path);
  const root = record(
    await client.json(
      `/repos/${client.repository}/actions/artifacts?name=${encodeURIComponent(context.name)}&per_page=100`,
      `artifact list for ${context.name}`,
    ),
    `artifact list for ${context.name}`,
  );
  if (!Array.isArray(root.artifacts) || !Number.isSafeInteger(root.total_count)) fail("artifact list metadata is invalid");
  if (root.total_count !== root.artifacts.length) fail(`${context.label} artifact search exceeds one API page`);
  const artifactValue = requireUniqueCandidate(root.artifacts, `${context.label} artifact`);
  const runId = positiveId(record(artifactValue.workflow_run, `${context.label} artifact workflow_run`).id, `${context.label} run id`);
  const run = validateWorkflowRun(
    await client.json(`/repos/${client.repository}/actions/runs/${runId}`, `${context.label} workflow run`),
    {
      workflowId: workflow.id,
      path: context.path,
      event: context.event,
      releaseSha: context.releaseSha,
      defaultBranch: context.defaultBranch,
      repository: client.repository,
      status: "completed",
      conclusion: "success",
    },
  );
  const artifact = validateArtifactMetadata(artifactValue, {
    name: context.name,
    run,
    resolutionTime: context.resolutionTime,
  });
  return { workflow, run, artifact };
}

export function validateDistinctPromotionArtifactIds(canaryArtifactId, monitorArtifactId) {
  const canary = positiveId(canaryArtifactId, "explicit canary artifact id");
  const monitor = positiveId(monitorArtifactId, "explicit monitor artifact id");
  if (canary === monitor) fail("canary and monitor artifact IDs must be distinct");
  return { canaryArtifactId: canary, monitorArtifactId: monitor };
}

export async function resolveTrustedArtifactById(client, context) {
  const repository = repositoryName(client.repository);
  const artifactId = positiveId(context.artifactId, `${context.label} explicit artifact id`);
  const artifactValue = await client.json(
    `/repos/${repository}/actions/artifacts/${artifactId}`,
    `${context.label} artifact ${artifactId}`,
  );
  exact(positiveId(artifactValue.id, `${context.label} artifact response id`), artifactId, `${context.label} explicit artifact id`);
  const producerRunId = positiveId(record(artifactValue.workflow_run, `${context.label} artifact workflow run`).id, `${context.label} artifact workflow run id`);
  const workflow = await resolveWorkflow(client, context.path);
  const run = validateWorkflowRun(
    await client.json(`/repos/${repository}/actions/runs/${producerRunId}`, `${context.label} originating workflow run`),
    {
      workflowId: workflow.id,
      path: context.path,
      event: context.event,
      releaseSha: context.releaseSha,
      defaultBranch: context.defaultBranch,
      repository,
      status: "completed",
      conclusion: "success",
    },
  );
  const artifact = validateArtifactMetadata(artifactValue, {
    name: context.name,
    run,
    resolutionTime: context.resolutionTime,
  });
  exact(artifact.id, artifactId, `${context.label} artifact id`);
  return { run, artifact };
}

async function repositoryContext(client, defaultBranch) {
  const repository = record(await client.json(`/repos/${client.repository}`, "repository metadata"), "repository metadata");
  exact(canonicalString(repository.full_name, "repository full_name"), client.repository, "repository full_name");
  exact(canonicalString(repository.default_branch, "repository default branch"), defaultBranch, "repository default branch");
  return { repository: client.repository, defaultBranch };
}

async function resolveBuildEvidence(client, { pullRequestNumber, currentMainSha, defaultBranch = "main", now = Date.now() }) {
  const resolvedAtMs = evaluationTime(now);
  const trusted = await repositoryContext(client, defaultBranch);
  const prNumber = positiveId(pullRequestNumber, "pull request number");
  const trustedCurrentMainSha = sha(currentMainSha, "current main SHA");
  const ref = record(await client.json(`/repos/${client.repository}/git/ref/heads/${encodeURIComponent(defaultBranch)}`, "current main ref"), "current main ref");
  exact(record(ref.object, "current main ref object").type, "commit", "current main ref object type");
  exact(sha(ref.object.sha, "live main SHA"), trustedCurrentMainSha, "live and dispatched main SHA");
  const pullRequest = validateMergedPullRequest(
    await client.json(`/repos/${client.repository}/pulls/${prNumber}`, `pull request ${prNumber}`),
    { repository: client.repository, defaultBranch, currentMainSha: trustedCurrentMainSha },
  );
  const reviews = await client.json(`/repos/${client.repository}/pulls/${prNumber}/reviews?per_page=100`, `pull request ${prNumber} reviews`);
  if (!Array.isArray(reviews) || reviews.length === 100) fail("pull request reviews are absent or exceed one API page");
  const finalHeadApproval = validateFinalHeadApproval(reviews, pullRequest);
  const mergeCommit = validateMergeCommit(
    await client.json(`/repos/${client.repository}/commits/${trustedCurrentMainSha}`, "trusted merge commit"),
    { releaseSha: trustedCurrentMainSha, finalHeadSha: pullRequest.headSha },
  );
  const build = await resolveTrustedArtifact(client, {
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    releaseSha: trustedCurrentMainSha,
    defaultBranch,
    name: buildArtifactName(trustedCurrentMainSha),
    label: "post-merge build",
    resolutionTime: resolvedAtMs,
  });
  const mergedAtMs = timestamp(pullRequest.mergedAt, "pull request mergedAt").milliseconds;
  if (Date.parse(build.run.createdAt) < mergedAtMs - 5_000) fail("post-merge build predates the merged pull request");
  if (Date.parse(build.artifact.createdAt) < Date.parse(build.run.createdAt)) fail("build artifact predates its producer run");
  if (resolvedAtMs < Date.parse(build.artifact.createdAt)) fail("build resolution predates the build artifact");
  return validateBuildResolution({
    schemaVersion: 2,
    kind: BUILD_RESOLUTION_KIND,
    repository: trusted.repository,
    defaultBranch: trusted.defaultBranch,
    releaseSha: trustedCurrentMainSha,
    pullRequest,
    finalHeadApproval,
    mergeCommit,
    buildWorkflow: build.run,
    buildArtifact: build.artifact,
    resolvedAt: new Date(resolvedAtMs).toISOString(),
  });
}

function normalizedPullKeys() {
  return [
    "number",
    "state",
    "merged",
    "author",
    "headSha",
    "headRef",
    "headRepository",
    "baseSha",
    "baseRef",
    "baseRepository",
    "mergeCommitSha",
    "mergedAt",
    "mergedBy",
  ];
}

export function validateBuildResolution(value) {
  const root = exactKeys(
    value,
    [
      "schemaVersion",
      "kind",
      "repository",
      "defaultBranch",
      "releaseSha",
      "pullRequest",
      "finalHeadApproval",
      "mergeCommit",
      "buildWorkflow",
      "buildArtifact",
      "resolvedAt",
    ],
    "build resolution",
  );
  exact(root.schemaVersion, 2, "build resolution schemaVersion");
  exact(root.kind, BUILD_RESOLUTION_KIND, "build resolution kind");
  const resolvedAt = timestamp(root.resolvedAt, "build resolution resolvedAt");
  const repository = repositoryName(root.repository);
  exact(root.defaultBranch, "main", "build resolution default branch");
  const releaseSha = sha(root.releaseSha, "build resolution release SHA");
  const pull = exactKeys(root.pullRequest, normalizedPullKeys(), "build resolution pull request");
  if (!Number.isSafeInteger(pull.number) || pull.number < 1) fail("build resolution pull request number is invalid");
  exact(pull.state, "closed", "build resolution pull request state");
  exact(pull.merged, true, "build resolution pull request merged state");
  actor(pull.author, "build resolution pull request author");
  sha(pull.headSha, "build resolution final pull request head SHA");
  canonicalString(pull.headRef, "build resolution pull request head ref");
  exact(pull.headRepository, repository, "build resolution pull request head repository");
  sha(pull.baseSha, "build resolution pull request base SHA");
  exact(pull.baseRef, "main", "build resolution pull request base branch");
  exact(pull.baseRepository, repository, "build resolution pull request base repository");
  exact(sha(pull.mergeCommitSha, "build resolution merge commit SHA"), releaseSha, "release SHA and merge commit SHA");
  timestamp(pull.mergedAt, "build resolution pull request mergedAt");
  actor(pull.mergedBy, "build resolution pull request merger");
  const approval = exactKeys(root.finalHeadApproval, ["id", "actor", "commitSha", "submittedAt"], "final-head approval");
  positiveId(approval.id, "final-head approval id");
  if (sameActor(actor(approval.actor, "final-head approval actor"), pull.author)) fail("final-head approval actor is not independent of the pull request author");
  exact(sha(approval.commitSha, "final-head approval commit SHA"), pull.headSha, "final-head approval commit SHA");
  if (timestamp(approval.submittedAt, "final-head approval submittedAt").milliseconds > Date.parse(pull.mergedAt)) {
    fail("final-head approval postdates the merge");
  }
  const merge = exactKeys(root.mergeCommit, ["sha", "parentShas", "author", "committer"], "merge commit evidence");
  exact(sha(merge.sha, "merge commit evidence SHA"), releaseSha, "merge commit evidence SHA");
  if (!Array.isArray(merge.parentShas) || merge.parentShas.length === 0) fail("merge commit evidence parents are absent");
  const parentShas = merge.parentShas.map((entry, index) => sha(entry, `merge commit evidence parent ${index}`));
  if (new Set(parentShas).size !== parentShas.length) fail("merge commit evidence parents contain duplicates");
  if (parentShas.length > 1 && !parentShas.includes(pull.headSha)) fail("merge commit evidence is not related to the final pull request head");
  if (merge.author !== null) actor(merge.author, "merge commit author");
  actor(merge.committer, "final code pusher");
  const run = validateNormalizedRun(root.buildWorkflow, {
    label: "post-merge build",
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "push",
    status: "completed",
    conclusion: "success",
    releaseSha,
    defaultBranch: "main",
    repository,
  });
  validateNormalizedArtifact(root.buildArtifact, {
    label: "post-merge build",
    name: buildArtifactName(releaseSha),
    run,
    releaseSha,
    resolutionTime: resolvedAt.milliseconds,
  });
  if (Date.parse(run.createdAt) < Date.parse(pull.mergedAt) - 5_000) fail("post-merge build predates the merged pull request");
  return root;
}

function validateDeploymentStatus(value, context) {
  const status = record(value, "deployment status");
  const identity = validateCloudflareCanaryUrl(status.environment_url);
  exact(identity.origin, context.identity.origin, "deployment status environment URL");
  exact(identity.deploymentId, context.identity.deploymentId, "deployment status Cloudflare deployment ID");
  exact(status.state, "success", "deployment status state");
  exact(status.environment, CANARY_ENVIRONMENT, "deployment status environment");
  const created = timestamp(status.created_at, "deployment status created_at");
  if (created.milliseconds < context.deploymentCreatedAt) fail("deployment status predates its GitHub deployment");
  return {
    id: positiveId(status.id, "deployment status id"),
    state: "success",
    environmentUrl: identity.raw,
    creator: actor(status.creator, "Cloudflare deployment actor"),
    createdAt: created.iso,
  };
}

async function resolveCanaryDeployment(client, { identity, releaseSha, buildArtifactCreatedAt }) {
  const deployments = await client.json(
    `/repos/${client.repository}/deployments?sha=${releaseSha}&environment=${encodeURIComponent(CANARY_ENVIRONMENT)}&per_page=100`,
    "canary deployments",
  );
  if (!Array.isArray(deployments) || deployments.length === 100) fail("canary deployments are absent or exceed one API page");
  const candidates = [];
  for (const deploymentValue of deployments) {
    const deployment = record(deploymentValue, "canary deployment");
    exact(sha(deployment.sha, "canary deployment SHA"), releaseSha, "canary deployment SHA");
    exact(deployment.ref, releaseSha, "canary deployment ref");
    exact(deployment.task, "deploy", "canary deployment task");
    exact(deployment.environment, CANARY_ENVIRONMENT, "canary deployment environment");
    exact(deployment.transient_environment, true, "canary transient environment state");
    exact(deployment.production_environment, false, "canary production environment state");
    const created = timestamp(deployment.created_at, "canary deployment created_at");
    if (created.milliseconds < Date.parse(buildArtifactCreatedAt)) fail("canary deployment predates the immutable build artifact");
    const statuses = await client.json(`/repos/${client.repository}/deployments/${positiveId(deployment.id, "canary deployment id")}/statuses?per_page=100`, "canary deployment statuses");
    if (!Array.isArray(statuses) || statuses.length === 100) fail("canary deployment statuses are absent or exceed one API page");
    const matchingStatuses = statuses.filter((status) => status?.state === "success" && status?.environment === CANARY_ENVIRONMENT);
    const status = validateDeploymentStatus(requireUniqueCandidate(matchingStatuses, "successful canary deployment status"), {
      identity,
      deploymentCreatedAt: created.milliseconds,
    });
    candidates.push({
      id: positiveId(deployment.id, "canary deployment id"),
      sha: releaseSha,
      ref: releaseSha,
      environment: CANARY_ENVIRONMENT,
      creator: actor(deployment.creator, "GitHub deployment creator"),
      createdAt: created.iso,
      status,
    });
  }
  return validateNormalizedDeployment(requireUniqueCandidate(candidates, "exact canary deployment"), { identity, releaseSha });
}

function validateNormalizedDeployment(value, context) {
  const deployment = exactKeys(value, ["id", "sha", "ref", "environment", "creator", "createdAt", "status"], "GitHub canary deployment");
  positiveId(deployment.id, "GitHub canary deployment id");
  exact(sha(deployment.sha, "GitHub canary deployment SHA"), context.releaseSha, "GitHub canary deployment SHA");
  exact(deployment.ref, context.releaseSha, "GitHub canary deployment ref");
  exact(deployment.environment, CANARY_ENVIRONMENT, "GitHub canary deployment environment");
  actor(deployment.creator, "GitHub deployment creator");
  const createdAtMs = timestamp(deployment.createdAt, "GitHub canary deployment createdAt").milliseconds;
  const status = exactKeys(deployment.status, ["id", "state", "environmentUrl", "creator", "createdAt"], "Cloudflare deployment status");
  positiveId(status.id, "Cloudflare deployment status id");
  exact(status.state, "success", "Cloudflare deployment status state");
  const identity = validateCloudflareCanaryUrl(status.environmentUrl);
  exact(identity.origin, context.identity.origin, "Cloudflare deployment status URL");
  exact(identity.deploymentId, context.identity.deploymentId, "Cloudflare deployment status ID");
  actor(status.creator, "Cloudflare deployment actor");
  if (timestamp(status.createdAt, "Cloudflare deployment status createdAt").milliseconds < createdAtMs) {
    fail("Cloudflare deployment status predates its GitHub deployment");
  }
  return deployment;
}

function validateProductionEnvironment(value) {
  const environment = record(value, "production environment");
  exact(environment.name, PRODUCTION_ENVIRONMENT, "production environment name");
  if (!Array.isArray(environment.protection_rules)) fail("production environment protection rules are absent");
  const wait = requireUniqueCandidate(environment.protection_rules.filter((rule) => rule?.type === "wait_timer"), "production wait timer rule");
  exact(wait.wait_timer, PRODUCTION_WAIT_TIMER_MINUTES, "production wait timer");
  const reviewers = requireUniqueCandidate(environment.protection_rules.filter((rule) => rule?.type === "required_reviewers"), "required reviewers rule");
  exact(reviewers.prevent_self_review, true, "production prevent_self_review setting");
  if (!Array.isArray(reviewers.reviewers)) fail("production required reviewers are absent");
  const normalizedReviewers = reviewers.reviewers.map((entry) => {
    exact(entry.type, "User", "production reviewer type");
    return actor(entry.reviewer, "production required reviewer");
  });
  const required = requireUniqueCandidate(normalizedReviewers, "production required reviewer");
  if (!sameActor(required, REQUIRED_PRODUCTION_REVIEWER)) fail("production required reviewer is not predopta");
  const policy = record(environment.deployment_branch_policy, "production deployment branch policy");
  exact(policy.protected_branches, true, "production protected branch policy");
  exact(policy.custom_branch_policies, false, "production custom branch policy");
  return {
    name: PRODUCTION_ENVIRONMENT,
    waitTimerMinutes: PRODUCTION_WAIT_TIMER_MINUTES,
    requiredReviewer: REQUIRED_PRODUCTION_REVIEWER,
    preventSelfReview: true,
    protectedBranches: true,
    customBranchPolicies: false,
  };
}

function validateNormalizedEnvironment(value) {
  const environment = exactKeys(
    value,
    ["name", "waitTimerMinutes", "requiredReviewer", "preventSelfReview", "protectedBranches", "customBranchPolicies"],
    "normalized production environment",
  );
  exact(environment.name, PRODUCTION_ENVIRONMENT, "normalized production environment name");
  exact(environment.waitTimerMinutes, PRODUCTION_WAIT_TIMER_MINUTES, "normalized production wait timer");
  if (!sameActor(actor(environment.requiredReviewer, "normalized required reviewer"), REQUIRED_PRODUCTION_REVIEWER)) {
    fail("normalized production reviewer is not predopta");
  }
  exact(environment.preventSelfReview, true, "normalized prevent_self_review");
  exact(environment.protectedBranches, true, "normalized protected branches setting");
  exact(environment.customBranchPolicies, false, "normalized custom branch policies setting");
  return environment;
}

export function normalizeProductionApprovals(value) {
  if (!Array.isArray(value) || value.length === 0) fail("current production approvals are absent");
  const approvals = [];
  for (const [index, entryValue] of value.entries()) {
    const entry = record(entryValue, `production approval history ${index}`);
    if (!Array.isArray(entry.environments)) fail(`production approval history ${index} environments are absent`);
    const matching = entry.environments.filter((environmentValue, environmentIndex) => {
      const environment = record(environmentValue, `production approval history ${index} environment ${environmentIndex}`);
      return canonicalString(environment.name, `production approval history ${index} environment ${environmentIndex} name`) === PRODUCTION_ENVIRONMENT;
    });
    if (matching.length > 1) fail(`production approval history ${index} contains duplicate production environments`);
    if (matching.length === 0) continue;
    approvals.push({
      actor: actor(entry.user, `production approval history ${index} actor`),
      state: canonicalString(entry.state, `production approval history ${index} state`).toLocaleLowerCase("en-US"),
      environment: PRODUCTION_ENVIRONMENT,
    });
  }
  if (approvals.length === 0) fail(`current ${PRODUCTION_ENVIRONMENT} approvals are absent`);
  return approvals;
}

export function validateApprovalReviews(approvals, excludedActors) {
  if (!Array.isArray(approvals) || approvals.length === 0) fail("current production approvals are absent");
  if (!Array.isArray(excludedActors) || excludedActors.length === 0) fail("actor exclusion evidence is absent");
  const exclusions = excludedActors.map((entry, index) => actor(entry, `excluded actor ${index}`));
  const approved = approvals.filter((approval) => {
    const value = exactKeys(approval, ["actor", "state", "environment"], "production approval");
    actor(value.actor, "production approval actor");
    exact(value.environment, PRODUCTION_ENVIRONMENT, "production approval environment");
    if (value.state !== "approved" && value.state !== "rejected") fail("production approval state is invalid");
    return value.state === "approved";
  });
  const required = approved.filter((approval) => sameActor(approval.actor, REQUIRED_PRODUCTION_REVIEWER));
  const current = requireUniqueCandidate(required, "current predopta production approval");
  for (const excluded of exclusions) {
    if (sameActor(current.actor, excluded)) fail(`production approving reviewer is not independent of ${excluded}`);
  }
  return current;
}

export function validateSampleProducerEvidence(value, context) {
  if (!Array.isArray(value) || value.length === 0) fail("monitor sample producer evidence is absent");
  if (value.length < context.samples.length) fail("monitor producer evidence cannot contain fewer candidates than selected samples");
  const runIds = new Set();
  const artifactIds = new Set();
  const selectedByRunId = new Map(context.samples.map((sample, index) => [positiveId(sample.runId, `monitor sample ${index} run id`), sample]));
  const selectedProducerRunIds = new Set();
  const actors = [];
  let sourceRunCount = 0;
  let previousCreatedAt = -Infinity;
  let previousRunId = 0n;
  exact(context.monitorWorkflow.actor, context.monitorWorkflow.triggeringActor, "trusted monitor dispatch actor identity");
  for (const [index, producerValue] of value.entries()) {
    const producer = exactKeys(
      producerValue,
      [
        "runId", "event", "workflowPath", "workflowHeadSha", "headBranch", "repository", "actor",
        "triggeringActor", "conclusion", "runCreatedAt", "runUpdatedAt", "artifactId", "artifactName", "artifactApiDigest",
        "sampleInspected", "sampleObservedAt", "sampleStatus", "selected",
      ],
      `monitor producer run ${index}`,
    );
    const runId = positiveId(producer.runId, `monitor sample producer ${index} run id`);
    if (runIds.has(runId)) fail("monitor sample producer run IDs must be unique");
    runIds.add(runId);
    const numericRunId = BigInt(runId);
    if (producer.event !== "schedule" && producer.event !== "workflow_dispatch") fail(`monitor sample producer ${index} event is invalid`);
    exact(producer.workflowPath, TRUSTED_MONITOR_WORKFLOW_PATH, `monitor sample producer ${index} workflow path`);
    exact(sha(producer.workflowHeadSha, `monitor sample producer ${index} workflow head SHA`), context.releaseSha, `monitor sample producer ${index} release SHA`);
    exact(producer.headBranch, "main", `monitor sample producer ${index} head branch`);
    exact(producer.repository, context.repository, `monitor sample producer ${index} repository`);
    const producerActor = actor(producer.actor, `monitor sample producer ${index} actor`);
    const triggeringActor = actor(producer.triggeringActor, `monitor sample producer ${index} triggering actor`);
    actors.push(producerActor, triggeringActor);
    if (producer.event === "workflow_dispatch") {
      exact(producerActor, context.monitorWorkflow.actor, `monitor sample producer ${index} trusted dispatch actor`);
      exact(triggeringActor, context.monitorWorkflow.triggeringActor, `monitor sample producer ${index} trusted dispatch triggering actor`);
    }
    const isSourceRun = runId === context.monitorWorkflow.id;
    if (isSourceRun) {
      sourceRunCount += 1;
      exact(producer.event, "workflow_dispatch", "monitor aggregate source event");
      exact(producer.conclusion, null, "monitor aggregate source in-progress conclusion");
    } else {
      exact(producer.conclusion, "success", `monitor sample producer ${index} conclusion`);
    }
    const createdAt = timestamp(producer.runCreatedAt, `monitor sample producer ${index} createdAt`).milliseconds;
    const updatedAt = timestamp(producer.runUpdatedAt, `monitor sample producer ${index} updatedAt`).milliseconds;
    if (updatedAt < createdAt || updatedAt > context.generatedAtMs + 5_000) fail(`monitor sample producer ${index} run timestamps are invalid`);
    if (createdAt < previousCreatedAt || (createdAt === previousCreatedAt && numericRunId <= previousRunId)) {
      fail("monitor sample producer runs are not deterministically sorted");
    }
    previousCreatedAt = createdAt;
    previousRunId = numericRunId;
    const artifactId = positiveId(producer.artifactId, `monitor sample producer ${index} artifact id`);
    if (artifactIds.has(artifactId)) fail("monitor sample producer artifact IDs must be unique");
    artifactIds.add(artifactId);
    exact(producer.artifactName, `ariada-wiki-monitor-sample-${context.releaseSha}`, `monitor sample producer ${index} artifact name`);
    const artifactApiDigest = apiDigest(producer.artifactApiDigest, `monitor sample producer ${index} artifact digest`);
    if (typeof producer.sampleInspected !== "boolean") fail(`monitor sample producer ${index} sampleInspected is invalid`);
    if (typeof producer.selected !== "boolean") fail(`monitor sample producer ${index} selected is invalid`);
    let sampleObservedAt = null;
    if (producer.sampleInspected) {
      sampleObservedAt = timestamp(producer.sampleObservedAt, `monitor sample producer ${index} sample observedAt`).iso;
      exact(producer.sampleStatus, "passed", `monitor sample producer ${index} sample status`);
    } else {
      if (producer.selected) fail(`monitor sample producer ${index} cannot be selected without inspection`);
      exact(producer.sampleObservedAt, null, `monitor sample producer ${index} uninspected sample timestamp`);
      exact(producer.sampleStatus, null, `monitor sample producer ${index} uninspected sample status`);
    }
    if (producer.selected) {
      if (!producer.sampleInspected) fail(`monitor sample producer ${index} cannot be selected without inspection`);
      const sample = selectedByRunId.get(runId);
      if (sample === undefined) fail(`monitor sample producer ${index} is selected without a gate sample`);
      exact(sampleObservedAt, sample.observedAt, `monitor sample producer ${index} selected timestamp`);
      exact(artifactId, positiveId(sample.artifactId, `monitor sample producer ${index} selected artifact id`), `monitor sample producer ${index} selected artifact id`);
      exact(producer.artifactName, sample.artifactName, `monitor sample producer ${index} selected artifact name`);
      exact(artifactApiDigest, sample.artifactApiDigest, `monitor sample producer ${index} selected artifact digest`);
      selectedProducerRunIds.add(runId);
    }
  }
  exact(sourceRunCount, 1, "monitor aggregate source producer count");
  for (const runId of selectedByRunId.keys()) {
    if (!selectedProducerRunIds.has(runId)) fail("monitor sample lacks an exact selected producer");
  }
  return actors;
}

function independentActorEvidence(resolution, producerRuns) {
  const producerActors = producerRuns.flatMap((producer, index) => [
    actor(producer.actor, `validated monitor producer ${index} actor`),
    actor(producer.triggeringActor, `validated monitor producer ${index} triggering actor`),
  ]);
  return [
    resolution.build.pullRequest.author,
    resolution.build.pullRequest.mergedBy,
    resolution.build.mergeCommit.committer,
    resolution.build.buildWorkflow.actor,
    resolution.build.buildWorkflow.triggeringActor,
    resolution.githubDeployment.creator,
    resolution.githubDeployment.status.creator,
    resolution.canaryWorkflow.actor,
    resolution.canaryWorkflow.triggeringActor,
    resolution.monitorWorkflow.triggeringActor,
    resolution.monitorWorkflow.actor,
    resolution.productionWorkflow.triggeringActor,
    resolution.productionWorkflow.actor,
    ...producerActors,
  ].map((entry, index) => actor(entry, `promotion actor evidence ${index}`));
}

export function validateReleaseManifest(value, context) {
  return validateContentReleaseManifest(value, { releaseSha: context?.releaseSha });
}

export function validateReleaseManifestCopies({ artifactBytes, archivedBytes, deployedBytes }, context) {
  const artifact = parseContentReleaseManifestBytes(artifactBytes, { releaseSha: context.releaseSha });
  const archived = Buffer.isBuffer(archivedBytes) ? archivedBytes : Buffer.from(archivedBytes ?? "");
  const deployed = Buffer.isBuffer(deployedBytes) ? deployedBytes : Buffer.from(deployedBytes ?? "");
  if (!artifact.bytes.equals(archived)) fail("release tar manifest bytes differ from the artifact release manifest");
  if (!artifact.bytes.equals(deployed)) fail("deployed release manifest bytes differ from the artifact release manifest");
  parseContentReleaseManifestBytes(archived, { releaseSha: context.releaseSha });
  parseContentReleaseManifestBytes(deployed, { releaseSha: context.releaseSha });
  return artifact;
}

export function validateCanaryEvidence(value, context) {
  const root = exactKeys(
    value,
    ["schemaVersion", "kind", "releaseSha", "finalTarSha256", "releaseManifestSha256", "contentSetSha256", "deploymentId", "hostname", "startedAt", "verifiedAt"],
    "canary evidence",
  );
  exact(root.schemaVersion, 1, "canary evidence schemaVersion");
  exact(root.kind, CANARY_EVIDENCE_KIND, "canary evidence kind");
  exact(sha(root.releaseSha, "canary evidence releaseSha"), context.releaseSha, "canary evidence release SHA");
  const finalTarSha256 = digest(root.finalTarSha256, "canary evidence finalTarSha256");
  exact(digest(root.releaseManifestSha256, "canary evidence release manifest digest"), context.releaseManifestSha256, "canary release manifest digest");
  exact(digest(root.contentSetSha256, "canary evidence content-set digest"), context.contentSetSha256, "canary content-set digest");
  exact(root.deploymentId, context.identity.deploymentId, "canary deployment ID");
  exact(root.hostname, context.identity.hostname, "canary deployment hostname");
  const startedAt = timestamp(root.startedAt, "canary startedAt");
  exact(startedAt.iso, timestamp(context.githubDeployment.status.createdAt, "trusted Cloudflare deployment status createdAt").iso, "canary start and trusted deployment status time");
  const verifiedAt = timestamp(root.verifiedAt, "canary verifiedAt");
  if (verifiedAt.milliseconds < startedAt.milliseconds) fail("canary verification predates canary start");
  const canaryArtifactCreatedAt = Date.parse(context.canaryArtifact.createdAt);
  if (canaryArtifactCreatedAt < verifiedAt.milliseconds - 5_000 || canaryArtifactCreatedAt > verifiedAt.milliseconds + MONITOR_CADENCE_SECONDS * 1000) {
    fail("canary evidence artifact is stale relative to verification");
  }
  return {
    root,
    finalTarSha256,
    startedAt: startedAt.iso,
    startedAtMs: startedAt.milliseconds,
    verifiedAt: verifiedAt.iso,
    verifiedAtMs: verifiedAt.milliseconds,
  };
}

export function validateMonitorEvidence(value, context) {
  const root = exactKeys(
    value,
    [
      "schemaVersion", "kind", "releaseSha", "finalTarSha256", "deploymentId", "hostname", "canary",
      "artifactName", "manifest", "cadenceSeconds", "window", "producerRuns", "samples", "coverage", "generatedAt",
    ],
    "monitor evidence",
  );
  exact(root.schemaVersion, 1, "monitor evidence schemaVersion");
  exact(root.kind, MONITOR_EVIDENCE_KIND, "monitor evidence kind");
  exact(root.artifactName, monitorArtifactName(context.releaseSha, context.identity.deploymentId), "monitor evidence artifact name");
  exact(sha(root.releaseSha, "monitor evidence releaseSha"), context.releaseSha, "monitor evidence release SHA");
  exact(digest(root.finalTarSha256, "monitor evidence finalTarSha256"), context.finalTarSha256, "monitor evidence final tar digest");
  exact(root.deploymentId, context.identity.deploymentId, "monitor deployment ID");
  exact(root.hostname, context.identity.hostname, "monitor deployment hostname");
  exact(root.cadenceSeconds, MONITOR_CADENCE_SECONDS, "monitor cadence");

  const canary = exactKeys(
    root.canary,
    ["runId", "artifactId", "artifactName", "artifactApiDigest", "workflowPath", "workflowHeadSha", "actor", "triggeringActor", "startedAt", "verifiedAt"],
    "monitor canary provenance",
  );
  exact(positiveId(canary.runId, "monitor canary run id"), context.canaryWorkflow.id, "monitor canary run id");
  exact(positiveId(canary.artifactId, "monitor canary artifact id"), context.canaryArtifact.id, "monitor canary artifact id");
  exact(canary.artifactName, canaryArtifactName(context.releaseSha, context.identity.deploymentId), "monitor canary artifact name");
  exact(apiDigest(canary.artifactApiDigest, "monitor canary artifact API digest"), context.canaryArtifact.apiDigest, "monitor canary artifact API digest");
  exact(canary.workflowPath, TRUSTED_GATE_WORKFLOW_PATH, "monitor canary workflow path");
  exact(sha(canary.workflowHeadSha, "monitor canary workflow head SHA"), context.releaseSha, "monitor canary workflow head SHA");
  exact(actor(canary.actor, "monitor canary actor"), context.canaryWorkflow.actor, "monitor canary actor");
  exact(actor(canary.triggeringActor, "monitor canary triggering actor"), context.canaryWorkflow.triggeringActor, "monitor canary triggering actor");
  exact(timestamp(canary.startedAt, "monitor canary startedAt").iso, context.canaryStartedAt, "monitor and canary start time");
  exact(timestamp(canary.verifiedAt, "monitor canary verifiedAt").iso, context.canaryVerifiedAt, "monitor and canary verification time");

  const manifest = exactKeys(
    root.manifest,
    ["releaseSha", "manifestSha256", "contentSetSha256", "generatedAt", "fileCount"],
    "monitor manifest identity",
  );
  exact(sha(manifest.releaseSha, "monitor manifest releaseSha"), context.releaseSha, "monitor manifest release SHA");
  exact(digest(manifest.manifestSha256, "monitor manifest byte digest"), context.releaseManifestSha256, "monitor manifest byte digest");
  exact(digest(manifest.contentSetSha256, "monitor manifest content-set digest"), context.contentSetSha256, "monitor manifest content-set digest");
  exact(timestamp(manifest.generatedAt, "monitor manifest generatedAt").iso, context.releaseManifest.generatedAt, "monitor manifest generatedAt");
  exact(manifest.fileCount, context.releaseManifest.files.length, "monitor manifest file count");

  if (!Array.isArray(root.samples) || root.samples.length < MONITOR_MIN_SAMPLES) {
    fail(`monitor evidence requires at least ${MONITOR_MIN_SAMPLES} samples`);
  }
  const window = exactKeys(
    root.window,
    ["startedAt", "endedAt", "bucketCount", "dispatchBucketCount", "dispatchCoverageBasisPoints"],
    "monitor window",
  );
  exact(window.bucketCount, root.samples.length, "monitor window bucket count");
  const covered = new Map();
  let previousObservedAt;
  let previousBucket;
  let dispatchCount = 0;
  for (const [index, sampleValue] of root.samples.entries()) {
    const sample = exactKeys(
      sampleValue,
      ["runId", "artifactId", "artifactName", "artifactApiDigest", "event", "observedAt", "bucket", "status", "releaseSha", "workflowHeadSha", "finalTarSha256", "deploymentId", "manifestSha256", "contentSetSha256", "checkedFiles"],
      `monitor sample ${index}`,
    );
    positiveId(sample.runId, `monitor sample ${index} run id`);
    positiveId(sample.artifactId, `monitor sample ${index} artifact id`);
    exact(sample.artifactName, `ariada-wiki-monitor-sample-${context.releaseSha}`, `monitor sample ${index} artifact name`);
    sample.artifactApiDigest = apiDigest(sample.artifactApiDigest, `monitor sample ${index} artifact API digest`);
    if (sample.event !== "schedule" && sample.event !== "workflow_dispatch") fail(`monitor sample ${index} event is invalid`);
    if (sample.event === "workflow_dispatch") dispatchCount += 1;
    exact(sample.status, "passed", `monitor sample ${index} status`);
    exact(sha(sample.releaseSha, `monitor sample ${index} releaseSha`), context.releaseSha, `monitor sample ${index} release SHA`);
    exact(sha(sample.workflowHeadSha, `monitor sample ${index} workflowHeadSha`), context.releaseSha, `monitor sample ${index} workflow head SHA`);
    exact(digest(sample.finalTarSha256, `monitor sample ${index} finalTarSha256`), context.finalTarSha256, `monitor sample ${index} final tar digest`);
    exact(sample.deploymentId, context.identity.deploymentId, `monitor sample ${index} deployment ID`);
    exact(digest(sample.manifestSha256, `monitor sample ${index} manifestSha256`), context.releaseManifestSha256, `monitor sample ${index} manifest byte digest`);
    exact(digest(sample.contentSetSha256, `monitor sample ${index} contentSetSha256`), context.contentSetSha256, `monitor sample ${index} content-set digest`);
    const observedAt = timestamp(sample.observedAt, `monitor sample ${index} observedAt`).milliseconds;
    if (!Number.isSafeInteger(sample.bucket) || sample.bucket < 0) fail(`monitor sample ${index} bucket is invalid`);
    exact(sample.bucket, Math.floor(observedAt / (MONITOR_CADENCE_SECONDS * 1000)), `monitor sample ${index} UTC bucket`);
    if (index === 0) {
      const firstFreshness = observedAt - Date.parse(context.canaryStartedAt);
      if (firstFreshness < 0 || firstFreshness > MONITOR_CADENCE_SECONDS * 1000) fail("first monitor sample is not fresh relative to canary start");
    } else {
      const gap = observedAt - previousObservedAt;
      if (gap < 240_000 || gap > MONITOR_MAX_GAP_SECONDS * 1000) fail(`monitor sample gap exceeds the trusted cadence bounds at sample ${index}`);
      exact(sample.bucket, previousBucket + 1, `monitor sample ${index} consecutive UTC bucket`);
    }
    previousObservedAt = observedAt;
    previousBucket = sample.bucket;
    const checkedFiles = validateContentEntries(sample.checkedFiles, { allowEmpty: true, label: `monitor sample ${index} checkedFiles` });
    const expectedShard = context.releaseManifest.files.filter((unused, fileIndex) => fileIndex % 576 === sample.bucket % 576);
    if (JSON.stringify(checkedFiles) !== JSON.stringify(expectedShard)) fail(`monitor sample ${index} does not contain its deterministic manifest shard`);
    for (const file of checkedFiles) {
      const prior = covered.get(file.path);
      if (prior !== undefined && JSON.stringify(prior) !== JSON.stringify(file)) fail(`monitor coverage conflicts for ${file.path}`);
      covered.set(file.path, file);
    }
  }
  const firstAt = timestamp(root.samples[0].observedAt, "first monitor sample observedAt").milliseconds;
  const finalAt = previousObservedAt;
  exact(timestamp(window.startedAt, "monitor window startedAt").milliseconds, firstAt, "monitor window start and first sample");
  exact(timestamp(window.endedAt, "monitor window endedAt").milliseconds, finalAt, "monitor window end and final sample");
  exact(window.dispatchBucketCount, dispatchCount, "monitor dispatch bucket count");
  const dispatchCoverageBasisPoints = Math.floor((dispatchCount * 10_000) / root.samples.length);
  exact(window.dispatchCoverageBasisPoints, dispatchCoverageBasisPoints, "monitor dispatch coverage basis points");
  if (dispatchCoverageBasisPoints < MIN_DISPATCH_COVERAGE_BASIS_POINTS) fail("monitor dispatch coverage is below 95 percent");
  if (finalAt - Date.parse(context.canaryStartedAt) < MIN_CANARY_AGE_SECONDS * 1000) fail(`monitor evidence covers fewer than ${MIN_CANARY_AGE_SECONDS} seconds`);

  const coverage = exactKeys(root.coverage, ["requiredFileCount", "coveredFileCount", "files"], "monitor coverage");
  exact(coverage.requiredFileCount, context.releaseManifest.files.length, "monitor required file count");
  exact(coverage.coveredFileCount, covered.size, "monitor covered file count");
  const coverageFiles = validateContentEntries(coverage.files, { label: "monitor coverage files" });
  if (JSON.stringify(coverageFiles) !== JSON.stringify(context.releaseManifest.files)) fail("monitor aggregate coverage does not match every exact manifest entry");
  const unionFiles = [...covered.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (JSON.stringify(unionFiles) !== JSON.stringify(coverageFiles)) fail("monitor aggregate coverage is not the exact selected-sample union");

  const nowMs = evaluationTime(context.now);
  validateCanaryAge(context.canaryStartedAt, nowMs);
  const finalFreshness = nowMs - finalAt;
  if (finalFreshness < 0 || finalFreshness > MONITOR_FINAL_FRESHNESS_SECONDS * 1000) fail("final monitor sample is stale or future-dated");
  const generatedAt = timestamp(root.generatedAt, "monitor generatedAt").milliseconds;
  const aggregateDelay = generatedAt - finalAt;
  if (aggregateDelay < 0 || aggregateDelay > MONITOR_CADENCE_SECONDS * 1000) fail("monitor aggregate is stale relative to the final sample");
  const aggregateFreshness = nowMs - generatedAt;
  if (aggregateFreshness < 0 || aggregateFreshness > MONITOR_FINAL_FRESHNESS_SECONDS * 1000) fail("monitor aggregate is stale or future-dated at promotion");
  validateSampleProducerEvidence(root.producerRuns, {
    samples: root.samples,
    releaseSha: context.releaseSha,
    repository: context.repository,
    monitorWorkflow: context.monitorWorkflow,
    generatedAtMs: generatedAt,
  });
  return root;
}

function validatePromotionResolution(value, identity) {
  const root = exactKeys(
    value,
    [
      "schemaVersion",
      "kind",
      "repository",
      "defaultBranch",
      "releaseSha",
      "canaryUrl",
      "build",
      "canaryWorkflow",
      "canaryArtifact",
      "monitorWorkflow",
      "monitorArtifact",
      "githubDeployment",
      "productionWorkflow",
      "productionEnvironment",
      "productionApprovals",
      "resolvedAt",
    ],
    "promotion resolution",
  );
  exact(root.schemaVersion, 2, "promotion resolution schemaVersion");
  exact(root.kind, PROMOTION_RESOLUTION_KIND, "promotion resolution kind");
  const resolvedAt = timestamp(root.resolvedAt, "promotion resolvedAt");
  const repository = repositoryName(root.repository);
  exact(root.defaultBranch, "main", "promotion default branch");
  const releaseSha = sha(root.releaseSha, "promotion release SHA");
  exact(root.canaryUrl, identity.raw, "promotion canary URL");
  const build = validateBuildResolution(root.build);
  exact(build.repository, repository, "promotion build repository");
  exact(build.releaseSha, releaseSha, "promotion build release SHA");
  const canaryRun = validateNormalizedRun(root.canaryWorkflow, {
    label: "canary verification",
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    releaseSha,
    defaultBranch: "main",
    repository,
  });
  validateNormalizedArtifact(root.canaryArtifact, {
    label: "canary verification",
    name: canaryArtifactName(releaseSha, identity.deploymentId),
    run: canaryRun,
    releaseSha,
    resolutionTime: resolvedAt.milliseconds,
  });
  const monitorRun = validateNormalizedRun(root.monitorWorkflow, {
    label: "monitor aggregate",
    path: TRUSTED_MONITOR_WORKFLOW_PATH,
    event: "workflow_dispatch",
    status: "completed",
    conclusion: "success",
    releaseSha,
    defaultBranch: "main",
    repository,
  });
  validateNormalizedArtifact(root.monitorArtifact, {
    label: "monitor aggregate",
    name: monitorArtifactName(releaseSha, identity.deploymentId),
    run: monitorRun,
    releaseSha,
    resolutionTime: resolvedAt.milliseconds,
  });
  validateNormalizedDeployment(root.githubDeployment, { identity, releaseSha });
  validateNormalizedRun(root.productionWorkflow, {
    label: "production gate",
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    status: "in_progress",
    conclusion: null,
    releaseSha,
    defaultBranch: "main",
    repository,
  });
  validateNormalizedEnvironment(root.productionEnvironment);
  if (!Array.isArray(root.productionApprovals) || root.productionApprovals.length === 0) fail("promotion approvals are absent");
  return root;
}

export function evaluatePromotionGate({ resolution: resolutionValue, canaryEvidence, releaseManifestBytes, monitorEvidence, now = Date.now() }) {
  const identity = validateCloudflareCanaryUrl(record(resolutionValue, "promotion resolution").canaryUrl);
  const resolution = validatePromotionResolution(resolutionValue, identity);
  const nowMs = evaluationTime(now);
  if (Date.parse(resolution.resolvedAt) > nowMs || nowMs - Date.parse(resolution.resolvedAt) > MONITOR_FINAL_FRESHNESS_SECONDS * 1000) {
    fail("promotion resolution is stale or future-dated");
  }
  const releaseManifest = parseContentReleaseManifestBytes(releaseManifestBytes, { releaseSha: resolution.releaseSha });
  const canary = validateCanaryEvidence(canaryEvidence, {
    releaseSha: resolution.releaseSha,
    identity,
    build: resolution.build,
    canaryWorkflow: resolution.canaryWorkflow,
    canaryArtifact: resolution.canaryArtifact,
    githubDeployment: resolution.githubDeployment,
    releaseManifestSha256: releaseManifest.sha256,
    contentSetSha256: releaseManifest.manifest.contentSetSha256,
  });
  const age = validateCanaryAge(canary.startedAt, nowMs);
  const monitor = validateMonitorEvidence(monitorEvidence, {
    repository: resolution.repository,
    releaseSha: resolution.releaseSha,
    finalTarSha256: canary.finalTarSha256,
    identity,
    canaryStartedAt: canary.startedAt,
    canaryVerifiedAt: canary.verifiedAt,
    canaryWorkflow: resolution.canaryWorkflow,
    canaryArtifact: resolution.canaryArtifact,
    monitorWorkflow: resolution.monitorWorkflow,
    releaseManifestSha256: releaseManifest.sha256,
    contentSetSha256: releaseManifest.manifest.contentSetSha256,
    releaseManifest: releaseManifest.manifest,
    now: nowMs,
  });
  const excludedActors = independentActorEvidence(resolution, monitor.producerRuns);
  const approval = validateApprovalReviews(resolution.productionApprovals, excludedActors);
  return {
    releaseSha: resolution.releaseSha,
    pullRequestHeadSha: resolution.build.pullRequest.headSha,
    pullRequestNumber: resolution.build.pullRequest.number,
    deploymentId: identity.deploymentId,
    finalTarSha256: canary.finalTarSha256,
    releaseManifestSha256: releaseManifest.sha256,
    contentSetSha256: releaseManifest.manifest.contentSetSha256,
    approvingReviewer: approval.actor,
    canaryAgeSeconds: Math.floor(age / 1000),
  };
}

async function fetchReleaseManifest(fetchImpl, identity) {
  const endpoint = `${identity.origin}/.well-known/ariada-release.json`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "GET",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
  } catch {
    fail("canary release manifest endpoint is unavailable");
  }
  if (response.status !== 200) fail(`canary release manifest endpoint returned HTTP ${response.status}`);
  if (response.url !== endpoint) fail("canary release manifest endpoint changed origin or path");
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase("en-US").startsWith("application/json")) fail("canary release manifest content type is not JSON");
  const advertisedLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(advertisedLength) && advertisedLength > MAX_RELEASE_MANIFEST_BYTES) fail("canary release manifest exceeds the size bound");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_RELEASE_MANIFEST_BYTES) fail("canary release manifest exceeds the size bound");
  return bytes;
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    fail(`${label} is absent`);
  }
  try {
    return { text, value: JSON.parse(text) };
  } catch {
    fail(`${label} is invalid JSON`);
  }
}

async function readBytes(path, label) {
  try {
    return await readFile(path);
  } catch {
    fail(`${label} is absent`);
  }
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function archiveBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail(`${label} raw ZIP bytes are absent`);
  const bytes = Buffer.from(value);
  if (bytes.length === 0 || bytes.length > MAX_EVIDENCE_ARCHIVE_BYTES) fail(`${label} raw ZIP is empty or exceeds the size bound`);
  return bytes;
}

function verifyArtifactArchiveDigest(bytes, artifact, label) {
  const expected = apiDigest(artifact.apiDigest, `${label} artifact API digest`);
  const actual = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  exact(actual, expected, `${label} raw ZIP digest`);
  return actual;
}

function strictUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${label} is not valid UTF-8`);
  }
}

function validateZipExtra(extra, label) {
  let cursor = 0;
  while (cursor < extra.length) {
    if (cursor + 4 > extra.length) fail(`${label} ZIP extra field is truncated`);
    const identifier = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    cursor += 4;
    if (cursor + size > extra.length) fail(`${label} ZIP extra field is truncated`);
    if (identifier === 0x0001) fail(`${label} ZIP64 entries are not accepted`);
    cursor += size;
  }
}

function validateZipEntryName(name, label) {
  if (
    name === ""
    || name.includes("\0")
    || name.includes("\\")
    || name.startsWith("/")
    || /^[A-Za-z]:/u.test(name)
    || name.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    fail(`${label} ZIP contains an unsafe entry path`);
  }
  return name;
}

function findZipEnd(bytes, label) {
  if (bytes.length < 22) fail(`${label} raw ZIP is truncated`);
  const minimum = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) !== 0x06054b50) continue;
    const commentLength = bytes.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  fail(`${label} raw ZIP end record is absent`);
}

function decodeExactZip(bytesValue, expectedNames, label) {
  const bytes = archiveBytes(bytesValue, label);
  const endOffset = findZipEnd(bytes, label);
  if (bytes.readUInt16LE(endOffset + 4) !== 0 || bytes.readUInt16LE(endOffset + 6) !== 0) {
    fail(`${label} multi-disk ZIP is not accepted`);
  }
  const diskEntries = bytes.readUInt16LE(endOffset + 8);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  const centralSize = bytes.readUInt32LE(endOffset + 12);
  const centralOffset = bytes.readUInt32LE(endOffset + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) fail(`${label} ZIP64 is not accepted`);
  if (diskEntries !== entryCount || entryCount === 0 || entryCount > MAX_ZIP_ENTRIES) fail(`${label} ZIP entry count is invalid`);
  if (centralOffset + centralSize !== endOffset) fail(`${label} ZIP central directory bounds are invalid`);

  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || bytes.readUInt32LE(cursor) !== 0x02014b50) fail(`${label} ZIP central directory is malformed`);
    const requiredVersion = bytes.readUInt16LE(cursor + 6);
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const diskStart = bytes.readUInt16LE(cursor + 34);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const variableEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (variableEnd > endOffset) fail(`${label} ZIP central directory is truncated`);
    if (requiredVersion >= 45 || diskStart !== 0 || localOffset === 0xffffffff || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      fail(`${label} ZIP64 or multi-disk entry is not accepted`);
    }
    if ((flags & 0x0001) !== 0 || (flags & ~(0x0800 | 0x0008 | 0x0006)) !== 0) fail(`${label} ZIP entry flags are not accepted`);
    if (method !== 0 && method !== 8) fail(`${label} ZIP compression method is not accepted`);
    if (method === 0 && (flags & 0x0006) !== 0) fail(`${label} stored ZIP entry has invalid compression flags`);
    if (compressedSize > MAX_EVIDENCE_ARCHIVE_BYTES || uncompressedSize > MAX_EVIDENCE_ENTRY_BYTES) fail(`${label} ZIP entry exceeds the size bound`);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = validateZipEntryName(strictUtf8(nameBytes, `${label} ZIP entry name`), label);
    if (entries.has(name)) fail(`${label} ZIP contains duplicate entries`);
    validateZipExtra(bytes.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength), label);

    if (localOffset + 30 > centralOffset || bytes.readUInt32LE(localOffset) !== 0x04034b50) fail(`${label} ZIP local header is malformed`);
    const localFlags = bytes.readUInt16LE(localOffset + 6);
    const localMethod = bytes.readUInt16LE(localOffset + 8);
    const localCrc = bytes.readUInt32LE(localOffset + 14);
    const localCompressedSize = bytes.readUInt32LE(localOffset + 18);
    const localUncompressedSize = bytes.readUInt32LE(localOffset + 22);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataOffset + compressedSize;
    if (localFlags !== flags || localMethod !== method || dataEnd > centralOffset) fail(`${label} ZIP local entry bounds are invalid`);
    if (!bytes.subarray(localOffset + 30, localOffset + 30 + localNameLength).equals(nameBytes)) fail(`${label} ZIP local and central names differ`);
    validateZipExtra(bytes.subarray(localOffset + 30 + localNameLength, dataOffset), label);
    if ((flags & 0x0008) === 0 && (localCrc !== expectedCrc || localCompressedSize !== compressedSize || localUncompressedSize !== uncompressedSize)) {
      fail(`${label} ZIP local and central metadata differ`);
    }

    const compressed = bytes.subarray(dataOffset, dataEnd);
    let contents;
    try {
      contents = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: MAX_EVIDENCE_ENTRY_BYTES });
    } catch {
      fail(`${label} ZIP entry decompression failed`);
    }
    if (contents.length !== uncompressedSize || crc32(contents) !== expectedCrc) fail(`${label} ZIP entry bytes do not match its directory metadata`);
    entries.set(name, contents);
    cursor = variableEnd;
  }
  if (cursor !== endOffset) fail(`${label} ZIP central directory contains trailing data`);
  const actualNames = [...entries.keys()].sort();
  const requiredNames = [...expectedNames].sort();
  if (actualNames.length !== requiredNames.length || actualNames.some((name, index) => name !== requiredNames[index])) {
    fail(`${label} ZIP does not contain the exact expected root entries`);
  }
  return entries;
}

function parseArchiveJson(bytes, label) {
  try {
    return JSON.parse(strictUtf8(bytes, label));
  } catch (error) {
    if (error instanceof GateError) throw error;
    fail(`${label} is invalid JSON`);
  }
}

export function decodePromotionEvidenceArchives({ resolution: resolutionValue, canaryArchiveBytes, monitorArchiveBytes }) {
  const identity = validateCloudflareCanaryUrl(record(resolutionValue, "promotion resolution").canaryUrl);
  const resolution = validatePromotionResolution(resolutionValue, identity);
  const canaryArchive = archiveBytes(canaryArchiveBytes, "canary evidence artifact");
  const monitorArchive = archiveBytes(monitorArchiveBytes, "monitor aggregate artifact");
  verifyArtifactArchiveDigest(canaryArchive, resolution.canaryArtifact, "canary evidence artifact");
  verifyArtifactArchiveDigest(monitorArchive, resolution.monitorArtifact, "monitor aggregate artifact");

  const canaryEntries = decodeExactZip(
    canaryArchive,
    ["canary-evidence.json", "release-manifest.json"],
    "canary evidence artifact",
  );
  const monitorEntries = decodeExactZip(monitorArchive, ["monitor.json"], "monitor aggregate artifact");
  const releaseManifestBytes = canaryEntries.get("release-manifest.json");
  if (releaseManifestBytes.length > MAX_RELEASE_MANIFEST_BYTES) fail("release manifest exceeds the size bound");
  return {
    canaryEvidence: parseArchiveJson(canaryEntries.get("canary-evidence.json"), "canary evidence"),
    releaseManifestBytes: Buffer.from(releaseManifestBytes),
    monitorEvidence: parseArchiveJson(monitorEntries.get("monitor.json"), "monitor evidence"),
  };
}

async function writeRawArtifactAtomically(pathValue, bytes, label) {
  const output = canonicalString(pathValue, `${label} output path`);
  const directory = dirname(output);
  const temporary = join(directory, `.${basename(output)}.${process.pid}.${Date.now()}.partial`);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
    await link(temporary, output);
  } catch {
    fail(`${label} could not be written atomically`);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
}

async function writeOutputs(path, values) {
  if (path === undefined) return;
  for (const [name, value] of Object.entries(values)) {
    const parsed = canonicalString(String(value), `workflow output ${name}`);
    if (parsed.includes("\n") || parsed.includes("\r")) fail(`workflow output ${name} contains a line break`);
    await appendFile(path, `${name}=${parsed}\n`, "utf8");
  }
}

async function verifyCanaryCommand(values, dependencies = {}) {
  const buildPath = canonicalString(values.build, "build evidence path");
  const artifactDirectory = canonicalString(values["artifact-directory"], "artifact directory");
  const output = canonicalString(values.output, "canary evidence output path");
  const manifestOutput = canonicalString(values["manifest-output"], "canary release manifest output path");
  const identity = validateCloudflareCanaryUrl(values["canary-url"]);
  const build = validateBuildResolution((await readJson(buildPath, "build evidence")).value);
  exact(sha(process.env.GITHUB_SHA, "canary workflow GITHUB_SHA"), build.releaseSha, "canary trusted workflow head SHA");
  positiveId(process.env.GITHUB_RUN_ID, "canary workflow run id");
  const tarFile = `ariada-wiki-${build.releaseSha}.tar.gz`;
  const tarPath = join(artifactDirectory, tarFile);
  const digestPath = join(artifactDirectory, `${tarFile}.sha256`);
  const manifestPath = join(artifactDirectory, "release-manifest.json");
  let tarBytes;
  let digestText;
  let localManifestBytes;
  try {
    [tarBytes, digestText, localManifestBytes] = await Promise.all([readFile(tarPath), readFile(digestPath, "utf8"), readFile(manifestPath)]);
  } catch {
    fail("immutable tar artifact, SHA-256 manifest, or release manifest is absent");
  }
  const tarSha256 = createHash("sha256").update(tarBytes).digest("hex");
  exact(digestText, `${tarSha256}  ${tarFile}\n`, "detached SHA-256 manifest");
  const archived = validateReleaseTarGzip({
    tarBytes,
    manifestBytes: localManifestBytes,
    releaseSha: build.releaseSha,
  });
  const remoteManifestBytes = await fetchReleaseManifest(dependencies.fetchImpl ?? fetch, identity);
  const releaseManifest = validateReleaseManifestCopies({
    artifactBytes: localManifestBytes,
    archivedBytes: archived.archivedManifestBytes,
    deployedBytes: remoteManifestBytes,
  }, {
    releaseSha: build.releaseSha,
  });
  const client = dependencies.client ?? new GitHubClient({
    repository: build.repository,
    token: process.env.GITHUB_TOKEN,
    fetchImpl: dependencies.fetchImpl ?? fetch,
  });
  const githubDeployment = await resolveCanaryDeployment(client, {
    identity,
    releaseSha: build.releaseSha,
    buildArtifactCreatedAt: build.buildArtifact.createdAt,
  });
  const nowMs = evaluationTime(dependencies.now ?? Date.now());
  if (Date.parse(githubDeployment.status.createdAt) > nowMs) fail("Cloudflare deployment status is future-dated");
  const startedAt = githubDeployment.status.createdAt;
  const verifiedAt = new Date(nowMs).toISOString();
  const evidence = {
    schemaVersion: 1,
    kind: CANARY_EVIDENCE_KIND,
    releaseSha: build.releaseSha,
    finalTarSha256: tarSha256,
    releaseManifestSha256: releaseManifest.sha256,
    contentSetSha256: releaseManifest.manifest.contentSetSha256,
    deploymentId: identity.deploymentId,
    hostname: identity.hostname,
    startedAt,
    verifiedAt,
  };
  await writeJson(output, evidence);
  await mkdir(dirname(manifestOutput), { recursive: true });
  await writeFile(manifestOutput, releaseManifest.bytes, { mode: 0o600 });
  await writeOutputs(values["github-output"], {
    "deployment-id": identity.deploymentId,
    "release-sha": build.releaseSha,
    "final-tar-sha256": tarSha256,
    "release-manifest-sha256": releaseManifest.sha256,
    "content-set-sha256": releaseManifest.manifest.contentSetSha256,
  });
  return evidence;
}

async function resolveBuildCommand(values, dependencies = {}) {
  const repository = repositoryName(values.repository);
  const client = dependencies.client ?? new GitHubClient({ repository, token: process.env.GITHUB_TOKEN, fetchImpl: dependencies.fetchImpl ?? fetch });
  const build = await resolveBuildEvidence(client, {
    pullRequestNumber: values["pull-request-number"],
    currentMainSha: values["current-main-sha"],
    now: dependencies.now ?? Date.now(),
  });
  await writeJson(canonicalString(values.output, "build resolution output path"), build);
  await writeOutputs(values["github-output"], {
    "artifact-id": build.buildArtifact.id,
    "run-id": build.buildWorkflow.id,
    "release-sha": build.releaseSha,
    "tar-file": `ariada-wiki-${build.releaseSha}.tar.gz`,
  });
  return build;
}

async function resolvePromotionCommand(values, dependencies = {}) {
  const repository = repositoryName(values.repository);
  const identity = validateCloudflareCanaryUrl(values["canary-url"]);
  const client = dependencies.client ?? new GitHubClient({ repository, token: process.env.GITHUB_TOKEN, fetchImpl: dependencies.fetchImpl ?? fetch });
  const nowMs = evaluationTime(dependencies.now ?? Date.now());
  const build = await resolveBuildEvidence(client, {
    pullRequestNumber: values["pull-request-number"],
    currentMainSha: values["current-main-sha"],
    now: nowMs,
  });
  const explicitArtifactIds = validateDistinctPromotionArtifactIds(
    values["canary-artifact-id"],
    values["monitor-artifact-id"],
  );
  const canary = await resolveTrustedArtifactById(client, {
    artifactId: explicitArtifactIds.canaryArtifactId,
    path: TRUSTED_GATE_WORKFLOW_PATH,
    event: "workflow_dispatch",
    releaseSha: build.releaseSha,
    defaultBranch: "main",
    name: canaryArtifactName(build.releaseSha, identity.deploymentId),
    label: "canary verification",
    resolutionTime: nowMs,
  });
  const monitor = await resolveTrustedArtifactById(client, {
    artifactId: explicitArtifactIds.monitorArtifactId,
    path: TRUSTED_MONITOR_WORKFLOW_PATH,
    event: "workflow_dispatch",
    releaseSha: build.releaseSha,
    defaultBranch: "main",
    name: monitorArtifactName(build.releaseSha, identity.deploymentId),
    label: "monitor aggregate",
    resolutionTime: nowMs,
  });
  if (Date.parse(canary.artifact.createdAt) < Date.parse(build.buildArtifact.createdAt)) fail("canary evidence predates the build artifact");
  if (Date.parse(monitor.artifact.createdAt) < Date.parse(canary.artifact.createdAt)) fail("monitor aggregate predates canary evidence");
  const gateWorkflow = await resolveWorkflow(client, TRUSTED_GATE_WORKFLOW_PATH);
  const currentRunId = positiveId(values["current-run-id"], "current production workflow run id");
  const productionWorkflow = validateWorkflowRun(
    await client.json(`/repos/${repository}/actions/runs/${currentRunId}`, "current production workflow run"),
    {
      workflowId: gateWorkflow.id,
      path: TRUSTED_GATE_WORKFLOW_PATH,
      event: "workflow_dispatch",
      releaseSha: build.releaseSha,
      defaultBranch: "main",
      repository,
      status: "in_progress",
      conclusion: null,
    },
  );
  const productionEnvironment = validateProductionEnvironment(
    await client.json(`/repos/${repository}/environments/${encodeURIComponent(PRODUCTION_ENVIRONMENT)}`, "production environment configuration"),
  );
  const productionApprovals = normalizeProductionApprovals(
    await client.json(`/repos/${repository}/actions/runs/${currentRunId}/approvals`, "current production approvals"),
  );
  const githubDeployment = await resolveCanaryDeployment(client, {
    identity,
    releaseSha: build.releaseSha,
    buildArtifactCreatedAt: build.buildArtifact.createdAt,
  });
  const resolution = validatePromotionResolution(
    {
      schemaVersion: 2,
      kind: PROMOTION_RESOLUTION_KIND,
      repository,
      defaultBranch: "main",
      releaseSha: build.releaseSha,
      canaryUrl: identity.raw,
      build,
      canaryWorkflow: canary.run,
      canaryArtifact: canary.artifact,
      monitorWorkflow: monitor.run,
      monitorArtifact: monitor.artifact,
      githubDeployment,
      productionWorkflow,
      productionEnvironment,
      productionApprovals,
      resolvedAt: new Date(nowMs).toISOString(),
    },
    identity,
  );
  await writeJson(canonicalString(values.output, "promotion resolution output path"), resolution);
  await writeOutputs(values["github-output"], {
    "canary-artifact-id": canary.artifact.id,
    "canary-run-id": canary.run.id,
    "monitor-artifact-id": monitor.artifact.id,
    "monitor-run-id": monitor.run.id,
    "release-sha": build.releaseSha,
  });
  return resolution;
}

async function downloadArtifactCommand(values, dependencies = {}) {
  const repository = repositoryName(values.repository);
  const artifactId = positiveId(values["artifact-id"], "artifact download id");
  const bytes = dependencies.client === undefined
    ? await downloadArtifactArchive({
      repository,
      token: process.env.GITHUB_TOKEN,
      artifactId,
      fetchImpl: dependencies.fetchImpl ?? fetch,
    })
    : await dependencies.client.artifactArchive(artifactId, "selected evidence artifact");
  await writeRawArtifactAtomically(values.output, bytes, "selected evidence artifact");
  return { artifactId, bytes: bytes.length };
}

async function promotionGateCommand(values, dependencies = {}) {
  const resolution = (await readJson(canonicalString(values.resolution, "promotion resolution path"), "promotion resolution")).value;
  const decoded = decodePromotionEvidenceArchives({
    resolution,
    canaryArchiveBytes: await readBytes(canonicalString(values["canary-archive"], "canary archive path"), "canary archive"),
    monitorArchiveBytes: await readBytes(canonicalString(values["monitor-archive"], "monitor archive path"), "monitor archive"),
  });
  const result = evaluatePromotionGate({
    resolution,
    canaryEvidence: decoded.canaryEvidence,
    releaseManifestBytes: decoded.releaseManifestBytes,
    monitorEvidence: decoded.monitorEvidence,
    now: dependencies.now ?? Date.now(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      repository: { type: "string" },
      "pull-request-number": { type: "string" },
      "current-main-sha": { type: "string" },
      "current-run-id": { type: "string" },
      "canary-url": { type: "string" },
      output: { type: "string" },
      "github-output": { type: "string" },
      build: { type: "string" },
      "artifact-directory": { type: "string" },
      "canary-artifact-id": { type: "string" },
      "monitor-artifact-id": { type: "string" },
      "artifact-id": { type: "string" },
      "manifest-output": { type: "string" },
      resolution: { type: "string" },
      "canary-archive": { type: "string" },
      "monitor-archive": { type: "string" },
    },
  });
  const command = positionals[0];
  if (positionals.length !== 1) fail("exactly one gate command is required");
  if (command === "resolve-build") await resolveBuildCommand(values);
  else if (command === "verify-canary") await verifyCanaryCommand(values);
  else if (command === "resolve-promotion") await resolvePromotionCommand(values);
  else if (command === "download-artifact") await downloadArtifactCommand(values);
  else if (command === "promotion-gate") await promotionGateCommand(values);
  else fail(`unknown gate command: ${command ?? "<missing>"}`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`Ariada Wiki RC gate failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
