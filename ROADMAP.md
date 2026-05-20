# Roadmap

Public-facing milestones for the ariada project.

## Status

| Milestone | What | Status |
|---|---|---|
| **Docs site phase 1** | Starlight docs site (skeleton + Pagefind search + TypeDoc autogen for `@ariada/core`) | ✅ shipped |
| **Salvage migration** | Cherry-pick UI into hybrid architecture (CF Pages + self-hosted backend) | ✅ shipped |
| **Engine / adapter split** | `core-engine` (pure logic) + `core-playwright` (Node) + `core-browser` (browser-extension prep) | ✅ shipped |
| **Scanner runtime first release** | Twenty-one OSS packages reach `v0.1.0-rc.1` on `ariada-org/ariada`; 1758 unit tests across 21 packages green | ✅ shipped |
| **OSS hardening** | Governance files, badges, REUSE 3.3 compliance (717/717), CI gates, release automation, SBOM + OIDC trusted publisher | ✅ shipped |
| **Differential CI gate (OSS reference)** | `@ariada/diff-schema` + `@ariada/diff-stub` (equality-only reference) + `@ariada/diff-action` composite Action | ✅ shipped |
| **AI-authorship + tamper-evident ledger** | `@ariada/ai-authorship` per-hunk attribution + `@ariada/haes` Hash-Anchored Evidence Store for EU AI Act Article 50 | ✅ shipped |
| **Test-framework adapters** | `@ariada/test-adapters` accessibility matchers for Jest, Vitest, Mocha + Chai, Playwright, Cypress | ✅ shipped |
| **Multi-domain orchestrator reference** | `@ariada/multi-domain` single-domain single-regulation reference implementation | ✅ shipped |
| **Anti-overlay detection library** | `@ariada/anti-overlay` detection-only library identifying third-party accessibility-overlay products | ✅ shipped |
| **HTML renderers** | `@ariada/scan-report-html` single-file scan report + `@ariada/ariada-vpat-html-renderer` VPAT 2.5 INT → WCAG 2.2 AA self-conformant HTML | ✅ shipped |
| **CLI + MCP server** | `@ariada/cli` single-binary runner (`scan`, `list-rules`, `emit-report`) + `@ariada/mcp-server` Model Context Protocol server | ✅ shipped |
| **VS Code extension** | `@ariada/vscode-extension` inline accessibility diagnostics for HTML, JSX, TSX, Vue, Svelte | ✅ shipped |
| **Stable v0.1.0 release** | Promote `v0.1.0-rc.1` → `v0.1.0` across all 21 OSS packages on npm with signed provenance | 🚧 in progress |
| **Chrome extension MVP** | Click icon on any site → live-page scan → in-page overlay highlights violations | 📋 next |
| **Production deploy** | CF Pages for static apps + Hetzner Hono backend behind Cloudflare Tunnel + real Rust scanner integration | 📋 pending |
| **Field-validation track** | 1K labelled EU SMB sites — empirical accuracy benchmark for the 31-rule pack on real traffic | 📋 next |
| **Branded scan visualisation** | Commission Rive character — replaces SVG placeholder | 📋 external blocker |

## By quarter

### Q3 2026 — stabilise + first integrations

- Promote `v0.1.0-rc.1` → stable `v0.1.0` across all twenty-one packages on npm with signed OIDC provenance
- Starlight docs site (`docs.ariada.org`) goes live with per-package API pages
- Chrome extension MVP — live-page scan + in-page overlay
- Field-validation track — empirical accuracy benchmark on 1K labelled EU SMB sites
- VS Code extension polished — `@ariada/vscode-extension` v1
- Public conformance reports for `@ariada/wcag-rules-extended` rule pack
- Sister-product reference integrations (Playwright, Cypress, Vitest) shipped via `@ariada/test-adapters`

### Q4 2026 — Mindset framework + multi-fund expansion

- Mindset framework public release — architect-tier accessible-design framework (EUPL-1.2 + CC-BY-4.0 prose)
- Anti-overlay public-interest explainer page
- Multi-fund expansion — Sovereign Tech Fund + EUIPO SME Fund follow-on applications
- Cross-domain analyzer plugin contract (sustainability / Core Web Vitals / SEO / GDPR) shipped as v0.2 plugin API
- Multi-language docs phase 1 (Swedish, German, French)

### Q1–Q2 2027 — scale + commercial validation

- First commercial customer reference deployments (under separate terms)
- Firefox extension target (WXT MV2 path already prepared)
- Multi-language docs phase 2 (Danish, Norwegian, Finnish, Dutch, Italian)
- Regulatory-context Model Context Protocol resources via `@ariada/mcp-server`
- Cross-portfolio plugin expansion beyond accessibility

## Funding outlook

The project is part of the NLnet (Stichting NLnet, the Dutch foundation funding public-interest internet infrastructure) Commons mission to keep core internet infrastructure in public hands. Grant outcomes inform the depth of investment per quarter, not the direction:

- **Funded path** — accelerated stable v0.1.0, additional locales, dedicated docs/RAG engineer, paid security audit, expanded field-validation corpus (10K → 100K sites)
- **Realistic path (no/partial funding)** — current cadence sustained, stable v0.1.0 on schedule, locales prioritised by procurement-tender demand, security audit deferred to post-customer-deployment
- **Independent of funding** — public OSS surface remains EUPL-1.2, no regression to closed source, no telemetry, no account

## Architecture pillars

- Docs site = Starlight + Pagefind + self-hosted RAG (phase 2)
- Three scanner runtimes: Rust + NATS canonical / TS + Playwright CLI / TS + browser extension. All share a locked `ScanEvent` contract.
- CF Pages free for static + Hetzner-collocated Node backend.

Detailed Architecture Decision Records (ADRs) live in [`docs/decisions/`](./docs/decisions/) where they ship publicly with the repository.

## Long-term

- **Cross-portfolio scanner expansion:** add domains beyond accessibility (sustainability / CWV / SEO / GDPR) as new analyzer plugins. The plugin contract is locked and stable since v0.1.
- **Multi-language docs** — currently English only.
- **Firefox extension** — WXT compiles to MV2 already; ship after Chrome MVP traction.
- **Self-hosted RAG** for `docs.ariada.org/ask-ai` (phase 2 of the docs site, hybrid with Pagefind primary search).

## How to influence the roadmap

- **GitHub Discussions** — propose features in the `Ideas` category
- **GitHub Issues** — concrete bug reports + feature requests with structured templates
- **PRs** — direct contributions welcome; see [CONTRIBUTING.md](./CONTRIBUTING.md)

## Status legend

- ✅ shipped
- 🚧 in progress
- 📋 planned
- ⏸️ deferred
