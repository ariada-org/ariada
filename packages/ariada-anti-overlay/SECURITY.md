<!--
SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Security policy

## Threat model

Inputs to this package are untrusted HTML strings. The package does NOT execute or interpret the HTML — it performs string pattern-matching only. The HTML is not parsed into a DOM tree by the package itself.

## ReDoS resistance

Every signature regex is linear-time-verifiable: no nested unbounded quantifiers, no overlapping alternations on backtracking-sensitive boundaries. The test suite (`tests/unit/redos.test.ts`) exercises deliberately adversarial inputs (long flat strings, repeated benign tokens, deeply nested script tags) and asserts each call returns within the budget.

## No outbound network

The package never opens a network socket. URL input is delegated to a caller-supplied fetcher; without a fetcher, URL input is rejected with code 2. The no-network invariant is verified by `tests/unit/no-network.test.ts` which monkey-patches `globalThis.fetch` and asserts zero calls across the full signature suite.

## No file-system access

No file-system access beyond the bundled signature registry compiled into the package itself.

## Reporting a vulnerability

Please report security issues responsibly. Send a private report via the GitHub Security Advisories interface on the `ariada-org/ariada` monorepo, or by email to the maintainer listed in `package.json`. We aim to acknowledge reports within 5 working days and to publish a fix within 90 days of acknowledgement, in line with our responsible-disclosure policy.

## Supply chain

Zero third-party runtime dependencies. The package compiles against the Node.js standard library only. All development dependencies are pinned via the monorepo lockfile and reviewed by CodeRabbit on every pull request.
