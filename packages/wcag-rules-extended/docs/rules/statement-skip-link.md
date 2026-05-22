<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# statement-skip-link

**Rule ID:** `ariada/statement/skip-link-from-every-page`
**Pack:** statement
**WCAG SC:** 2.4.1 Bypass Blocks (Level A)
**EN 301 549 v3.2.1:** §9.2.4.1
**EAA Annex I §:** I.1 (General accessibility requirements)
**Impact:** moderate

## What this rule checks

The rule operates at document level and verifies the page contains a skip-link as the first focusable element in the DOM. The skip-link must be an `<a>` element pointing to a same-page anchor (`href="#main"`, `href="#content"`, `href="#main-content"`, or any fragment ID resolving to an element on the page). The link text or accessible name must match the multi-locale regex `/skip|hoppa|siirry|spring til|gå til/i`. Skip-links hidden via `display: none` instead of being visually-hidden-but-focusable fail.

## Why this matters under EAA 2025

Keyboard users without a pointer device must tab through page chrome (navigation, search, language switcher, account menu) before reaching the main content on every page load. WCAG 2.4.1 (Bypass Blocks) requires a mechanism to skip these repeated blocks. EN 301 549 §9.2.4.1 mirrors the WCAG requirement for EAA scope. While the rule lives in the statement pack (it is one of the line items every accessibility statement is expected to cover), the rule applies to every page on the site, not only the statement page.

## Pass example

```html
<body>
  <a href="#main" class="skip-link">Skip to main content</a>
  <header>…</header>
  <nav>…</nav>
  <main id="main">…</main>
</body>

<style>
  .skip-link {
    position: absolute;
    left: -9999px;
    top: 0;
  }
  .skip-link:focus {
    left: 0;
    background: #000;
    color: #fff;
    padding: 0.5em;
  }
</style>
```

## Fail example

```html
<body>
  <header>…</header>
  <nav>…</nav>
  <main>…</main>
</body>
```

## Implementation notes

The check inspects the first ten focusable elements in DOM order; the first one MUST be an `<a href="#…">` whose accessible name matches the skip-link regex. The fragment ID must resolve to an existing element on the page. If the link is styled with `display: none`, `visibility: hidden`, or zero dimensions WITHOUT a `:focus` rule that restores it, the rule fails.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 2.4.1: <https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html>
- WebAIM Skip Navigation Links: <https://webaim.org/techniques/skipnav/>
- EN 301 549 v3.2.1 §9.2.4.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
