# @ariada-org/core — Multi-Domain Scanner Architecture

**Audience:** engineers touching the scanner or writing a new `DomainAnalyzer` plugin.
**Patent anchors:** J (IC1 single-pass, IC2 plugin, IC3 per-element concurrent, IC5 cross-domain), H (IC1 rule registry), B (Cl.1d fingerprint), K (IC1 element-iter for visualisation).
**Related docs:** the scanner packages' own readmes (ARIADA_SCANNER_ARCHITECTURE_v1.md` (full L0–L7 model).

---

## 1. The confusion this document clears up

> “axe-core is a single-domain rule engine (a11y only). How is `@ariada-org/core` multi-domain?”

Answer: **`@ariada-org/core` is not a rule engine**. It is an *orchestrator*.

- **axe-core** — one specific rule engine for **one** domain (WCAG/ARIA).
- **`@ariada-org/core`** — the orchestrator that:
  1. performs **one** `browser.goto(url)`,
  2. captures **one** `UnifiedSnapshot`,
  3. hands that snapshot to **N plugin analyzers** — each responsible for its own domain,
  4. detects **cross-domain conflicts** between those findings.

axe-core lives **inside** one analyzer (`@ariada-org/rules-axe`). The orchestrator never imports it. Replacing axe with another a11y engine (e.g. Siteimprove SDK) is a new package — no core changes.

This is what the single pass buys: other scanners run `N` separate passes (one per domain) → `N` browser cold starts, `N` DOM captures, inconsistent state. We do **one** pass, parallel fan-out, cross-domain detection becomes possible.

---

## 2. The plugin contract

Defined in `packages/core/src/types.ts`:

```ts
export interface DomainAnalyzer {
  readonly domain: Domain;                              // 'a11y' | 'cwv' | 'gdpr' | 'seo' | 'sustainability' | ...
  readonly version: string;
  readonly ruleIds: readonly string[];
  readonly conflictSignatures?: readonly ConflictSignature[];

  analyze(ctx: AnalyzerContext): Promise<Finding[]>;
  analyzeElement?(ctx: AnalyzerContext, target: ElementTarget): Promise<Finding[]>;
}

export interface AnalyzerContext {
  readonly snapshot: UnifiedSnapshot;   // read-only; same object for every analyzer
  readonly page: unknown;               // Playwright Page — typed as `unknown` so core doesn't take a runtime dep on Playwright in its interface
  readonly logger: Logger;              // per-scan child logger
}
```

An analyzer is an object — typically produced by a factory such as `createA11yAnalyzer()`. No class inheritance. No decorators. No registration magic. The plugin package just exports a function that returns an object matching this interface.

---

## 3. What `@ariada-org/core` does itself (and what it doesn't)

### It does

| Responsibility | File |
|---|---|
| Launch Playwright browser (chromium / firefox / webkit) | `src/cdp.ts` |
| One `browser.goto(url)` with timeout | `src/scanner.ts` |
| Capture `UnifiedSnapshot` (AX tree, DOM outline, perf, network, optional screenshot) | `src/snapshot.ts` |
| Maintain the plugin registry | `src/registry.ts` |
| Fan out the snapshot to all registered analyzers in parallel (`Promise.all`) | `src/scanner.ts` |
| Isolate per-analyzer failures (`try/catch` around each `.analyze()`) | `src/scanner.ts` |
| Aggregate `Finding[]` per domain | `src/scanner.ts` |
| Run the `CrossDomainDetector` against the aggregated findings | `src/cross-domain.ts` |
| (Optional) emit the locked `ScanEvent` stream in element-iteration mode | `src/element-iter.ts`, `src/events.ts` |
| Compute the final score & event counts | `src/scoring.ts` |
| Produce a `UnifiedReport` | `src/scanner.ts` |

### It does **not**

- Run WCAG rules, color-contrast checks, axe-core, or anything else domain-specific.
- Parse ARIA, evaluate focus order, or compute accessibility scores beyond the arithmetic score from counts.
- Call Lighthouse, measure performance, or estimate carbon.
- Decide which analyzer you want — it just runs the ones you pass in (or the bundled a11y default).

The orchestrator is **domain-ignorant**. That is the whole point.

---

## 4. The orchestrator flow — actual code path

