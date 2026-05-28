<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# Retroactive GenAI Review Plan

## Status
Active

## Date
2026-05-25

## Scope
This plan covers public repository history before the two-phase GenAI
provenance pipeline was adopted on 2026-05-25.

The initial public baseline is `ariada-org/ariada` `main` at:

- `284ed3b172a88fbffa6becfd3c8a8212b46fd122`
  `fix(core-browser): include aria-labelledby outline elements`

The repository will not rewrite public history. Earlier commits remain in place.
This review campaign records a forward disclosure and human verification trail
for the already-published code and documentation.

## Why This Exists
Some pre-2026-05-25 public commits were GenAI-assisted and founder-reviewed, but
per-commit prompt/output logs were not consistently recorded in the stricter
form now required by the project. The correction is to review and document the
published work honestly, not to fabricate retroactive prompt logs or rewrite
public commits.

## Review Method
Each review slice produces a normal public commit with subject:

```text
review(<scope>): retro-review pre-policy GenAI-assisted work
```

Each review commit must add or update a durable report under
`docs/provenance/reviews/`.

Every report must state:

- reviewed commit range or file set;
- whether the reviewed work was known or likely GenAI-assisted;
- external audit signals considered before review;
- what the human reviewer checked;
- test/build/lint commands and outcomes;
- standards or primary sources checked, where relevant;
- changes required before the slice can be treated as reviewed;
- residual uncertainty, especially where original prompts or raw outputs are not
  available.

The review commit does not claim the old work was human-only. It records that
the old work has now received explicit human verification.

AI-generated retro-review drafts are not human review. They may collect facts,
run commands, identify candidate issues, and propose refactors, but they remain
draft evidence until Alexander Brichkin reviews and signs off the report.

Review commits should not add decorative comments to source code merely to mark
old work as reviewed. Source comments are added only when the human review finds
a genuinely non-obvious design, standards, security, or interoperability reason
that future maintainers need to see next to the code.

The default evidence location is a review report, not inline source comments.

## External Audit Signal Intake

Before final retro-review, collect available automated and third-party signals:

- GitHub Actions checks for the relevant public SHA: CI, DCO, CodeQL, gitleaks,
  OpenSSF Scorecard, actionlint, SBOM, release, and dogfood workflows where
  applicable;
- CodeRabbit review comments on related PRs, if the commit entered through a PR;
- SonarCloud quality gate and open issues, if the service has indexed the
  relevant branch or current main;
- Dependabot alerts and dependency update PRs;
- REUSE compliance, license metadata, and SPDX coverage;
- local replay of build, lint, typecheck, tests, actionlint, shellcheck,
  gitleaks, and package-specific commands where the old tree can support them.

If a service was not active when the old commit landed, the report must say so.
The absence of an old service result is not treated as a pass.

New audit services may be added before broad retro-review, but adding the
service configuration is new work. If AI drafts that configuration, it follows
the two-phase GenAI pipeline before release.

## Draft Report Lifecycle

Public `genai-drafts/*` branches are required for new GenAI-assisted work after
2026-05-25. They are not required for retro-review of old public commits, because
creating public draft branches after the fact would imply a provenance sequence
that did not exist at the time.

AI-prepared retro-review drafts for old commits may remain local work products
until Alexander Brichkin reviews them. They should not be published as final
human review evidence on `main`.

Final location after Alexander's attestation:

- branch/path for release: normal release path to `main`;
- path: `docs/provenance/reviews/<date>-<scope>.md`;
- subject: `review(<scope>): verify pre-policy GenAI-assisted work`;
- body records the founder attestation and, when applicable, references the
  local draft/report source used for the review.

The draft may contain candidate findings later rejected by the human reviewer.
The final report must state which draft findings were accepted, rejected, or
left unresolved.

## Review Granularity

Use one review report per public commit when the commit changed high-risk
surfaces:

- release or publishing automation;
- security, secrets, permissions, or supply-chain configuration;
- public legal/funding/license claims;
- scanner correctness or standards interpretation;
- code that is hard to test by black-box behavior.

Use one review report per module or commit range for lower-risk slices:

- generated documentation pages with the same template;
- mechanical REUSE/SPDX metadata;
- examples that are covered by the same command replay;
- package boilerplate that shares the same build/test evidence.

Every report must still list the exact public commit SHAs or file set it covers.

## Human Refactoring During Review

Retro-review may produce human-authored refactoring commits, including commits
that increase abstraction, but only when the abstraction earns its cost.

Allowed cases:

- duplicated logic is collapsed into a named helper with the same observable
  behavior;
- standards-specific logic is separated from transport, rendering, or test
  harness code;
- high-risk release/security paths get smaller units that are easier to audit;
- package boundaries become clearer without importing proprietary concepts.

Required discipline:

- keep the review report and the refactor as separate commits unless the code
  change is trivial;
