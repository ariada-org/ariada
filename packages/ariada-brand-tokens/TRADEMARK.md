# Trademark Policy

This document records the trademark posture of this open-source repository.
It is a public-facing trademark policy for Agonist Development AB marks used in this repository.

## Reserved marks (Agonist Development AB)

The following names and figurative marks are reserved by Agonist Development AB
(Sweden, registration number 559452-5726):

- **Ariada**
- **Ariadne** / **Ariadne's Thread**
- **Blamer**
- **Clamper**
- **Reverter**
- **Draculascan**
- Ariada figurative mark («Ariadne thread» logo)

These marks may not be used in:

- Fork names, fork package names, or fork organisation names;
- Marketing copy that suggests endorsement or affiliation with Agonist Development AB;
- Domain names that could create consumer confusion (e.g. `ariada-foo.com`, `ariada-brand-tokens-pro.com`, `ariada-brand-tokens-cloud.com`, `ariada-brand-tokens-official.com`);
- Trademark applications in any jurisdiction.

The MIT licence under which the CSS design tokens are distributed grants
copyright permissions only — it does not transfer trademark rights. The
brand logo SVG files were intentionally left in the private monorepo precisely
because they are trademark-restricted and would create downstream brand
confusion if mistakenly re-distributed.

## Permitted usage

Downstream users (consumers of this package) MAY:

- Mention «Powered by Ariada brand tokens» in their site / docs;
- Link to `https://ariada.org`;
- Include the Ariada brand badge from the official brand pack
  (`https://ariada.org/brand`, when available).

Forks of this package MAY:

- Credit «Originally derived from `@ariada-org/brand-tokens`» as historical
  attribution;
- Reference the public MIT licence terms.

Forks of this package MAY NOT:

- Use any reserved mark in the fork name (e.g. `ariada-tokens-mine` is not
  acceptable; `brand-tokens-mine` or any non-Ariada-named alternative is);
- Use the Ariada figurative mark or any visual brand element;
- Imply endorsement by or affiliation with Agonist Development AB.

If you fork these tokens to ship a derivative product, please re-name the
product CSS files AND the brand-identifier custom-property names
(`--c-brand-*`, `--c-ariada-*`) so downstream users do not mistake your
product for an Agonist Development AB product.

## Dispute resolution

Trademark disputes are resolved via:

1. Good-faith friendly outreach (≥3 weeks);
2. Formal cease-and-desist via Swedish IP attorney;
3. EUIPO opposition or domain-name UDRP filing for confusing names;
4. Civil action as last resort.

Trademark action is reserved for genuine confusion or bad-faith use, not for
good-faith community variants. Send trademark concerns to:
`trademark@ariada.org` (or open a public issue if non-sensitive).

Full public terms: `https://ariada.org/legal/trademark`.

## Why trademarks matter for OSS

Trademarks protect downstream users from confusion. A fork that adopts the
Ariada name could mislead users into thinking the fork was reviewed, supported,
or endorsed by Agonist Development AB. The trademark restriction ensures
users can always trace the authentic upstream by the «Ariada» mark, while
permissionless copyright remains intact via the MIT licence.

This is the same model used by Mozilla, the Linux Foundation, the Apache
Software Foundation, and other OSS-trademark-aware projects.

---

_Document version: 0.2 (2026-05-16). Public trademark policy of Agonist Development AB._