```ts
// packages/core/src/scanner.ts — simplified
async function runScan(url: string, opts: ScanOptions): Promise<ScanResult> {
  const scanId = ulid();
  const handle = await launchBrowser(browserName, headless);

  try {
    // (1) ONE navigation — the whole point
    await handle.page.goto(url, { waitUntil: 'load', timeout: timeoutMs });

    // (2) ONE snapshot for everybody
    const snapshot = await captureSnapshot(handle.page, { scanId, url });

    // (3) load analyzers (either from opts, or dynamic-import the default a11y one)
    const analyzers = opts.analyzers ?? (await loadDefaultAnalyzers());
    const ctx: AnalyzerContext = { snapshot, page: handle.page, logger };

    // (4) element-iteration mode for Dracula/SSE — optional
    if (opts.elementIter) {
      emitter.emit({ kind: 'scan_started', scan_id: scanId, url, element_count: snapshot.domOutline.length });
      await runElementIteration({ scanId, emitter, snapshot, analyzers, page: handle.page, ctx });
    }

    // (5) parallel fan-out across the domain analysers
    const findings: Record<string, Finding[]> = {};
    const findingsByDomain = new Map<string, readonly Finding[]>();

    await Promise.all(
      analyzers.map(async (a) => {
        try {
          const f = await a.analyze(ctx);
          findings[a.domain] = f.map((x) => ({ ...x, scanId }));
          findingsByDomain.set(a.domain, findings[a.domain]);
        } catch (err) {
          logger.error({ err, analyzer: a.domain }, 'analyzer failed');
          findings[a.domain] = [];
          findingsByDomain.set(a.domain, []);
        }
      }),
    );

    // (6) cross-domain — findings only visible when two domains meet
    const detector = createCrossDomainDetector(analyzers);
    const conflicts = detector.detect(findingsByDomain, scanId);

    // (7) build report
    return { report: { scanId, url, snapshot, findings, conflicts, stats }, events: replay };
  } finally {
    await handle.close();
  }
}
```

---

## 5. Example analyzer implementation — `@ariada-org/rules-axe`

axe-core lives **inside** this package. The orchestrator has no direct dependency on it.

```ts
// packages/rules-axe/src/analyzer.ts
import { AxeBuilder } from '@axe-core/playwright';
import type { DomainAnalyzer, AnalyzerContext, ElementTarget } from '@ariada-org/core';

export function createA11yAnalyzer(opts = {}): DomainAnalyzer {
  const tags = opts.tags ?? ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'];

  return {
    domain: 'a11y',
    version: 'axe-core@4.x',
    ruleIds: [],

    async analyze(ctx: AnalyzerContext) {
      const page = ctx.page as Page;
      // axe-core injected by AxeBuilder — handles shadow DOM + iframes natively
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      return mapViolations(results.violations, ctx.snapshot.scanId);
    },

    async analyzeElement(ctx, target: ElementTarget) {
      const page = ctx.page as Page;
      const results = await new AxeBuilder({ page }).withTags(tags).include(target.selector).analyze();
      return mapViolations(results.violations, ctx.snapshot.scanId);
    },
  };
}
```

axe's output is mapped to the common `Finding` shape (one finding per violated node) and returned. The orchestrator doesn't care that axe was used — it could have been Siteimprove SDK, Pa11y, a custom engine, or a static AXTree analysis.

---

## 6. Future analyzers — where the multi-domain payoff appears

| Package (planned) | Domain | Engine / technique inside |
|---|---|---|
| `@ariada-org/rules-axe` ✅ shipped | `a11y` | axe-core 4.x via `@axe-core/playwright` |
| `@ariada-org/rules-lighthouse` | `cwv` (Core Web Vitals) | Lighthouse programmatic API, CDP `Performance.getMetrics` |
| `@ariada-org/rules-carbon` | `sustainability` | SWDM / SCI formulae over `snapshot.networkResources` |
| `@ariada-org/rules-gdpr` | `gdpr` | Cookie banner + consent-flow detection on the DOM outline |
| `@ariada-org/rules-seo` | `seo` | `<head>` meta + structured-data parser |
| `@ariada-org/rules-wsg` | `wsg` (Web Sustainability Guidelines) | Rule set mapped from W3C WSG draft |
| `@ariada-org/rules-contrast-ai` | `a11y-ai` | AI contextual analysis on top of the AX tree |

All of these consume the **same** `UnifiedSnapshot`. `browser.goto()` is still called exactly **once**, regardless of how many analyzers are registered. That is where the saving comes from: the browser is the expensive part, and it is paid for once.

Adding a new analyzer to an existing scan:

```ts
import { scan } from '@ariada-org/core';
import { createA11yAnalyzer } from '@ariada-org/rules-axe';
import { createCwvAnalyzer } from '@ariada-org/rules-lighthouse';    // future

const { report } = await scan('https://example.com', {
  analyzers: [createA11yAnalyzer(), createCwvAnalyzer()],
});
console.log(report.findings['a11y']);   // axe violations
console.log(report.findings['cwv']);    // Core Web Vitals regressions
console.log(report.conflicts);          // cross-domain interactions (§7)
```

