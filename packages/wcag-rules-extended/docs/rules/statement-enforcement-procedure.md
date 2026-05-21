<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-enforcement-procedure

**Rule ID:** `ariada/statement/enforcement-procedure-link`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** moderate

## What this rule checks

The rule operates on accessibility-statement pages and verifies that an `<a href>` link points to the national enforcement procedure published by the EU Member State the operator falls under: DIGG (Sweden), Difi/Digdir (Norway), Digst (Denmark), AVI (Finland), and equivalent bodies for other Member States. The link must be present and live (the rule does not validate the URL responds; that is a separate CI concern). Statements that only describe how to complain — without a link to the supervisory authority — fail.

## Why this matters under EAA 2025

Directive (EU) 2016/2102 art. 7 and Commission Implementing Decision (EU) 2018/1523 mandate that accessibility statements include both a feedback mechanism (to the operator) AND a link to an enforcement procedure (to the national authority) so users dissatisfied with the operator's response can escalate. EAA 2019/882 mirrors this requirement for private-sector operators. Without the escalation link, the statement is missing one of the four legally required elements.

## Pass example

```html
<section>
  <h2>Enforcement procedure</h2>
  <p>
    If you are not satisfied with how we handle your feedback, you may contact
    the Swedish Agency for Digital Government:
    <a href="https://www.digg.se/en/digital-accessibility">DIGG</a>.
  </p>
</section>
```

## Fail example

```html
<section>
  <h2>Enforcement</h2>
  <p>If you are dissatisfied, please contact our support team.</p>
</section>
```

## Implementation notes

The check searches for `<a href>` whose destination matches a known enforcement-authority domain list (`digg.se`, `digdir.no`, `dst.dk`, `avi.fi`, `accessibility-monitoring.belgium.be`, etc.) OR whose accessible name matches the regex `/(enforcement procedure|tillsynsförfarande|valvontamenettely|håndhævelse)/i` within a section heading whose text suggests enforcement.

## Related

- [Rule pack INDEX](./INDEX.md)
- Directive (EU) 2016/2102 art. 7: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- Commission Implementing Decision (EU) 2018/1523: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- EU national supervisory authorities list: <https://digital-strategy.ec.europa.eu/en/policies/web-accessibility>
