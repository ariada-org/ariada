# @ariada-org/penalty-estimator

EAA / national-law penalty exposure estimator — per-jurisdiction administrative-fine rate-cards for accessibility violations.

Open source under [EUPL-1.2](./LICENSE).

> **Not legal advice.** This is an empirical risk-modelling tool to inform remediation prioritisation. Penalty levels are statutory maxima per cited law; actual enforcement varies widely. Always consult counsel before relying on figures for budgeting.

## What this package does

Given a violation list + a target jurisdiction, returns an estimated penalty-exposure range in EUR. Rate-cards model the transposition of Directive (EU) 2019/882 (European Accessibility Act) plus adjacent consumer-protection laws.

## Supported jurisdictions

| Code | Country        | Primary law                                                              |
| ---- | -------------- | ------------------------------------------------------------------------ |
| SE   | Sweden         | Lag 2018:1937 (DOS-lagen) + Marknadsföringslagen                         |
| NO   | Norway         | Likestillings- og diskrimineringsloven §17 + tilgjengelighetsforskriften |
| DK   | Denmark        | Lov om tilgængelighed (LBK 692/2020)                                     |
| FI   | Finland        | Saavutettavuuslaki 306/2019                                              |
| DE   | Germany        | Barrierefreiheitsstärkungsgesetz (BFSG, 2021) + UWG                      |
| FR   | France         | Loi 2005-102 art. 47 + Décret 2019-768                                   |
| NL   | Netherlands    | Tijdelijk besluit digitale toegankelijkheid overheid                     |
| AT   | Austria        | WZG 2020 + Konsumentenschutzgesetz                                       |
| CH   | Switzerland    | BehiG (non-EU, included for completeness)                                |
| UK   | United Kingdom | Equality Act 2010 + EHRC enforcement                                     |
| EU   | EU aggregate   | DSA art. 35 + UCPD 2005/29 ceiling                                       |

## Install

```bash
npm install @ariada-org/penalty-estimator
```

## Quick start

```ts
import {
  estimatePenalty,
  listJurisdictions,
} from "@ariada-org/penalty-estimator";
import type { Violation } from "@ariada-org/evidence-emitter";

const violations: Violation[] = [
  /* axe-core results normalized to Violation shape */
];

const estimate = estimatePenalty(violations, "SE");

console.log(estimate.maxPenaltyEur, estimate.expectedRiskEur);
console.log(estimate.lawReferences);
console.log(estimate.authority);
// estimate.explanation — per-violation breakdown lines (human-readable)
```

Sector multipliers (banking, e-commerce) are applied automatically when
`Violation.eaaAnnexI` includes `'I.3'` (e-commerce) or `'I.4'` (banking).
Override the empirical `enforcementFactor` (or pass `annualTurnoverEur`
for DSA-style turnover scaling) via the optional third argument:

```ts
const dsa = estimatePenalty(violations, "EU", {
  annualTurnoverEur: 250_000_000,
  enforcementFactor: 0.5,
});
```

## Standards

- [Directive (EU) 2019/882 (EAA)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882)
- [Directive 2005/29 (UCPD)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32005L0029)

## License

[EUPL-1.2](./LICENSE). See [NOTICE](./NOTICE) for the patent peace pledge.

## Part of the Ariada OSS platform

This package is one component of the open-core Ariada accessibility-compliance platform. See [ariada.org](https://ariada.org) for the full pipeline.
