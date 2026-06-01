<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# ebooks-no-positive-tabindex-in-reading

**Rule ID:** `ariada/ebooks/no-positive-tabindex-in-reading`
**Pack:** ebooks
**WCAG SC:** 2.4.3 Focus Order (Level A), 1.3.2 Meaningful Sequence (Level A)
**EN 301 549 v3.2.1:** §9.2.4.3, §9.1.3.2
**EAA Annex I §:** I.5 (E-books and dedicated software)
**Impact:** moderate

## What this rule checks

The rule inspects elements that carry a `tabindex` attribute and sit inside a reading region — an `<article>`, an element with `role="document"` or `role="article"`, or an element carrying `data-reading-content`. It fails when the `tabindex` parses to a positive integer (greater than 0), because a positive `tabindex` pulls the element to the front of the tab cycle regardless of where it sits in the text, scrambling the order in which a keyboard or screen-reader user reaches footnotes, links, and controls. A `tabindex` of `0` or a negative value passes, as does a non-numeric value (which proves no forced ordering). Elements with a `tabindex` outside any reading region, and elements with no `tabindex` at all, are skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires e-books and dedicated reading software (Annex I §I.5) to present content in an operable, predictable order. Inside a reading surface the keyboard focus order should follow the natural reading sequence, which is the DOM order. A positive `tabindex` breaks that sequence and forces keyboard users through the text in an order that does not match what they read. EN 301 549 v3.2.1 §9.2.4.3 echoes WCAG 2.4.3 (Focus Order) and §9.1.3.2 echoes WCAG 1.3.2 (Meaningful Sequence).

## Pass example

```html
<article>
  <a href="#note-1" tabindex="0">footnote 1</a>
</article>
```

## Fail example

```html
<article>
  <a href="#note-1" tabindex="1">footnote 1</a>
</article>
```

## Implementation notes

A reading region is recognised by tag (`article`), by ARIA role (`document` or `article`), or by the `data-reading-content` marker attribute. The check first confirms the element both has a `tabindex` and is nested inside one of those roots; otherwise it is skipped. The value is parsed as a base-10 integer: a non-numeric `tabindex` such as `auto` passes because no positive forced ordering can be proven, and any value at or below 0 passes. Only a strictly positive integer fails.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.4.3 Focus Order: <https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html>
- WCAG Understanding 1.3.2 Meaningful Sequence: <https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html>
