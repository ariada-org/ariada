<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# @ariada-org/ai-authorship

Per-code-hunk AI-authorship attribution. Multi-signal ensemble (lexical
entropy, AST shape, naming cadence, edit-history rhythm) with calibrated
posteriors over a closed set of known AI coding assistants plus the
explicit categories `human` and `other`.

Composes with [`@ariada-org/haes`](https://www.npmjs.com/package/@ariada-org/haes)
so that a posterior attribution can be canonicalised (RFC 8785 JCS),
signed (Ed25519), and appended to a tamper-evident append-only ledger.
That composition supports transparency obligations on AI-generated content
under EU Regulation 2024/1689 (the EU AI Act) Article 50, enforceable
from 2026-08-02.

## Install

```sh
npm install @ariada-org/ai-authorship
```

## Usage — offline mode (no network)

```ts
import { attributeOffline, type AttributionInput } from '@ariada-org/ai-authorship';
import { createHash } from 'node:crypto';

const hashedEmail = createHash('sha256').update('dev@example.com').digest('hex');

const input: AttributionInput = {
  code: 'function add(a, b) {\n  return a + b;\n}\n',
  diff_unified: '+function add(a, b) {\n+  return a + b;\n+}',
  language: 'ts',
  commit_metadata: {
    timestamp_utc: new Date().toISOString(),
    git_author_email: hashedEmail,
    commit_message: 'add: scalar add helper',
    prior_commit_timestamps: [],
  },
  file_path: 'src/add.ts',
};

const result = attributeOffline(input);
if (result.ok) {
  const top = result.value.posterior[0];
  console.log(`top: ${top.agent} @ p=${top.probability.toFixed(3)}`);
}
```

## Usage — hosted mode + transparency anchor

```ts
import {
  attribute,
  anchorPosterior,
} from '@ariada-org/ai-authorship';
import { HaesClient, generateEd25519Keypair, sha256Hex } from '@ariada-org/haes';

const keypair = generateEd25519Keypair();
const client = new HaesClient({ signingKey: keypair });

const result = await attribute(input, { api_key: process.env.ARIADA_API_KEY ?? '' });
if (result.ok) {
  const anchored = await anchorPosterior(result.value, {
    client,
    signing_key_id: keypair.keyId,
  });
  console.log(`entry_id=${anchored.entry.entry_id} top=${anchored.top_agent}`);
}
```

## Public API

| Export | Type | Description |
|---|---|---|
| `attribute(input, override?)` | function | Single-input inference; hosted by default, offline fallback when no API key |
| `attributeBatch(inputs, override?)` | function | Batched inference — preferred for CI (single roundtrip per batch) |
| `attributeOffline(input)` | function | Synchronous offline-only inference; confidence capped at 0.6 |
| `extractSignals(input)` | function | Signal-extraction inspection without running the ensemble combiner |
| `anchorPosterior(posterior, opts)` | function | Canonicalise + sign + append a posterior to a HAES chain |
| `canonicalisePosterior(posterior)` | function | Produce the canonical bytes + SHA-256 checksum |
| `buildAnchorInclusionProof(entries, hash)` | function | Build a Merkle inclusion proof for an anchored posterior |
| `AttributionPosterior` | type | Output contract — sum-to-one posterior + signal contributions + version pins |
| `AttributionInput` | type | Per-hunk input contract |
| `AIAgentId` | type | Closed enum of supported agents (8 named + `human` + `other`) |

## Output invariants

Every `AttributionPosterior` satisfies:

1. Probabilities sum to 1.0 ± 1e-6.
2. Array length equals the canonical agent count (every agent present, including zero-probability ones).
3. Sorted descending by probability; ties broken by canonical declaration order.
4. `confidence ∈ [0, 1]`.
5. Offline-mode `confidence ≤ 0.6`.
6. `signal_contributions.length` equals the canonical signal count (4).
7. Per-signal contributions sum approximately to zero across agents (signals are evidence, not bias).
8. `classifier_version` and `calibration_version` are non-empty semver strings.

## Inference modes

- **Hosted** (default): the OSS client batches up to 256 inputs per request and posts to a hosted endpoint that runs the calibrated classifier. Confidence is uncapped. Authentication via bearer token (`ARIADA_API_KEY`).
- **Offline**: pure-local execution using the bundled minimal classifier. Confidence is capped at 0.6 to mark the lower-fidelity surface. Suitable for air-gapped CI, on-premise compliance, and reproducibility audits.

Set `ARIADA_ATTRIBUTION_OFFLINE=1` to force offline mode even when an API key is present.

## Honest framing

Methodology validation on a multi-language, multi-model corpus is not the
same as end-to-end production accuracy on real customer code. The
published research signal is not deployment telemetry. We do not claim
"validated on N customer sites" today.

## Calibration

Calibration target is a Brier score ≤ 0.15 on per-class binary decomposition
of the held-out validation split. The OSS reference implementation ships a
no-op calibration suitable for the offline-mode classifier; the hosted
classifier ships the calibrated Platt-scaling + isotonic-regression overlay
that reaches the headline target.

The exposed `CalibrationParams` shape lets a researcher swap in a custom
calibration when reproducing the validation harness.

## License

EUPL-1.2. See `LICENSE`.

## Test coverage

Measured coverage for this package, alongside every other one in the
repository, is on [one generated page](../../apps/ariada-org/public/modules/test-coverage/index.html). It is rebuilt by
`bash scripts/sobrat-pokrytie.sh`, which runs each package's own coverage
task and records what it reports — including the packages that could not
report, and why.
