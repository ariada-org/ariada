<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# First-party per-domain, per-rule fixture corpus

Our own known-bad corpus — modelled on axe-core's `test/integration/rules/<rule>/`
layout, but organised first by **domain**, then by **rule** inside it, because
the product scans more than accessibility (privacy, security, sustainability,
structured-data, AI-readiness). Every rule a domain claims to support gets one
fixture folder, so the all-rules coverage check is "serve each folder, assert the
matching rule fires, and nothing else does".

These fixtures are authored by us (not vendored) so they carry our own licence
and can ship in the public package. The downloaded vendor corpus
(`../vendor-known-bad/`) stays the cross-check reference.

## Layout

```
fixtures/domains/
  <domain>/                       e.g. accessibility, privacy, security,
    <rule>/                            sustainability, structured-data, ai-readiness
      <rule>.html                 one self-contained page: each case wrapped in an
                                  element with a stable id (fail-N / pass-N)
      <rule>.expected.json        the oracle — which case must fail/pass, on which
                                  selector, at which severity, mapped to a standard
  domains-index.json              generated: domain -> rules -> fixture paths
```

## `<rule>.html` rules

- One self-contained HTML document, no external assets, no network.
- Each **case** is a single element (or minimal subtree) with `id="fail-1"`,
  `id="fail-2"`, `id="pass-1"`, … — ids are the join key to the oracle.
- Include at least one failing case (the point) and at least one passing control
  (so a rule that flags everything is caught).
- Markup triggers **only** the target rule where practical; note unavoidable
  incidental findings in the oracle's `alsoExpect`.

## `<rule>.expected.json` schema

```json
{
  "domain": "accessibility",
  "rule": "color-contrast",
  "standard": ["WCAG 2.2 SC 1.4.3"],
  "cases": [
    { "id": "fail-1", "selector": "#fail-1", "expect": "fail",
      "severity": "serious", "why": "1.9:1 ratio on body text, below 4.5:1" },
    { "id": "pass-1", "selector": "#pass-1", "expect": "pass" }
  ],
  "alsoExpect": []
}
```

- `expect`: `fail` | `pass`.
- `severity`: `minor` | `moderate` | `serious` | `critical` (omit for `pass`).
- `standard`: the public standard reference(s) — WCAG SC, EN 301 549 clause, GDPR
  article, etc. (public references only — never an internal taxonomy code).
- `alsoExpect`: other rule ids that legitimately also fire on this page.

## Coverage contract

A CI job serves every `<rule>/<rule>.html` in its domain, runs the domain
analyzer, and asserts: every `fail-*` case is reported by the matching rule at
the stated severity, every `pass-*` case is clean. The generated
`domains-index.json` is the loop's input; a domain rule with no fixture folder
is a coverage gap and fails the check.

## Update

- Author: Alexander Brichkin (Agonist Development AB) · Date: 2026-06-16
