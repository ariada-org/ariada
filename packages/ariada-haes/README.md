# @ariada-org/haes

Hash-anchored Evidence Stream — a tamper-evident append-only ledger for
AI-artifact transparency under EU Regulation 2024/1689 (the EU AI Act)
Article 50.

Open source under [EUPL-1.2](./LICENSE). Zero runtime dependencies.
Node 22 LTS or newer.

## What this package does

Every AI artifact a regulated product emits — a chatbot reply, an
AI-generated UI string, an AI-suggested code patch, an AI-rendered
image — gets written as an entry that records the model id, the prompt
template fingerprint, the input redaction profile, the output checksum,
the deployer's decision (shipped / rewritten / blocked), an Ed25519
signature, and a SHA-256 link to the previous entry. Mutating any entry
mechanically invalidates every subsequent entry's `prev_hash`, so
tampering detection becomes deterministic rather than discretionary.

Daily Merkle roots over the chain can be published to a third-party
public log so regulators and auditors can verify integrity without
trusting the deployer's tooling.

## Install

```bash
npm install @ariada-org/haes
```

## Usage

```ts
import {
  HaesClient,
  buildMerkleRoot,
  generateEd25519Keypair,
  sha256Hex,
  verifyInclusionProof,
  buildInclusionProof,
} from "@ariada-org/haes";

const key = generateEd25519Keypair();
const client = new HaesClient({ signingKey: key });

await client.append({
  payload: {
    model_id: "anthropic:claude-3-7-sonnet",
    model_version: "20250203",
    prompt_template_fingerprint: sha256Hex("system prompt v1"),
    input_redaction_profile: "pii-strict-v2",
    output_checksum: sha256Hex("output bytes"),
    decision: "shipped",
    signing_key_id: key.keyId,
  },
});

// End-to-end chain verification.
const verdict = await client.verifyAll(() => key.publicKeyRaw);
console.log(verdict.valid);

// Daily Merkle root over all entries — anchor it to a public log of choice.
const entries = await client.snapshot();
const hashes = entries.map((e) => e.entry_hash);
const root = buildMerkleRoot(hashes);

// Inclusion proof for one entry against that root.
const proof = buildInclusionProof(hashes, 0);
verifyInclusionProof(proof, root ?? "");
```

## API

| Export                   | Type     | Description                                         |
| ------------------------ | -------- | --------------------------------------------------- |
| `HaesClient`             | class    | Append + verify orchestrator over a storage backend |
| `buildEntry`             | function | Build a signed entry from an `AppendInput`          |
| `computeEntryHash`       | function | Canonical SHA-256 over the JCS-encoded pre-image    |
| `verifyEntry`            | function | Single-entry chain-link + signature verifier        |
| `verifyChain`            | function | Sequential whole-chain verifier                     |
| `buildMerkleRoot`        | function | SHA-256 Merkle root over leaf hashes                |
| `buildInclusionProof`    | function | Per-entry inclusion proof against the daily root    |
| `verifyInclusionProof`   | function | Re-verify a leaf-to-root proof                      |
| `canonicalize`           | function | RFC 8785 JSON canonicalization (JCS)                |
| `generateEd25519Keypair` | function | Fresh Ed25519 signing keypair (Node `crypto`)       |
| `InMemoryStorage`        | class    | Reference `HaesStorageBackend` implementation       |

## Standards referenced

- [RFC 8785 — JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785)
- [RFC 8032 — Edwards-Curve Digital Signature Algorithm (Ed25519)](https://www.rfc-editor.org/rfc/rfc8032)
- [FIPS 180-4 — SHA-256](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf)
- [RFC 6962 §2.1 — Merkle hash trees](https://www.rfc-editor.org/rfc/rfc6962#section-2.1)
- [Crockford base32 — ULID layout](https://github.com/ulid/spec)

## License

EUPL-1.2 for code; CC-BY-SA-4.0 for prose; CC0-1.0 for build config.
See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
