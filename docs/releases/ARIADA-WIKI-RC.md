# Ariada Wiki release-candidate gate

This gate assembles and verifies a standalone Ariada Wiki release candidate. It never deploys production.

## Components and identities

- `apps/ariada-wiki` is the standalone Wiki build, validation, package, and immutable-canary target.
- `apps/ariada-org` is the separately validated Ariada main-site companion. It is not the Wiki.
- `ci/wiki-rc-content-manifest.mjs` creates and validates the deterministic public-content attestation.
- `.github/workflows/ariada-wiki-rc.yml` owns stable PR checks, post-merge assembly, canary verification, and the production approval gate.
- `.github/workflows/ariada-wiki-monitor.yml` probes the immutable canary every five minutes and creates the trusted monitor aggregate.
- `ci/wiki-rc-gate.mjs` resolves trusted GitHub provenance and evaluates promotion evidence.
- `ci/wiki-rc-monitor.mjs` byte-verifies the deployed manifest and its deterministic content shard.
- `ci/wiki-rc-monitor-aggregate.mjs` validates every candidate run/sample artifact and computes exact union coverage.

Two SHA identities are intentionally distinct:

- `finalPrHeadSha` is the final PR head. A GitHub PR approval must have `commit_id` equal to this SHA.
- `releaseSha` is the post-merge protected `main` SHA. It must equal the merged PR's GitHub `merge_commit_sha` and the live `main` ref.

The post-merge workflow, immutable tar, detached tar digest, content manifest, canary workflow, GitHub deployment, Cloudflare status, every monitor sample, aggregate, and production-gate workflow all bind to `releaseSha`. PR approval remains bound to `finalPrHeadSha`.

## Stable pull-request checks

Branch protection can require these invariant check names:

- `Ariada Wiki RC / Gate governance`
- `Ariada Wiki RC / Wiki validation`
- `Ariada Wiki RC / Companion validation`

Gate governance runs:

```text
node --test ci/wiki-rc-content-manifest.test.mjs ci/wiki-rc-gate.test.mjs ci/wiki-rc-monitor.test.mjs ci/wiki-rc-monitor-aggregate.test.mjs
```

It also runs actionlint 1.7.12, verified by a pinned SHA-256 download, against both release workflows. Every GitHub Action is pinned to a full commit SHA.

On a clean runner, Wiki validation tests, builds, and only then checks `apps/ariada-wiki`. Companion validation separately runs the Ariada main-site contract tests and a successful `apps/ariada-org` build. Its baseline Astro check is not an RC eligibility gate. The protected-main Wiki artifact job uses the same build-before-check order.

## Content manifest contract

After the Wiki build and check, but before tar creation, the post-merge job writes `apps/ariada-wiki/dist/.well-known/ariada-release.json`. It copies those exact bytes to `.wiki-rc/release-manifest.json` and then creates the final tar. Nothing adds or rewrites a manifest after packaging.

Schema v1 has exactly these root fields:

```json
{
  "schemaVersion": 1,
  "kind": "ariada-wiki-release",
  "releaseSha": "<40 lowercase hex>",
  "generatedAt": "<canonical UTC ISO-8601 commit time>",
  "contentSetSha256": "<64 lowercase hex>",
  "files": []
}
```

`files` is non-empty and strictly sorted by root-relative POSIX `path`. Every entry has exactly `path`, origin-relative canonical `url`, `sha256`, and `bytes`. `index.html` maps to `/`, and each nested `index.html` maps to its trailing-slash route. The monitor joins these paths to the immutable canary origin. SHA-256 and byte length cover the exact file bytes.

The file set contains every regular publicly fetchable dist file except the manifest itself and Cloudflare control paths `_headers`, `_redirects`, `_routes.json`, `_worker.js`, and `_worker.js/**`. Symbolic links, non-regular files, duplicate paths/URLs, unsorted entries, extra public tar entries, and missing files fail closed. Manifests are bounded to 20,000 files, and each public file is bounded to 64 MiB.

`contentSetSha256` is SHA-256 over the UTF-8 bytes of `JSON.stringify(files)` after exact validation and sorting. Manifest bytes are canonical UTF-8 `JSON.stringify(manifest)` followed by one LF. `generatedAt` is the protected-main commit timestamp, so repeated assembly of the same content and `releaseSha` produces identical bytes.

The final deterministic USTAR+gzip archive includes the deployed manifest. Canary verification validates every tar entry against the manifest, compares the manifest in the tar with `.wiki-rc/release-manifest.json`, and compares both byte-for-byte with the immutable deployment response.

## Post-merge RC sequence

