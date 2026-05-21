# @ariada-org/diff-stub

> **NOT canonical — equality-only stub for OSS interoperability.**
> This package matches findings strictly by fingerprint equality. It
> never emits `near_duplicate` classifications. For production CI you
> should use the canonical engine; otherwise false-positive «new»
> findings caused by trivial DOM drift will not be merged into
> `pre_existing` here.

Equality-only reference classifier for the differential accessibility
CI gate. Use it for OSS interoperability checks, schema conformance
tests, and self-hosted pipelines that do not need near-duplicate
matching.

Open source under [EUPL-1.2](./LICENSE). Single workspace dependency:
[`@ariada-org/diff-schema`](../ariada-diff-schema). Node 22 LTS or newer.

## Install

```bash
npm install @ariada-org/diff-stub @ariada-org/diff-schema
```

## Usage

```ts
import { classifyStub } from "@ariada-org/diff-stub";

const diff = classifyStub({
  headFindings: [
    {
      ruleId: "wcag2/1.1.1",
      jurisdictionTags: ["WCAG2.2-AA"],
      severity: "serious",
      selector: "main > img.hero",
    },
  ],
  baseFindings: [],
  diffId: "01HVABCDEF0123456789ABCDEFG",
  computedAt: new Date().toISOString(),
  head: { scan_id: "head-scan", scan_root_hash: "a".repeat(64) },
  base: { scan_id: "base-scan", scan_root_hash: "b".repeat(64) },
});

console.log(diff.engine_info.classifier); // → "stub"
console.log(diff.classification.new.length); // → 1
```

## API

| Export                      | Type     | Description                                      |
| --------------------------- | -------- | ------------------------------------------------ |
| `classifyStub`              | function | Equality-only classifier producing a DiffResult. |
| `STUB_CLASSIFIER_VERSION`   | constant | Stub version string.                             |
| `STUB_NOT_CANONICAL_BANNER` | constant | Warning to surface in downstream UI / logs.      |

## When to NOT use this package

- You run the differential gate in a production CI pipeline where false-positive
  «new» findings from trivial DOM drift would block real merges.
- You need the canonical engine guarantees (deterministic near-duplicate
  matching, hierarchical policy resolution, exemption-with-DOM-invalidation).

Switch to the canonical engine via the GitHub Action's `engine: canonical`
input, or invoke the SaaS API directly.

## License

EUPL-1.2 for code; CC-BY-SA-4.0 for prose; CC0-1.0 for build config.
See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
