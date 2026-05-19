<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC0-1.0 -->
---
name: Rule proposal
about: Propose a new WCAG / EN 301 549 / EAA rule for one of the rule packs
title: "rule: <pack>/<short-rule-id>"
labels: [rule-proposal, needs-triage]
assignees: []
---

## Proposed rule ID

<!-- Suggested ID, e.g. `ariada/checkout-discount-code-feedback`. The maintainer may rename during triage. -->

- Pack: <!-- checkout / statement / banking / new pack (specify) -->
- Rule ID (suggested):
- Severity: <!-- error / warn / info -->

## Mapping to standards

- **WCAG 2.2 SC**: <!-- e.g. 1.3.1, 2.4.4, 3.3.2 — link to W3C Understanding doc -->
- **EN 301 549 v3.2.1 paragraph**: <!-- e.g. 9.1.3.1 -->
- **EAA Annex I §**: <!-- e.g. I.3 e-commerce / I.4 banking / I.5 e-books / I.6 audiovisual / I.7 transport -->
- **National law (optional)**: <!-- e.g. Sweden DOS-lagen §, Norway Diskriminerings- og tilgjengelighetsloven, etc. -->

## What does the rule check?

<!-- Plain-language description of the rule's pass/fail condition. -->

## Check selector + matcher sketch

<!-- Pseudocode or TypeScript stub. -->

```ts
// Selector
selector: '...',

// Matcher (sketch)
evaluate(node, options, virtualNode) {
  // ...
}
```

## Similar existing rules — check before filing

- [ ] I have searched `src/**` for similar selectors / matchers and confirmed this rule is not already covered.
- [ ] I have checked `axe-core` upstream rules (`https://github.com/dequelabs/axe-core/tree/develop/lib/rules`) and the rule is not covered there.
- [ ] I have checked `IBM Equal Access Accessibility Checker` (`https://github.com/IBMa/equal-access`) rule list and noted overlap / differences.

## Test fixtures expected

<!-- Briefly describe PASS / FAIL fixtures the rule will need. -->

- PASS example(s):
- FAIL example(s):

## Locale considerations

<!-- Does the rule need localised matcher strings? Which of en / sv / nb / da / fi need expert review? -->

## Additional context

<!-- References to regulator guidance, court cases, vendor reports, etc. -->
