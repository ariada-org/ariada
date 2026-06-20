<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-methodology

**Rule ID:** `ariada/statement/methodology-disclosed`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** minor

## What this rule checks

The rule operates on accessibility-statement pages and verifies the document discloses how the conformance assessment was performed. The acceptable disclosures, per Commission Implementing Decision (EU) 2018/1523 §3, are: "self-assessment", "self-evaluation", "third-party assessment", "external audit", "automated testing", or an explicit combination of the above. A statement that simply asserts conformance without methodology disclosure fails.

## Why this matters under EAA 2025

Methodology disclosure is what lets users and supervisory authorities calibrate their trust in the statement's claims. A third-party audit by a known accessibility consultancy carries different weight than an automated-tool sweep performed once. The 2018/1523 model decision §3 lists methodology as a mandatory element precisely to make the trust-calibration explicit. Without it, the statement is opaque.

## Pass example

```html
<section>
  <h2>How this statement was prepared</h2>
  <p>This statement was prepared based on a third-party assessment
     performed by Example Consulting AB on 2026-03-15, supplemented by
     automated axe-core scans run weekly during 2026 Q2.</p>
</section>

<section>
  <h2>Methodology</h2>
  <p>The conformance assessment combines self-evaluation by the
     development team with automated testing using axe-core 4.10
     and Pa11y 9.0.</p>
</section>
```

## Fail example

```html
<section>
  <h2>About this statement</h2>
  <p>We have made every effort to comply with WCAG 2.2 AA.</p>
</section>
```

## Implementation notes

The check applies a case-insensitive regex over the page body looking for at least one methodology keyword (`self-assessment`, `self-evaluation`, `third-party`, `external audit`, `automated testing`, plus Nordic-locale equivalents `självvärdering`, `extern granskning`, `itsearviointi`, `kolmannen osapuolen`, `selvevaluering`). At least one keyword must appear within 500 characters of a methodology-section heading.

## Related

- [Rule pack INDEX](./INDEX.md)
- Commission Implementing Decision (EU) 2018/1523 §3: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- WAI Easy Checks: <https://www.w3.org/WAI/test-evaluate/easy-checks/>
- EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