`@ariada-org/core` never changes when a new analyzer ships.

---

## 7. Cross-domain conflict detector — the moat

Plugins declare the conflicts they know about in a **matcher matrix**:

```ts
export interface ConflictSignature {
  id: string;                                            // e.g. 'XD-001'
  domains: [Domain, Domain];                             // ['a11y', 'cwv']
  describe: string;
  match: (findingsByDomain: ReadonlyMap<Domain, readonly Finding[]>) => Finding[] | undefined;
}
```

`createCrossDomainDetector()` collects signatures from every registered analyzer and runs them against the aggregated findings map. Each match becomes a first-class `ConflictFinding` with `domain: 'cross'` and a `conflictingDomains` pair.

Example (PRD §5.5):

| ID | Pattern | Domains | What competitors miss |
|---|---|---|---|
| XD-001 | `<img loading="lazy">` inside `aria-live="polite"` | a11y ∩ cwv | Screen reader misses announcement after lazy image loads |
| XD-002 | Consent banner not keyboard-accessible | gdpr ∩ a11y | Users who can't use the mouse cannot accept/reject cookies |
| XD-003 | CWV image optimisation drops contrast below 4.5 : 1 | cwv ∩ a11y | `srcset` replacement violates WCAG 1.4.3 |
| XD-004 | Autoplay video violates WCAG + damages LCP | a11y ∩ cwv | Annoys SR users *and* inflates largest-contentful-paint |

A single-domain scanner **cannot** produce these findings — it only looks at one domain at a time.

### MVP state

In the MVP only `@ariada-org/rules-axe` is registered (one domain), so the detector returns `[]`. The code path is still exercised by tests (`tests/cross-domain.test.ts`) and is wired into the main scan flow, so the first additional analyzer lights the feature up automatically.

---

## 8. Layer model (how this maps to the architecture v1)

| Layer | Responsibility | Where it lives |
|---|---|---|
| **L0** | Browser automation (Playwright launch + `goto`) | `src/cdp.ts` |
| **L0'** | `UnifiedSnapshot` capture (AX tree, DOM, perf, network, screenshot) | `src/snapshot.ts` |
| **L1a** | Rule validation and confidence | *future* — `@ariada-org/registry-validator` |
| **L1b** | Multi-domain orchestrator | `src/scanner.ts` |
| **L1c** | Cross-domain interaction detector | `src/cross-domain.ts` |
| **L1d** | Contextual detection with a model | *future* — `@ariada-org/rules-contrast-ai` |
| **L2** | Rule engines per domain | `@ariada-org/rules-axe`, future `@ariada-org/rules-*` |
| **L3** | Reporters (SARIF / HTML / PDF) | *future* — `@ariada-org/reporter-*` |

`@ariada-org/core` owns L0, L0', L1b, L1c. Analyzer plugins own L2. Everything else is downstream.

---

## 9. FAQ

**Q. Why not fork axe-core and add non-a11y rules to it?**
Fork burden + licence (MPL-2.0) + losing Deque upstream fixes. Orthogonal concerns belong in orthogonal packages. axe-core does a11y brilliantly — let it keep doing that.

**Q. Why `Promise.all` rather than a worker pool?**
Analyzers are I/O-bound (CDP calls, axe injection, Lighthouse). For ≤4 concurrent analyzers `Promise.all` is simpler and fast enough. PRD R-TECH-4 tracks memory; if we ever ship 8+ analyzers we swap to `tinypool` (already listed as optional dep in the PRD).

**Q. What stops two analyzers from stepping on each other when they both talk to the page?**
The contract says analyzers **should only read the snapshot**. Those that need page-context (axe-core, Lighthouse) talk to Playwright — which is single-threaded per page, so the last analyzer's eval waits for the previous one to finish. Page access is discouraged but not forbidden for MVP; an enforcing wrapper is on the P2 list.

**Q. Does shadow-DOM / iframe transparency work in the MVP?**
Yes. axe-core walks shadow DOM natively, and CDP `Accessibility.getFullAXTree({ depth: -1 })` pulls iframe AX trees when we iterate frames in `snapshot.ts`. Both cases are covered by integration tests.

**Q. What part of this is already tested end-to-end?**
All of §4 (orchestrator flow), §5 (a11y plugin), §7 code-path (detector returns []), §8 layers L0/L0'/L1b/L1c/L2. Integration tests live at `packages/core/tests/integration/`.

---

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-04-20
- Status: DRAFT v0.1 — extracted from the session transcript where the question "how is multi-domain if axe is single-domain?" was asked. Keeps the architectural explanation in-repo alongside the code it describes.
