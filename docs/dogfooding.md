<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# Dogfooding — ariada audits ariada (progressive wiring)

The reusable GitHub Actions workflow we publish at `ariada-org/ariada/.github/workflows/eaa-audit.yml` is the same workflow we exercise against **our own** OSS landing at `ariada.org`. The loop is shipping in stages — building blocks have landed; the per-pull-request blocking gate and full multi-domain extension are on the visible roadmap. The authoritative day-of-truth answer to «what is wired right now?» is the architecture diagram on the repo front page (the README) — kept in lock-step with the actual workflow files in `.github/workflows/`.

This page explains the loop, what each block actually does **today**, what is **in-flight** on the milestone-1 path, what is on the **roadmap** beyond that (multi-domain, community-jurisdiction plugins), the standards basis, and how a reader can reproduce the available checks locally.

---

## The loop

```text
   ┌────────────────────────────────────────────────────────────────────┐
   │                                                                    │
   │       pull request lands on ariada-clean-main                      │
   │                            │                                       │
   │                            ▼                                       │
   │       ci.yml  → build  → lint  → typecheck  → vitest               │
   │                            │                                       │
   │                            ▼                                       │
   │       packages/wcag-rules-extended  →  rule pack rebuilt           │
   │                            │                                       │
   │                            ▼                                       │
   │       apps/ariada-org  → astro build  → static dist/               │
   │                            │                                       │
   │                            ▼                                       │
   │       scripts/self-cert-ariada-org.mjs                             │
   │           - load each dist/ page into happy-dom                    │
   │           - run @ariada-org/wcag-rules-extended rules              │
   │           - produce audits/self-cert/YYYY-MM-DD-ariada-org.json    │
   │           - produce audits/self-cert/YYYY-MM-DD-ariada-org.md      │
   │                            │                                       │
   │                            ▼                                       │
   │       reusable eaa-audit.yml callable for any consumer site        │
   │           - same rule pack                                         │
   │           - same heuristics                                        │
   │           - same SARIF output schema                               │
   │                            │                                       │
   │                            ▼                                       │
   │       SARIF report uploaded to GitHub code-scanning                │
   │       PR comment posted summarising any new violations             │
   │                            │                                       │
   │           ┌────────────────┴────────────────┐                      │
   │           ▼                                 ▼                      │
   │       violations = 0                  violations > 0                │
   │           │                                 │                      │
   │           ▼                                 ▼                      │
   │       merge unblocked                  pull request blocks         │
   │       (regression fix needed before merge)                         │
   │                                                                    │
   └────────────────────────────────────────────────────────────────────┘
```

The intent is a one-way contract — a regression in our published rule definitions should surface as a CI failure on the pull request that introduced it, before the change reaches users on npm. **As of this writing, the loop is wired up to the artefact-producing layer; the per-pull-request blocking gate is in-flight on the milestone-1 path.** See the next section for the precise current-vs-roadmap split.

---

## Current wiring state (honest, point-in-time)

What an evaluator or contributor will actually find when they clone the repo today, block by block:

