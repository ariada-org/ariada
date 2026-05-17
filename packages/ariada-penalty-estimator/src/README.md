# EAA penalty exposure estimator

Models financial penalty exposure under EU member-state and adjacent
national accessibility laws (transpositions of Directive 2019/882, the
European Accessibility Act).

**NOT legal advice.** This is an empirical risk-modelling tool to inform
remediation prioritisation. Actual enforcement varies widely by
jurisdiction, sector, complaint volume, and political climate. Always
consult counsel before relying on figures for legal-budget decisions.

## Usage

```ts
import { estimatePenalty, listJurisdictions } from '@ariada/penalty-estimator';

const violations = [
  {
    id: 'color-contrast',
    description: 'Insufficient contrast',
    help: 'Fix contrast ratio',
    impact: 'serious',
    wcag: ['1.4.3'],
    eaaAnnexI: ['I.3'],
    nodeCount: 4,
  },
];

const r = estimatePenalty(violations, 'SE');
// → { jurisdiction: 'SE', maxPenaltyEur: 1_000_000, expectedRiskEur: 90_000,
//     lawReferences: ['Lag 2018:1937 …', …], authority: 'DIGG …', explanation: […] }
```

## Supported jurisdictions

| Code | Country         | Statutory max (EUR) | Primary law                                       |
|------|-----------------|---------------------|---------------------------------------------------|
| SE   | Sweden          | 1 000 000           | Lag 2018:1937 (DOS-lagen) + Marknadsföringslagen  |
| NO   | Norway          | 500 000             | Likestillings- og diskrimineringsloven §17        |
| DK   | Denmark         | 800 000             | LBK 692/2020                                      |
| FI   | Finland         | 1 000 000           | Saavutettavuuslaki 306/2019                       |
| DE   | Germany         | 100 000             | BFSG §37 + UWG §3a                                |
| FR   | France          | 75 000              | Loi 2005-102 art. 47 + Décret 2019-768            |
| NL   | Netherlands     | 90 000              | Wbtw (pending) + Tijdelijk besluit digitale toeg. |
| AT   | Austria         | 80 000              | BGStG + WZG 2018                                  |
| CH   | Switzerland     | 50 000              | BehiG                                             |
| UK   | United Kingdom  | uncapped            | Equality Act 2010 §29 + EHRC                      |
| EU   | EU at-large     | 35 000 000          | Directive 2019/882 art. 30 + DSA art. 35          |

## Model

For each violation:

```
perViolation = baseFineEur
  × (seriousMultiplier if impact >= serious else 1)
  × (banking_OR_ecommerce_multiplier from eaaAnnexI)
  × min(nodeCount, 10)

expectedRiskEur = perViolation × enforcementFactor
```

Then sum across all violations, optionally scale by annual turnover
(DSA-style 1×–5× scaling between €10M and €500M turnover), and clamp
to the statutory maximum.

The `enforcementFactor` is empirically calibrated per jurisdiction from
public regulator enforcement reports (DIGG 2021-2024, BfIT 2022-2025,
DGCCRF, EHRC 2022).

## Sensitivity analysis

Override `enforcementFactor` to test optimistic / pessimistic scenarios:

```ts
const optimistic = estimatePenalty(violations, 'DE', { enforcementFactor: 0.1 });
const pessimistic = estimatePenalty(violations, 'DE', { enforcementFactor: 0.8 });
```

Override `annualTurnoverEur` to apply DSA scaling:

```ts
const dsa = estimatePenalty(violations, 'EU', { annualTurnoverEur: 250_000_000 });
```

## Sources

- Directive (EU) 2019/882 (European Accessibility Act):
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882
- Directive 2005/29/EC (UCPD) art. 13 penalty floors:
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32005L0029
- Regulation (EU) 2022/2065 (DSA) art. 35:
  https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022R2065
- Per-jurisdiction laws cited inline in `JURISDICTION_PROFILES`.

## Limitations

- Statutory maxima reflect single-infringement caps. Repeated /
  systematic infringements may compound.
- UK Equality Act 2010 is **uncapped** (no statutory limit on
  damages awarded by court). The estimator uses raw modelled
  exposure without capping for UK.
- Penalties for **public-sector** entities follow different scales
  (Directive 2016/2102 vs EAA). This estimator targets private-sector
  EAA penalties.
- Numbers are first-order estimates; second-order effects (reputational
  damage, class actions, settlement loops) are not modelled.

## Versioning

Penalty levels reflect statutes as of **2026-05-15**. Re-check national
law amendments before relying on figures for any commitments. Track
changes via the package `CHANGELOG.md`.