- reference the reviewed public SHA and the review report from the refactor
  commit body;
- prove behavior preservation with tests, typecheck, lint, or command replay;
- describe the abstraction boundary and why it is better than the old shape;
- do not mix behavior changes into a `refactor:` commit.

If the refactor changes behavior, classify it as `fix:` or `feat:` and include
the corresponding tests. If GenAI is used to draft the refactor, it starts a new
GenAI draft cycle and is not a human verification commit.

A human-authored refactor may follow a retro-review immediately if Alexander
performs that refactor manually and records the reviewed SHA/report. A
GenAI-drafted refactor follows the two-phase GenAI pipeline.

## Review Priority

1. Public trust surface:
   - `README.md`
   - `AI_USAGE.md`
   - `LICENSE`, `REUSE.toml`, `.reuse/`, `LICENSES/`
   - public badges, funding claims, grant-facing statements
2. Release and security automation:
   - `.github/workflows/`
   - `.husky/`
   - `scripts/`
   - Changesets and npm publishing configuration
3. Core scanner runtime:
   - `packages/core-engine`
   - `packages/core-browser`
   - `packages/core-playwright`
   - `packages/wcag-rules-extended`
4. Evidence and reporting packages:
   - `packages/ariada-evidence-emitter`
   - `packages/ariada-vpat-html-renderer`
   - `packages/scan-report-html`
   - `packages/ariada-statement-generator`
5. CLI, adapters, and integrations:
   - `packages/ariada-cli`
   - `packages/eaa-pipeline`
   - `packages/ariada-test-adapters`
   - `packages/ariada-mcp-server`
   - `packages/vscode-extension`
6. Documentation and examples:
   - `docs/`
   - `examples/`
   - package READMEs

## Review Axes
Each slice uses the same five review axes:

- Correctness: does the code or claim do what it says?
- Readability: can a maintainer understand it without the original agent
  session?
- Architecture: does it fit the package boundary and OSS/proprietary boundary?
- Security and legal hygiene: no secrets, no false claims, FLOS-compatible,
  no unsafe network/auth behavior.
- Reproducibility: commands, fixtures, and CI gates are enough for another
  contributor to repeat the result.

## Done Criteria
A pre-policy area is considered retro-reviewed only when:

- a report exists under `docs/provenance/reviews/`;
- the report identifies the reviewed baseline;
- all applicable local tests pass or failures are documented as blockers;
- false or unverifiable public claims are removed or corrected;
- the report is committed and signed off by the human reviewer.

## Founder Attestation Protocol

Alexander Brichkin may confirm retro-review after reading the review packet and
the relevant diff/command summary.

Before a human-labeled commit is created, the operator must generate a review
packet that includes a stable Diff ID and a self-contained summary of what is
being reviewed. The packet-generation tooling is part of the maintainer's
internal workflow.

The review packet protocol is mandatory for this campaign:

- generate a stable Diff ID over the exact diff being reviewed (sha256 of the
  unified diff, or sha256 of the sorted per-file SHA-256 manifest for
  multi-file reviews);
- assemble a packet containing: changed-file list, the unified diff, a
  written summary of what the reviewer is being asked to attest, and any
  command outputs that verify the claim (typecheck, test, build, audit);
- present the packet to the named reviewer through the operator's
  established communication channel;
- include the exact attestation text wording in the packet so the reviewer
  can quote it verbatim;
- reject generic approvals that do not quote the Diff ID.

Acceptable attestation format:

```text
I, Alexander Brichkin, reviewed Diff ID <diff-id> (<scope>), checked the linked
diff and verification output, and approve this as my human review sign-off for
commit creation.
```

After that explicit attestation, the operator may create the review commit using
Alexander Brichkin's configured author/sign-off identity. The commit body must
record:

- the Diff ID;
- the report path;
- the reviewed SHA or file set;
- the fact that the named reviewer approved the Diff ID;
- the date and local timezone of the attestation.

Generic approvals such as "ok", "go", or "read it" are not enough for a human
review sign-off.

## Relationship To The 72-Hour Rule
The 72-hour GenAI draft to human-review window applies to new substantive
GenAI-generated work created after 2026-05-25 before that work is treated as
release-ready.

It does not block retroactive human review of older public commits. Already
published code can be reviewed immediately when Alexander Brichkin performs the
review and signs off the report.

For pre-2026-05-25 public commits, the elapsed-time condition is already
satisfied by history. The remaining requirement is explicit human verification
evidence: the reviewed SHA or file set, checks performed, results, corrections,
and sign-off.

For older public commits, this review campaign provides a forward human
verification record. It does not reconstruct missing prompts and does not change
the fact that earlier provenance was incomplete.

If the retro-review identifies a new fix or refactor and that new change is
GenAI-drafted, the new fix/refactor follows the two-phase GenAI pipeline and the
72-hour waiting period applies to that new draft.
