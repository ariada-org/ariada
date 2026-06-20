<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-feedback-mechanism

**Rule ID:** `ariada/statement/feedback-mechanism-present`
**Pack:** statement
**WCAG SC:** 3.2.6 Consistent Help (Level A, WCAG 2.2)
**EN 301 549 v3.2.1:** §12.1.1
**EAA Annex I §:** I.1 (General accessibility statement requirements)
**Impact:** serious

## What this rule checks

The rule operates on accessibility-statement pages and verifies that at least one operator-side feedback channel is offered: a `mailto:` link, a `tel:` link, or a link to a non-empty contact-form URL on the same domain. Statements that include only a postal address, only a chatbot widget, or only a phone-tree without a direct number fail.

## Why this matters under EAA 2025

Directive (EU) 2016/2102 art. 7 and EAA 2019/882 require operators to provide a feedback mechanism so users with disabilities encountering an accessibility barrier can report it directly. The Commission Implementing Decision (EU) 2018/1523 model statement requires the channel to be at least one of: email address, online form, or alternative described in detail. Postal addresses alone fail the model — they are too slow to be actionable for a barrier preventing the user from completing a task right now.

## Pass example

```html
<section>
  <h2>Feedback</h2>
  <p>If you encounter an accessibility issue, please contact us:</p>
  <ul>
    <li>Email: <a href="mailto:accessibility@example.org">accessibility@example.org</a></li>
    <li>Phone: <a href="tel:+46812345678">+46 8 123 456 78</a></li>
    <li><a href="/contact-form">Contact form</a></li>
  </ul>
</section>
```

## Fail example

```html
<section>
  <h2>Feedback</h2>
  <p>You may write to us at:</p>
  <address>Example AB, Box 123, 111 22 Stockholm, Sweden</address>
</section>
```

## Implementation notes

The check scans the page for `<a>` elements with `href` matching `mailto:.+`, `tel:.+`, or a relative/absolute URL on the same origin. At least one such link must exist within a section whose heading matches `/feedback|återkoppling|palaute|tilbagemelding|kontakt/i` OR within the first 2 KB of the statement body.

## Related

- [Rule pack INDEX](./INDEX.md)
- Directive (EU) 2016/2102 art. 7: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016L2102>
- Commission Implementing Decision (EU) 2018/1523: <https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32018D1523>
- EN 301 549 v3.2.1 §12.1.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