| Loop block                                            | State          | Notes                                                                                                                                                                                                          |
|-------------------------------------------------------|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `eaa-audit.yml` reusable workflow                     | shipped        | Callable via `uses: ariada-org/ariada/.github/workflows/eaa-audit.yml@v0.1.0-rc.1` — verified path resolves on the canonical tag.                                                                              |
| `dogfood-self-scan.yml` weekly + on-demand            | shipped        | Runs Monday 06:00 UTC + `workflow_dispatch`. **Not** triggered on every push today — cadence-based for now.                                                                                                    |
| `scripts/self-cert-ariada-org.mjs` static-DOM scanner | shipped        | Produces `audits/self-cert/YYYY-MM-DD-ariada-org.{json,md}`. Sister script `scripts/self-cert-scan.mjs` does the same for the sibling landing.                                                                |
| Accessibility statement template                       | shipped        | `apps/ariada-org/src/pages/accessibility.astro` consumes the artefact format; honest non-conformance disclosure in place.                                                                                      |
| Cross-tool baseline (axe-core + pa11y)                 | shipped        | One-off baseline at `docs/audits/2026-05-15-wcag-cross-tool-audit.md`. Re-run cadence is part of milestone-1.                                                                                                  |
| Per-PR blocking gate (`fail-on: serious,critical`)    | **in-flight**  | Today the gate is `fail-on: critical` only so artefacts continue to be produced during early development. Tightening to `serious,critical` and triggering on every PR is part of milestone-1 acceptance.       |
| First npm publish of `@ariada-org/wcag-rules-extended` | **in-flight**  | The dogfood workflow currently builds the rule pack from the local workspace via `pnpm`. First npm publish is a milestone-1 deliverable; until then `workflow_dispatch` runs against a pinned local build.    |
| Auto-regeneration of statement page on rule-pack bump  | **in-flight**  | Statement page rebuilds on each landing deploy from the latest scan artefact. Triggering a re-deploy automatically on each rule-pack version bump is part of milestone-1.                                      |
| Multi-domain orchestrator                              | reference only | `@ariada-org/multi-domain` ships a **single-jurisdiction reference orchestrator** plus a published `JurisdictionPlugin` extension contract. Multi-jurisdiction-in-one-pass is explicit roadmap, not shipped. |
| Community jurisdiction plugins (AODA, JIS X 8341-3)    | roadmap        | Named in the multi-domain package README as the first two community-targeted plugins. Not in the workspace today.                                                                                              |
| Same loop for sibling landings beyond `ariada.org`     | partial        | `scripts/self-cert-scan.mjs` is in place for the sibling landing's static build; CI wiring of the sibling scan is on the same milestone-1 path as the `ariada.org` PR-blocking gate.                          |

The shape of the table reflects an honest engineering reality: shipping a recursive-self-certification loop end-to-end means landing several building blocks first, then wiring them into the blocking-gate. We have the blocks; we are wiring.

---

## What gets self-certified

The rule pack covers three sectoral packs today (banking digital channels, e-commerce checkout, accessibility statements) plus a small set of shared rules used across all three. Categories that the static scanner detects on `ariada.org` build output:

- **CSS contrast** — text-against-background contrast ratios for body copy and link text, using the WCAG 1.4.3 (AA) thresholds.
- **ARIA usage** — invalid roles, dangling `aria-labelledby` references, conflicting `aria-hidden` on focusable elements, mis-nested landmarks.
- **Semantic HTML** — heading hierarchy gaps, button-vs-link confusion (`<a>` with no `href` instead of `<button>`), missing `<main>` landmark on top-level pages.
- **Focus order + visible focus** — tab-order matches DOM order, `:focus-visible` selector present on interactive elements.
- **Form labelling** — every input has a programmatic accessible name (`<label for=>`, `aria-label`, `aria-labelledby`, or wrapping label). Used heavily by the checkout pack.
- **Language declaration** — `<html lang>` is present and matches the page locale; the Nordic-script-gate fires for `lang="sv"`, `nb`, `da`, `fi`.
- **Accessibility statement page** — for `/accessibility/` specifically, the statement-generator rules require a non-conformance disclosure section, a feedback contact (mailto / tel / contact-page link), the date of last revision, and the enforcement-body reference (DIGG for Sweden, equivalent for other jurisdictions).
- **Link / button text uniqueness within page** — duplicate visible labels are flagged unless they share a destination.
- **Image alt-text presence** — every `<img>` outside a decorative context has a non-empty `alt` attribute; SVG content has `role="img"` + `aria-label`.

For each rule, the per-rule documentation under `packages/wcag-rules-extended/docs/rules/` lists the underlying WCAG Success Criterion, the EN 301 549 v3.2.1 paragraph, and the EAA Annex I § cross-reference. The accessibility statement generator emits these citations into the published statement at `ariada.org/accessibility/` so a reader can trace any disclosed item to the standards layer.

