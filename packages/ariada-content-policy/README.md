<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `@ariada-org/content-policy`

Composable content-policy gate. Evaluates text against rule-pack profiles keyed
per publish surface and emits a `GateDecision` verdict (`pass` / `warn` /
`fail`) with per-finding fingerprints. Zero runtime dependencies, network-free,
ReDoS-safe patterns.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Install

```bash
npm install @ariada-org/content-policy
```

Requires Node 22 LTS or newer.

## Usage

```ts
import { evaluateContent, builtinPacks, ossSurfaceProfile } from '@ariada-org/content-policy';

// A leaked credential is one of the things the oss-surface profile fails on.
// The placeholder is joined from two halves so that this file does not itself
// contain the pattern — the gate that scans what this repository publishes is
// this package's own command line, and it refuses its own documentation
// otherwise. The example still fails, which is the point of it.
const leaked = 'token=sk-' + 'EXAMPLEPLACEHOLDERKEY000000';
const decision = evaluateContent(leaked, ossSurfaceProfile, builtinPacks);

if (decision.result === 'fail') {
  for (const finding of decision.findings) {
    console.error(`${finding.ruleId} @ line ${finding.line}: ${finding.matchedText}`);
  }
  process.exit(1);
}
```

`evaluateContent` runs the deterministic regex tier only. For prompt (semantic)
rules, call `evaluateContentAsync` with a `SemanticEvaluator`; without one,
prompt rules are reported as `unevaluated` so a `pass` never overstates
coverage.

## Two tiers

- **Deterministic** — regex patterns compiled from each rule-pack, matched
  line-by-line. Malformed patterns are caught at runtime so one broken rule can
  never crash the gate; a build-time test asserts every shipped builtin pattern
  compiles.
- **Semantic** — prompt rules judged by an injected evaluator. A budget-aware
  evaluator surfaces exhaustion in the decision's `unevaluated` field rather
  than silently dropping content.

## Documentation

Full API and rule-pack reference: <https://github.com/ariada-org/ariada/tree/main/packages/ariada-content-policy>.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
