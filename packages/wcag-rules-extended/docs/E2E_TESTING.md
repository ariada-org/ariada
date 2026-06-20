<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# End-to-end (E2E) testing — cross-engine Playwright suite

> **Status:** Active since 2026-05-17 (MENDELEEV).
> **Scope:** `packages/wcag-rules-extended/tests/e2e/`.
> **Author:** Alekszandr Bricskin (Agonist Development AB).

## What this suite is for

The 524 vitest unit tests in `src/**/*.test.ts` run the rule logic against
**happy-dom**, a synthetic DOM. That covers per-rule correctness very
cheaply (whole suite in ~4 s) but does **not** verify behaviour in real
browser engines.

This Playwright suite fills that gap. It loads the M7 EU real-world HTML
fixtures (`@ariada-org/test-fixtures/fixtures/eu-real-world/`) in:

- **Chromium** (Blink engine)
- **Firefox** (Gecko engine)
- **WebKit** (Safari engine)

and runs the EAA rule pack against each via axe-core. If any rule fires
inconsistently across engines — different DOM accessibility tree, different
ARIA computation, different layout — the suite will catch it.

## Browser × scenario matrix

5 showcase rules × 3 scenarios × 3 browsers = **45 tests**:

| Rule | Pack | FAIL fixture | PASS fixture | Cross-pack PASS fixture |
|---|---|---|---|---|
| `ariada/checkout/payment-fieldset-grouping` | A | `klarna-style-bad-checkout-sv.html` | `klarna-style-checkout-sv.html` | `accessibility-statement-fi.html` |
| `ariada/checkout/autocomplete-personal-data` | A | `klarna-style-bad-checkout-sv.html` | `klarna-style-checkout-sv.html` | `bankid-style-success-sv.html` |
| `ariada/checkout/required-field-machine-readable` | A | `mittelstand-bad-checkout-de.html` | `mittelstand-checkout-de.html` | `rgaa-statement-fr.html` |
| `ariada/statement/enforcement-procedure-link` | B | `accessibility-statement-fi-incomplete.html` | `accessibility-statement-fi.html` | `klarna-style-cart-sv.html` |
| `ariada/banking/lang-matches-locale` | C | bankid-2fa + DOM mutation (force `lang="en"` + inject distinctive SV body text) | bankid-2fa + DOM mutation (same body text, keep `lang="sv"`) | `rgaa-statement-fr.html` |

The Pack C row uses a DOM mutation rather than a static fixture because
the rule's Nordic-script + function-word heuristic does not fire on the
existing `mobilepay-style-bad-merchant-da.html` fixture (its body has
fewer than 5 distinctive DA function words). Mutating in the test gives
the rule both signals it needs (`å/ø/æ` somewhere AND ≥5 function words
from the SV list) while still exercising real browser rendering.

## How to run

From `packages/wcag-rules-extended/`:

```bash
# Run all 45 tests across all 3 browsers (~20 s wall-clock)
pnpm test:e2e

# Run just one browser (Chromium recommended for fast feedback ~2 s)
pnpm test:e2e --project=chromium

# Interactive UI mode — step through tests, see traces
pnpm test:e2e:ui

# Step-through debugger — pauses before each action
pnpm test:e2e:debug

# Single rule across all engines
pnpm test:e2e --grep "payment-fieldset-grouping"
```

Reports:

- `playwright-report/index.html` — HTML report (open in browser)
- `test-results.json` — machine-readable per-test results

## First-time setup

If you have never run the suite:

```bash
cd packages/wcag-rules-extended
pnpm install                                 # picks up new devDeps
pnpm exec playwright install chromium firefox webkit
```

Browser cache lives at `~/Library/Caches/ms-playwright/` (macOS) or
`~/.cache/ms-playwright/` (Linux). Approx download size: Chromium ~130
MB, Firefox ~100 MB, WebKit ~80 MB.

## Architecture