---

## What our tool can NOT yet self-check

Honest disclosure of scope limits — these items are part of WCAG 2.2 AA but are out of reach of a static happy-dom scanner against a built site, and are tracked manually or excluded from the automated layer:

- **Cognitive criteria requiring human judgement.** WCAG 2.4.7 Focus Visible interacts with the design intent in ways a static rule cannot fully evaluate; we check that a `:focus-visible` style exists but not that the resulting visual indicator meets the perceptual threshold. WCAG 1.4.10 Reflow at 320 CSS px requires a real viewport — handled by a separate Playwright job on the landing's full template inventory, not by the static scanner.
- **Dynamic interaction patterns.** Disclosure widgets, dialogs, tab panels, autocomplete combo-boxes — the keyboard interaction model is verified by manual review during release rather than by the static rule layer. Where dynamic state matters, the rule pack adds a heuristic that catches the most common breakage (e.g., the 2FA-keyboard-accessible rule in the banking pack) but is not a complete substitute for hand-testing.
- **Reading order in CSS-positioned content.** Static DOM does not always reflect the reading order a sighted user sees. WCAG 1.3.2 is partially covered by the heading-hierarchy rule but not fully.
- **Motion, audio, video.** The landing has no media; the audiovisual rules in the EAA Annex I §I.6 pack are not exercised against ariada.org. They are exercised by the package-level test suite against synthetic fixtures, but the self-cert run produces no evidence on them.
- **Authentication and CAPTCHA flows.** The landing has no login. WCAG 3.3.7-3.3.8 (cognitive accessibility of authentication) is out of scope of the self-cert run.
- **Multi-step transactions.** WCAG 2.4.13 Page Break Navigation, 3.3.4 Error Prevention (Legal, Financial, Data), 3.3.5 Help — the landing does not have a checkout, so the checkout pack is exercised against fixtures rather than against our own site.

These limits are disclosed on `ariada.org/accessibility/` in the published statement, with the WCAG 2.2 §5.4 + §5.5 Statement of Partial Conformance structure cited where applicable.

---

## How a regression will catch itself (after the milestone-1 gate is wired)

The reproduction recipe in the next section makes the building blocks concrete today. The current `audits/self-cert/` history shows artefacts from the most recent weekly self-scan against the landing. When the milestone-1 per-PR gate lands and a future regression is caught by our own pipeline, we will link the pull request that surfaced it here as a reproducible example.

What «caught» will mean in practice once the gate is wired: a contributor edits the rule pack, runs `pnpm changeset` and opens a pull request. CI runs the rule pack against the landing's built static site. If the edit accidentally narrowed the contrast threshold from 4.5:1 to 5:1 (a stricter bar that some body copy on the landing fails), the contrast violation count goes from 0 to N>0, the SARIF report surfaces those N items, the pull-request comment lists them with their `helpUrl`, and the `eaa-audit` job exits non-zero. Merge is blocked until either the rule edit is reverted, the rule is loosened to the WCAG-spec value, or the landing copy is updated.

The same loop will apply to any rule edit — a stricter banking-IBAN pattern, a missing aria-attribute on the landing, a forgotten `lang="sv"` on a localised page. Catch-rate is bounded by what the static-DOM scanner can see; see «What our tool can NOT yet self-check» for the honest scope.

Today the same machinery runs on a weekly cron and on-demand `workflow_dispatch` against the landing's main branch, producing artefacts that document any drift. The weekly cadence + manual trigger is the bridge state — we collect the drift signal continuously, but the per-PR auto-block is the gate that closes the loop.

---

## Multi-domain extension (current single-jurisdiction reference + roadmap)

The dogfooding narrative starts with one landing because one landing is what we can honestly self-certify today. The same building blocks generalise to multiple landings and to multiple regulatory jurisdictions — that generalisation is published as a contract today and is rolled out progressively.