1. Obtain a GitHub approval whose review `commit_id` is the final PR head, then merge the PR into protected `main`.
2. The trusted `push` run at `releaseSha` builds before checking `apps/ariada-wiki`, generates the content manifest in dist, validates it, creates `ariada-wiki-<releaseSha>.tar.gz`, and computes its detached SHA-256 file.
3. The run uploads `ariada-wiki-rc-<releaseSha>` containing the final tar, detached tar SHA-256 file, and exact `release-manifest.json` copy.
4. The canary deployment process downloads that immutable artifact, verifies the detached tar SHA-256, extracts the final tar, and deploys the extracted directory without additions, rewrites, rebuilding, or manifest injection. It targets an immutable URL such as `https://a1b2c3d4.ariada-wiki.pages.dev`.
5. Record the canary as a GitHub deployment for environment `ariada-wiki-canary`, ref and SHA `releaseSha`, transient true, and production false. Its successful deployment status uses the immutable origin as `environment_url`. Deployment creator and status creator provide GitHub and Cloudflare actor evidence.
6. On protected `main`, dispatch `Ariada Wiki RC` operation `verify-canary` with the merged PR number and immutable URL.
7. Verification derives the merged PR, current `main`, trusted post-merge workflow, unique artifact ID/API digest, and deployment/status from GitHub APIs. It hashes the tar, validates all tar content, and fetches `/.well-known/ariada-release.json` without redirects. The artifact, archived, and deployed manifest bytes must be identical.
8. Verification uploads release-specific artifact `ariada-wiki-canary-evidence-<releaseSha>` with exactly two ZIP-root entries: `canary-evidence.json` and `release-manifest.json`. Canary schema v1 has exactly `schemaVersion`, `kind`, `releaseSha`, `finalTarSha256`, `releaseManifestSha256`, `contentSetSha256`, `deploymentId`, `hostname`, `startedAt`, and `verifiedAt`; `kind` is `ariada-wiki-canary-evidence`. Trusted workflow/artifact/deployment provenance comes from GitHub APIs rather than claims inside this compact evidence object.
9. Configure monitor repository variables exactly as `ARIADA_WIKI_RELEASE_SHA`, `ARIADA_WIKI_RELEASE_TAR_SHA256`, `ARIADA_WIKI_RELEASE_MANIFEST_SHA256`, `ARIADA_WIKI_RELEASE_CONTENT_SET_SHA256`, `ARIADA_WIKI_RELEASE_DEPLOYMENT_ID`, `ARIADA_WIKI_CANARY_URL`, `ARIADA_WIKI_MONITOR_DISPATCH_ACTOR`, `ARIADA_WIKI_CANARY_ARTIFACT_ID`, and `ARIADA_WIKI_MONITOR_ARTIFACT_ID`. The canary verification summary prints its nonsecret identity values and exact canary `upload-artifact` ID. Set `ARIADA_WIKI_CANARY_ARTIFACT_ID` to that number. The actor value is Senko's exact GitHub login; `ARIADA_WIKI_MONITOR_ARTIFACT_ID` is populated after aggregation.
10. Near immutable-canary start, dispatch operation `promotion-gate` on protected `main` with the same PR number and URL. The job enters protected non-production environment `ariada-wiki-promotion-approval`. GitHub creates a standard environment deployment record for this job. Ariada treats that record solely as promotion-approval evidence because the environment is explicitly non-production; it is not the Ariada product production deployment and MUST NOT be presented as one. Its 2880-minute wait runs concurrently with soak.
11. Keep `main` at `releaseSha`. Every five-minute monitor run uploads `ariada-wiki-monitor-sample-<releaseSha>`, byte-verifies the deployed manifest, its release/content identities, and the same tar/deployment identity, then checks the deterministic shard selected from the sorted files. The shard number is the trusted five-minute bucket modulo 576; files are assigned by sorted index modulo 576. Scheduled fallback and dispatch samples use the same rule.
12. After at least 172800 seconds and at least 576 valid samples, Senko dispatches the trusted aggregate. First/final freshness, maximum 360-second gap, zero failed samples, exact manifest identity per sample, and aggregate freshness remain mandatory.
13. The release-specific `ariada-wiki-monitor-evidence-<releaseSha>` artifact contains `monitor.json`. Its exact schema carries root `releaseSha`, `finalTarSha256`, deployment identity, nested `canary` provenance, nested `manifest` identity, selected `samples`, every candidate `producerRuns` record, `window`, and `coverage`. `coverage.files` is the exact sorted, deduplicated union of successfully byte/hash-verified `samples[].checkedFiles` and must equal the release manifest's complete `files` array. Missing, extra, altered, non-shard, or identity-mismatched entries fail promotion.
14. The aggregate upload summary exposes its numeric artifact ID. Set `ARIADA_WIKI_MONITOR_ARTIFACT_ID` to that exact number before approving the waiting job. Required reviewer `predopta` acts only after the fresh aggregate and variable update exist. Once both the environment wait timer and approval are satisfied, the runner resolves all evidence, downloads each selected artifact ID through the GitHub REST archive endpoint into a new atomic raw-ZIP file, and executes the fail-closed gate. The token is sent only to the GitHub API request, not to the signed HTTPS archive redirect.
15. Before opening either ZIP central directory or parsing any payload, the gate computes SHA-256 over both untouched downloaded ZIP byte sequences and compares each with its selected artifact metadata `digest`. It then accepts exactly `canary-evidence.json` plus `release-manifest.json` in the canary ZIP and exactly `monitor.json` in the aggregate ZIP. Unsafe paths, aliases, duplicate or extra entries, unsupported/ZIP64 structures, decompression or CRC mismatches, and malformed JSON fail closed. `actions/download-artifact` extraction or its digest-warning behavior is not part of this promotion trust boundary.
16. A passing gate is authorization evidence only. Actual production deployment is a separate post-gate action absent from this workflow.

