<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# ADR 0005 — Rule ID naming convention: `ariada/<pack>/<kebab-case>`

| Field   | Value                                                          |
|---------|----------------------------------------------------------------|
| Status  | Accepted                                                       |
| Date    | 2026-05-14                                                     |
| Authors | Agonist Development AB (Sweden)                                |

## Context

Every rule needs a stable, unique identifier that is used in: axe-core's rule registry, the test fixtures, the per-rule markdown docs, the package's CHANGELOG, and any downstream baseline-comparison tooling. The identifier must avoid collision with axe-core's own rule IDs (e.g., `color-contrast`, `aria-required-parent`).

## Decision

Use the namespace-prefixed kebab-case form: `ariada/<pack>/<rule-name>`. Examples: `ariada/checkout/payment-fieldset-grouping`, `ariada/banking/2fa-keyboard-accessible`, `ariada/statement/page-link-from-footer`.

## Rationale

Three components, each justified:

1. **`ariada/` namespace prefix.** Disambiguates from axe-core's own rules and from any other third-party axe extension. The same convention is used by other axe-core extension projects (e.g., `axe-pdf/*`, `axe-deque-android/*`). The prefix tracks the project name, not the company name, so that if Ariada changes ownership the rule IDs do not have to be rewritten.
2. **`<pack>` segment.** Identifies which of the three packs the rule belongs to (`checkout`, `statement`, `banking`). Lets baseline-comparison tooling group rules by pack without parsing rule metadata. Lets contributors discover related rules without scanning the full catalogue.
3. **`<rule-name>` segment in kebab-case.** Standard JavaScript / web convention for identifiers that appear in attributes, CSS, or config keys. Mirrors axe-core's own rule-name style.

The internal `checkDefinition.id` follows the same pattern with a verb-prefixed suffix (e.g., `ariada/checkout/payment-radio-in-group` for the check, paired with `ariada/checkout/payment-fieldset-grouping` for the rule). The verb suffix makes the check ID readable as a sentence ("payment radio in group"), while the rule ID reads as a topic ("payment fieldset grouping").

## Consequences

- All 31 rule IDs in v0.1.0 follow this convention; no exceptions.
- A future Pack D (e.g., `transport`, `audiovisual`, `books` for EAA Annex I §I.5-§I.7) will use the same convention, with the pack slug as the second segment.
- Renaming a rule is a breaking change because the rule ID appears in user-side configuration. Renames are deferred to major-version releases and listed explicitly in the CHANGELOG.
- The rule ID and the markdown filename do not match exactly: the rule ID `ariada/checkout/payment-fieldset-grouping` corresponds to `docs/rules/checkout-payment-fieldset-grouping.md` (flat structure, no slashes in filenames). This is documented in the rule's frontmatter.

## References

- axe-core rule IDs reference: <https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md>
- `src/rules/index.ts` aggregates all 31 rule IDs.