**What ships today (`@ariada-org/multi-domain`):** a canonical `ScanEvent` data contract for downstream tooling, a `JurisdictionPlugin` extension interface that community implementers register against, and a **reference orchestrator that runs one jurisdiction at a time**. The reference orchestrator is explicit about its scope — the package README states it «deliberately runs one jurisdiction at a time» and lists what the package does NOT yet do (multi-jurisdiction execution in a single pass, etc.). This is the same honesty pattern as this page: ship the contract first, ship the multi-jurisdiction runner against it later.

**Named roadmap targets:** the first two community-authored jurisdiction plugins called out in the multi-domain README are Canadian AODA (Accessibility for Ontarians with Disabilities Act, integrated as WCAG 2.0 Level AA + Ontario-specific procedural overlay) and Japanese JIS X 8341-3 (Japan's national accessibility standard, aligned with WCAG 2.x). These are the natural next jurisdictions because they are the largest non-EU markets where the rule-pack-translation discipline is already legally relevant.

**Sibling landings beyond `ariada.org`:** the sister script `scripts/self-cert-scan.mjs` is wired for the project's sibling landing build (apps/ariada-web/dist). The artefact pattern is identical; the methodology is the shared harness `scripts/lib/self-cert-harness.mjs` so cross-site comparison stays apples-to-apples. Wiring the sibling scan into the same PR-gate path as the `ariada.org` scan is part of the same milestone-1 work as the gate itself.

**What multi-domain extension does NOT mean today.** It does not mean the rule pack is currently translated into multiple jurisdictions — only the EU (EAA + EN 301 549 + Directive 2016/2102) is in the shipped 31-rule starter pack. It does not mean the cross-jurisdiction comparison runs automatically. It does not mean a community plugin author can register an AODA plugin and have the eaa-audit workflow pick it up tomorrow. The contract is published; the implementations and the wiring against them are progressive.

---

## Standards basis

The dogfooding loop is not a marketing claim — it is the structured response to specific EU regulatory obligations that already apply to the landing as a public-facing digital service in scope of European accessibility law.

**EAA Directive (EU) 2019/882 Article 13 — Obligations of service providers:**

> «Service providers shall ensure that they design and provide services in accordance with the accessibility requirements of this Directive.»

The audit loop is the verifiable evidence of design and provision in accordance with the cited requirements. The rule pack is the codification of the requirements; the weekly cron run + on-demand `workflow_dispatch` is the verification cadence today, with the per-pull-request trigger on the milestone-1 path (see «Current wiring state» above).

**EAA Article 14 — Fundamental alteration and disproportionate burden:** where a sub-criterion cannot be met without fundamental alteration of the service or imposes a disproportionate burden, Article 14 permits a documented exemption. The published accessibility statement at `ariada.org/accessibility/` discloses any such exemption with the basis. The dogfooding loop does not hide these exemptions — it surfaces them in the same artefact.

**WCAG 2.2 §5.2 — Conformance Requirements:** the five requirements (Conformance Level / Full pages / Complete processes / Only accessibility-supported ways / Non-Interference) are the technical framework against which the rule pack maps each rule.

**WCAG 2.2 §5.4 + §5.5 — Statement of Partial Conformance:** where third-party content or a non-supported language locale prevents full conformance, §5.4 (third-party content) and §5.5 (language) provide the disclosure mechanism. The accessibility statement page uses both where applicable, with the specifics named.

**EN 301 549 v3.2.1:** the harmonised European standard that operationalises WCAG 2.2 + non-web ICT accessibility for EU public-sector procurement. The per-rule documentation cites the EN 301 549 paragraph alongside the WCAG SC.

**Directive (EU) 2016/2102 Article 7 — Accessibility statements:** the public-sector web accessibility directive's statement obligation. The statement-generator rules in the accessibility pack are derived from Article 7 + its implementing Commission Decision 2018/1523.

---

## How to verify

A reader can reproduce the self-cert scan locally in roughly three minutes on a recent Node 22 + pnpm 9 workstation.

```bash
# Clone the repository
git clone https://github.com/ariada-org/ariada.git
cd ariada

# Install workspace dependencies
pnpm install --frozen-lockfile

# Build the rule pack and its workspace dependencies
pnpm --filter @ariada-org/wcag-rules-extended... build

# Build the landing
pnpm --filter ariada-org build

# Run the self-cert scan against the landing's built static site
node scripts/self-cert-ariada-org.mjs

# Inspect the JSON and Markdown report
cat audits/self-cert/$(date -u +%Y-%m-%d)-ariada-org.json | jq .
cat audits/self-cert/$(date -u +%Y-%m-%d)-ariada-org.md
```

The Markdown report is the human-readable version; the JSON is the machine-readable artefact that the accessibility-statement generator consumes.

For a cross-tool baseline (running axe-core + pa11y against the same site for comparison), see `docs/audits/2026-05-15-wcag-cross-tool-audit.md` — both tools agree on the major findings; the rule pack adds the EAA-Annex-I sectoral coverage that the upstream tools do not encode.

---

## Limitations

A small landing site stresses a narrow part of the rule corpus. The ariada.org landing is currently 5 pages, ~10K lines of source, no checkout, no banking-channel mock, no authenticated flow. The full rule pack — 31 rules across three packs with 644 passing Vitest tests — is exercised primarily against the package-level fixture corpus, not against the landing.

This means the **self-cert run is a smoke test, not a complete validation** of the rule pack against real-world surfaces. A consumer site with an actual checkout, an actual banking flow, and an actual multi-language statement page exercises rules that ariada.org cannot exercise.

To partially compensate, the package-level test suite uses 23 synthetic-but-authentically-structured EU fixtures (`packages/ariada-test-fixtures/fixtures/eu-real-world/`) — Klarna-style Swedish checkout, BankID 2FA, MobilePay, Finnish/French accessibility statements — to exercise rules the landing cannot. These fixtures are scanned in CI; their results are part of the green-CI evidence but are not part of the self-cert artefact that the public statement page consumes.

The honest summary: the self-cert loop is the strongest available evidence that the rule pack does what the rule pack claims, against the smallest realistic site. It is not the only evidence and not sufficient on its own — the synthetic fixtures, the cross-tool comparison, and the per-rule unit tests carry the rest of the verification weight.

---

## Industry precedent

Dogfooding is a common discipline in OSS infrastructure projects:

- **Vitest tests Vitest** — the test runner's own test suite uses itself, including its watch mode and snapshot diffing.
- **TypeScript bootstraps in TypeScript** — the compiler is written in the language it compiles; a regression in the compiler's behaviour shows up in compilation of the compiler.
- **GitHub builds GitHub with GitHub Actions** — the platform that runs the workflows runs its own workflows.
- **Rust compiles Rust** — the canonical rustc bootstrap. A bug in the borrow checker affects the borrow checker's own source first.
- **Stripe processes Stripe usage as a Stripe customer** — billing infrastructure verified against itself.

The ariada loop is the same pattern applied to accessibility-compliance tooling. The rule pack we publish is the rule pack our own landing complies with. Any regression in the published rule definitions is a regression a contributor sees in their own pull request before users see it on npm.

---

## See also

- The accessibility statement consumed by readers: `apps/ariada-org/src/pages/accessibility.astro` (deployed at `ariada.org/accessibility/`).
- The reusable workflow: `.github/workflows/eaa-audit.yml`.
- The self-cert script: `scripts/self-cert-ariada-org.mjs` and its sister `scripts/self-cert-scan.mjs` for the `ariada-web` landing.
- The shared harness: `scripts/lib/self-cert-harness.mjs`.
- The cross-tool baseline memo: `docs/audits/2026-05-15-wcag-cross-tool-audit.md`.
- Rule-by-rule docs: `packages/wcag-rules-extended/docs/rules/`.
- Methodology: `packages/wcag-rules-extended/docs/METHODOLOGY.md`.

---

Maintained by Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726).
