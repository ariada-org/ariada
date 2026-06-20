<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# ADR 0002 — happy-dom over jsdom for rule evaluation

| Field   | Value                                                          |
|---------|----------------------------------------------------------------|
| Status  | Accepted                                                       |
| Date    | 2026-05-14                                                     |
| Authors | Agonist Development AB (Sweden)                                |

## Context

The package's rules need to evaluate against a parsed DOM in a Node.js environment for two purposes: the test suite (vitest fixtures) and consumer-side static-HTML scanning (CI without a real browser). Two production-grade headless DOM implementations were candidates: [jsdom](https://github.com/jsdom/jsdom) and [happy-dom](https://github.com/capricorn86/happy-dom).

## Decision

Adopt `happy-dom` (^15) as the test-time and reference DOM implementation. The package is published as standard `RuleDefinition` / `CheckEvaluate` types that work against any spec-compliant DOM, so consumers may choose jsdom if they prefer.

## Rationale

Three reasons drove the decision:

1. **Speed.** Happy-dom parses and queries roughly 2-4× faster than jsdom in the package's fixture benchmarks (measured 2026-04-30 against the cross-tool fixture suite). For a CI pipeline that scans hundreds of pages, the cumulative difference is significant; for the unit-test suite the difference shortens `pnpm test` from approximately 8 seconds to under 3 seconds, which keeps watch-mode usable.
2. **Simpler API for the subset we need.** Happy-dom exposes the standard DOM API surface that the rules use (`querySelectorAll`, attribute access, `ownerDocument`, parent traversal) without jsdom's optional layers (CSSOM resolution, XPath, mutation observers) that this package does not exercise. Less surface area means fewer edge cases and faster cold start.
3. **Vitest default.** [Vitest](https://vitest.dev/) auto-detects happy-dom as its DOM environment when present, with zero configuration. jsdom requires explicit `environment: 'jsdom'` configuration and a separate install. The package is built for the Vitest test runner, so aligning with its default removes setup friction for contributors.

The decision is reversible at low cost: every rule uses only spec-compliant DOM APIs, so a downstream consumer wishing to run the rules against jsdom can do so by changing the test environment line. No rule depends on a happy-dom-specific extension.

Alternatives considered and rejected:

- **jsdom** — more feature-complete (CSSOM, basic layout, XPath). Rejected because the additional features are not needed by any rule in this package, and the speed penalty is paid by every test invocation and every CI run.
- **linkedom** — even smaller and faster than happy-dom but missing several DOM features (no `MutationObserver`, partial `querySelectorAll`). Rejected because some rules in the roadmap need MutationObserver-driven dynamic checks.
- **Real Playwright / Puppeteer browser** — too heavy. The rules are designed to run in headless DOM precisely so they can be invoked in lightweight CI without a browser binary.

## Consequences

- `devDependencies` declares `happy-dom: ^15.11.7`.
- `vitest.config.ts` declares `environment: 'happy-dom'`.
- The README documents that consumers can use jsdom if they prefer; the rules are spec-compliant and do not depend on happy-dom.
- Documentation in each rule's "What this rule checks" section describes behaviour in terms of standard DOM API calls, not happy-dom-specific extensions.
- If a future rule needs a DOM feature happy-dom does not yet support, the rule is responsible for either (a) feature-detecting and falling back, or (b) opening a discussion issue to revisit this ADR.

## References

- happy-dom repository: <https://github.com/capricorn86/happy-dom>
- jsdom repository: <https://github.com/jsdom/jsdom>
- Vitest configuration: <https://vitest.dev/config/#environment>
- package.json devDependencies block.