```
tests/e2e/
├── fixtures/
│   ├── server.ts           ← in-process Node HTTP server for fixtures
│   ├── axe-eaa.ts          ← analyzeWithEaa(page, ruleIds) helper
│   └── eaa-bootstrap.ts    ← bundled into a string; runs in the page
└── showcase-rules.spec.ts  ← the 5 × 3 = 15 test scenarios
```

### Why not `@axe-core/playwright`?

`AxeBuilder` (from `@axe-core/playwright`) is convenient for running axe
with stock rules, but it has no public hook for
`axe.configure({ rules, checks })` with custom rule + check definitions.
It only exposes `withRules` / `withTags` / `options`.

So our `analyzeWithEaa` helper bypasses it: it injects `axe.min.js` and
then a small bundle (`eaa-bootstrap.ts` compiled by esbuild to an IIFE)
that calls `axe.configure({ rules, checks })` with all 31 EAA rules. The
esbuild step is necessary because the check `evaluate` functions
reference closure-bound helpers (`looksLikePaymentRadio`, `cssEscape`,
`getAccessibleNameLite`, etc.) that would be lost if we serialised the
functions via `.toString()` and rehydrated them in the page.

The bundle is cached per-Node-process (worker-scope), so the esbuild cost
of ~80-150 ms is paid once per worker, not per test.

### Fixture server

A new HTTP server is spun up per Playwright **worker** (not per test).
It binds to `127.0.0.1:0` (random free port) and serves any `*.html`
under `@ariada-org/test-fixtures/fixtures/eu-real-world/`. Each test
receives a `fixtureServer` injected fixture with:

- `fixtureServer.origin` — e.g. `"http://127.0.0.1:54321"`
- `fixtureServer.fixtureUrl(name)` — e.g. `"http://127.0.0.1:54321/klarna-style-checkout-sv.html"`

Per-worker scoping avoids both the boot cost of one server per test and
the port collisions you would get from a single shared global server
when `workers > 1`.

## Determinism guarantees

- No network calls outside `localhost`. The fixture server, axe-core
  source, and bundled rules are all loaded from the local filesystem.
- `retries: 0`. CI builds rely on the suite being deterministic — a
  flake is a real bug to fix, not a transient to silence.
- `webServer` is intentionally NOT used; the in-process Node server is
  cheaper and gives us typed helpers.
- Per-test isolation: each test calls `page.goto(...)` to a fresh URL;
  the only shared state is the read-only fixture server.

## Adding a new rule to the suite

1. Identify a fixture that **actually triggers the rule**. (The fixture
   comment headers describe the intent — but a few rules have heuristics
   that don't fire on minimal fixtures. Verify by running an audit
   sweep: instantiate `analyzeWithEaa(page)` without rule filtering and
   inspect `results.violations`.)
2. Identify a same-pack PASS fixture that does NOT trigger it.
3. Identify a cross-pack fixture that should not be affected.
4. Add a new entry to `RULE_CASES` in
   `tests/e2e/showcase-rules.spec.ts`.
5. Run `pnpm test:e2e --grep "<rule-id>"` to verify all 3 scenarios pass
   in all 3 engines.

If a rule's FAIL state cannot be expressed in a static fixture (e.g.
heuristic needs dynamic content), use the `mutate` field on the scenario
to apply a `page.evaluate(...)` DOM mutation after `goto`. Keep
mutations minimal and well-commented — every mutation introduces test
fragility.

## Known limitations

- WebKit on Linux requires extra system packages
  (`pnpm exec playwright install-deps webkit`). On macOS it works out of
  the box.
- The suite does NOT cover the full 31-rule pack — that would be
  ~93 tests (31 rules × 3 scenarios per rule). The showcase set (5 rules
  × 3 scenarios = 15 scenarios × 3 browsers = 45 tests) is the
  cross-engine sanity check. Full rule coverage stays in the vitest
  unit tests, which run 175× faster (~4 s vs ~700 s).
