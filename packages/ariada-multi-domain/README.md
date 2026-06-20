# @ariada-org/multi-domain

Single-jurisdiction accessibility-scan reference orchestrator plus a
`JurisdictionPlugin` extension contract for community-authored rule
packs.

Open source under [EUPL-1.2](./LICENSE).

## What this package does

This package publishes three things:

1. A canonical `ScanEvent` data contract that downstream
   accessibility-compliance tooling consumes.
2. A `JurisdictionPlugin` extension interface that community
   implementers use to register additional accessibility
   jurisdictions (for example Canada AODA, Japan JIS X 8341-3).
3. A reference orchestrator that dispatches one scan against exactly
   one registered jurisdiction plugin and emits a `ScanEvent`.

The reference orchestrator is enough to exercise the contract
end-to-end, validate a community-authored plugin, and serve as a
working example for downstream tools.

## What this package does NOT do

The reference orchestrator deliberately runs one jurisdiction at a
time. The package does not implement:

- multi-jurisdiction execution in a single pass;
- cross-jurisdiction conflict detection or resolution;
- consensus / normalisation heuristics across multiple jurisdictions;
- production rule packs (those live in sibling packages such as
  `@ariada-org/wcag-rules-extended`).

Community implementers may build their own multi-jurisdiction
orchestrator on top of the `JurisdictionPlugin` contract published
here.

## Install

```bash
npm install @ariada-org/multi-domain
```

## Quick start

```ts
import {
  JurisdictionRegistry,
  SingleJurisdictionOrchestrator,
  sePlugin,
} from '@ariada-org/multi-domain';

const registry = new JurisdictionRegistry();
registry.register(sePlugin);

const orchestrator = new SingleJurisdictionOrchestrator({
  registry,
  scannerVersion: '0.1.0',
  ruleEngineVersion: '0.1.0',
  deps: {
    captureSnapshot: async () => ({
      domHash: 'a'.repeat(64),
      axTreeHash: 'b'.repeat(64),
      cssomHash: 'c'.repeat(64),
      screenshotRefs: [],
      viewports: [{ label: 'desktop', width: 1280, height: 800 }],
    }),
    evaluateRules: async () => [],
    newId: () => '01HXYZSCANID0000000000000A',
    now: () => new Date(),
  },
});

const event = await orchestrator.scan({
  url: 'https://example.se',
  jurisdictions: ['SE'],
});
console.log(event.perJurisdiction['SE']);
```

## API

| Export                              | Type      | Description                                                                |
| ----------------------------------- | --------- | -------------------------------------------------------------------------- |
| `SingleJurisdictionOrchestrator`    | class     | Runs one scan against one registered plugin and emits a `ScanEvent`.       |
| `JurisdictionRegistry`              | class     | In-memory plugin registry with idempotent registration semantics.          |
| `validatePluginShape`               | function  | Validates the structure of a `JurisdictionPlugin` value.                   |
| `matchJurisdictionFromHints`        | function  | Pure helper that maps URL / `<meta>` / `<html lang>` hints to a plugin.    |
| `computePassRate`                   | function  | Pure helper that computes success-criterion pass rate from findings.       |
| `sePlugin`, `dePlugin`, `euEaaPlugin` | constants | Minimal reference plugins for Sweden, Germany, and the EU EAA umbrella.    |

Type-only exports (`ScanEvent`, `Finding`, `JurisdictionSubset`, etc.)
are also published for downstream consumers.

## Writing a plugin

Copy one of the reference plugins as a starting point:

```ts
import type { JurisdictionPlugin } from '@ariada-org/multi-domain';

export const myPlugin: JurisdictionPlugin = {
  jurisdictionCode: 'XX',
  jurisdictionLabel: 'Country X',
  governingRegulation: 'Statute citation',
  technicalStandard: 'EN 301 549 v3.2.1 + WCAG 2.2 Level AA',
  supervisoryAuthority: 'Authority name',
  tldHints: ['xx'],
  metaHints: [],
  langAttrHints: ['xx'],
  rulePackId: '@ariada-org/wcag-rules-extended',
  rulePackVersion: '0.1.0',
  emitJurisdictionSubset(ctx) {
    /* … */
  },
};
```

Register it against a `JurisdictionRegistry` instance:

```ts
registry.register(myPlugin);
```

## Standards

- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/)
- [EN 301 549 v3.2.1 — ETSI](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)
- [Directive (EU) 2019/882 — European Accessibility Act](https://eur-lex.europa.eu/eli/dir/2019/882/oj)

## License

[EUPL-1.2](./LICENSE). See [NOTICE](./NOTICE) for the package scope statement.
