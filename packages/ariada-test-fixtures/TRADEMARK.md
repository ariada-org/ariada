# Trademark Policy

This document records the trademark posture of this open-source repository.
It is a public-facing trademark policy for Agonist Development AB marks used in this repository.

## Reserved marks (Agonist Development AB)

The following names and figurative marks are reserved by Agonist Development AB
(Sweden, registration number 559452-5726):

- **Ariada**
- **Blamer**
- **Clamper**
- **Reverter**
- **Draculascan**
- Ariada figurative mark («Ariadne thread» logo)

These marks may not be used in:

- Fork names, fork package names, or fork organisation names;
- Marketing copy that suggests endorsement or affiliation with Agonist Development AB;
- Domain names that could create consumer confusion (e.g. `ariada-foo.com`, `ariada-test-fixtures-pro.com`, `ariada-test-fixtures-cloud.com`, `ariada-test-fixtures-official.com`);
- Trademark applications in any jurisdiction.

This restriction applies notwithstanding the broad copyright license granted under
EUPL-1.2 §2. The EUPL-1.2 license explicitly does not grant trademark rights
(EUPL-1.2 §5: «The Licence does not grant permission to use the trade names,
trademarks, service marks, or names of the Licensor [...]»).

## Third-party marks in fixture filenames (informational)

The `fixtures/eu-real-world/` directory contains files named with a `-style-`
suffix (e.g. `klarna-style-checkout-sv.html`, `bankid-style-authentication-sv.html`,
`mobilepay-style-merchant-flow-dk.html`). These names imitate the visual and
interaction patterns of well-known EU services WITHOUT using any third-party
brand assets, logo files, or trade-marks:

- No Klarna, BankID, MobilePay, or other third-party logos, fonts, colour
  systems, or copyrighted UI assets are embedded in these fixtures.
- The third-party names appear only in filenames and in-file provenance
  comments for findability and disambiguation; they are nominative references,
  not endorsement claims.
- Each fixture is a clean-room re-implementation dedicated to CC0-1.0 per
  the in-file `License: CC0-1.0` provenance header.

Downstream redistributors who fork this package SHOULD keep the `-style-`
naming convention or rename to remove the third-party reference entirely; they
MUST NOT remove the `-style-` suffix while keeping the third-party name (which
would create a stronger endorsement implication).

## Permitted usage (Ariada marks)

Downstream users (consumers of this package) MAY:

- Mention «Powered by Ariada (test-fixtures corpus)» in their site / docs;
- Link to `https://ariada.org`;
- Include the Ariada brand badge from the official brand pack
  (`https://ariada.org/brand`, when available).

Forks of this package MAY:

- Credit «Originally derived from `@ariada-org/test-fixtures`» as historical
  attribution;
- Reference the public EUPL-1.2 license terms.

Forks of this package MAY NOT:

- Use any reserved Ariada mark in the fork name (e.g. `ariada-fixtures-mine`
  is not acceptable; `test-fixtures-mine` or any non-Ariada-named alternative is);
- Use the Ariada figurative mark or any visual brand element;
- Imply endorsement by or affiliation with Agonist Development AB.

## Dispute resolution

Trademark disputes are resolved via:

1. Good-faith friendly outreach (≥3 weeks);
2. Formal cease-and-desist via Swedish IP attorney;
3. EUIPO opposition or domain-name UDRP filing for confusing names;
4. Civil action as last resort.

Trademark action is reserved for genuine confusion or bad-faith use, not for
good-faith community variants. Send trademark concerns to:
`trademark@ariada.org` (or open a public issue if non-sensitive).

## Why trademarks matter for OSS

Trademarks protect downstream users from confusion. A fork that adopts the
Ariada name could mislead users into thinking the fork was reviewed, supported,
or endorsed by Agonist Development AB. The trademark restriction ensures
users can always trace the authentic upstream by the «Ariada» mark, while
permissionless copyleft remains intact via EUPL-1.2.

This is the same model used by Mozilla, the Linux Foundation, the Apache
Software Foundation, and other OSS-trademark-aware projects.

---

_Document version: 0.2 (2026-05-16). Public trademark policy of Agonist Development AB._