The canonical canary URL is not sensitive. Whitespace, credentials, ports, paths, query strings, fragments, HTTP, mutable branch hosts, and hosts outside the exact eight-lowercase-hex Ariada Wiki Pages format are rejected. Dispatch jobs execute only on protected `main` and receive no deployment secrets.

## Promotion requirements

Promotion requires all of the following:

- The PR is closed and merged; trusted head/base repositories and base branch match the repository and `main`.
- Live current `main`, workflow `GITHUB_SHA`, GitHub `merge_commit_sha`, and `releaseSha` are identical.
- At least one PR approval is bound to the final PR head and predates merge.
- The post-merge build workflow path, workflow ID, `push` event, successful conclusion, repository, branch, and `head_sha` are exact.
- Build, canary, and monitor artifacts have deterministic names, unique IDs, immutable API digests, exact producer runs, and `expired` exactly false. Each canonical `expires_at` must be strictly later than the resolution timestamp and strictly later than `created_at`; equality, past/invalid timestamps, future creation, and contradictory metadata fail closed.
- Canary and aggregate metadata and raw archives are fetched only through explicit numeric IDs from `ARIADA_WIKI_CANARY_ARTIFACT_ID` and `ARIADA_WIKI_MONITOR_ARTIFACT_ID`. The gate fetches `/actions/artifacts/<id>` directly, validates the exact release-specific name, originating run ID, trusted workflow path and workflow ID, protected-main ref, `head_sha`, event, conclusion, API digest, expiry, and release payload identities, then fetches `/actions/artifacts/<id>/zip`. It hashes the untouched raw ZIP and requires exact equality with the API `sha256:` digest before extraction. It never lists canary or aggregate artifacts by name and never requires repository-global name uniqueness.
- Canary and monitor artifact IDs must differ. A retained old-release artifact, failed retry, wrong producer, or reused ID fails before payload claims can authorize promotion.
- Canary workflow `workflowHeadSha` is exactly `releaseSha`; ambiguous candidates are rejected.
- `finalTarSha256`, manifest byte SHA-256, content-set SHA-256, deployed manifest, compact canary evidence, every selected sample, and aggregate identities all match.
- Every manifest-listed file is present in the tar with exact bytes/hash, and aggregate union coverage equals every exact manifest entry.
- At least 576 valid samples cover at least 172800 seconds at explicit 300-second cadence, with no gap over 360 seconds, no failure, a recent final sample, and a recent aggregate.
- Canary evidence is no older than 259200 seconds, preventing stale soak reuse.
- Existing environment `ariada-wiki-promotion-approval` has wait timer 2880, required reviewer `predopta`, `prevent_self_review` true, and protected branches only.
- Current-run approval history contains `ariada-wiki-promotion-approval` in `environments[]`.
- The approving reviewer differs from the PR author, merger/final code pusher, post-merge build actor, artifact producer, GitHub deployment creator, Cloudflare deployment actor, canary actors, every selected or fallback sample producer and triggering actor, monitor aggregate actors, and production dispatch/workflow actors.

Every actor is mandatory trusted API evidence. Operator-supplied JSON flags, actor claims, run/artifact names, SHAs, digests, deployment IDs, monitor summaries, or coverage claims are not accepted. Missing, malformed, stale, too-young, failed, mismatched, ambiguous, incomplete, or noncanonical evidence fails closed.

## Repository assumptions

- Default branch is protected `main`.
- Environment `ariada-wiki-promotion-approval` already exists with wait timer 2880, required reviewer `predopta`, `prevent_self_review` true, and protected branches only.
- The Cloudflare integration creates the trusted GitHub canary deployment and successful status described above.
- Monitor and promotion configuration uses exactly `ARIADA_WIKI_RELEASE_SHA`, `ARIADA_WIKI_RELEASE_TAR_SHA256`, `ARIADA_WIKI_RELEASE_MANIFEST_SHA256`, `ARIADA_WIKI_RELEASE_CONTENT_SET_SHA256`, `ARIADA_WIKI_RELEASE_DEPLOYMENT_ID`, `ARIADA_WIKI_CANARY_URL`, `ARIADA_WIKI_MONITOR_DISPATCH_ACTOR`, `ARIADA_WIKI_CANARY_ARTIFACT_ID`, and `ARIADA_WIKI_MONITOR_ARTIFACT_ID`.
- The immutable deployment hostname is `<eight lowercase hex>.ariada-wiki.pages.dev` and serves the exact archived manifest at `/.well-known/ariada-release.json`.
- The monitor/aggregate producer implements the schema fields and deterministic shard/union rules above; the gate rejects aggregates that omit them.
- `GITHUB_TOKEN` has read-only access to contents, pull requests, actions, deployments, environment configuration, and current-run approvals. No `CANARY_URL` secret exists or is required.
