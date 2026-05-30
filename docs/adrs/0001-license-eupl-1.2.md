<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-0001: License choice — EUPL-1.2

## Status

Accepted

## Date

2026-03-01

## Context

The project needed a copyleft license for the OSS accessibility rule pack that:

1. Provides network copyleft (SaaS loophole closed) — GPL-class protection without requiring the private scanner to be open-sourced, because the scanner is a separate work that imports but does not modify the rules package.
2. Is compatible with the EU public sector procurement ecosystem and NLnet Foundation Commons Fund.
3. Allows narrow patent peace for OSS users without triggering an implicit patent grant on the full portfolio of 9 USPTO provisional applications covering the proprietary scanner logic.
4. Does not cause downstream package consumers to violate their own license stacks.

Three candidates were evaluated: Apache-2.0, GPL-3.0, and EUPL-1.2.

**Apache-2.0** was rejected on patent-grant scoping grounds. Section 3 («Grant of Patent License») licences, from each Contributor to every recipient, exactly those of the Contributor's patent claims that are necessarily infringed by the Contribution alone or by the combination of the Contribution with the Work to which it was submitted — not the Contributor's full patent portfolio. The licence is therefore not a blanket-portfolio grant. The concern for this project is the «in combination with the Work» limb: rule-pack contributions are intended to interoperate with adjacent compliance-tooling work in the maintainer's wider portfolio, and reasoning about which claims become licensable under Apache-2.0 §3 in that combined-Work scenario adds legal uncertainty the project would rather avoid. EUPL-1.2's narrower, project-scoped patent peace removes that ambiguity.

**GPL-3.0** was considered. It closes the SaaS loophole only via AGPL-3.0, not GPL-3.0. AGPL-3.0 would require open-sourcing the hosted scanner, which is the proprietary core of the commercial product — not acceptable.

**EUPL-1.2** was chosen because:

- It is a copyleft license (§5 «Obligations of the Licensee») with a SaaS-applicable scope.
- Its Appendix lists 14 compatible licenses, including LGPL-2.1+, GPL-2.0+, AGPL-3.0 — sufficient for ecosystem compatibility.
- It does not contain a patent retaliation clause that would trigger an implied patent grant across unrelated portfolio claims.
- The narrow Article 2 patent peace pledge in the package's `NOTICE` file scopes the patent grant to the published OSS implementation only.
- It is the preferred license for EU public-sector software (Joinup catalogue) and is familiar to NLnet-funded projects.

## Decision

All code in the `ariada-org/ariada` monorepo is licensed under EUPL-1.2 unless a package `package.json` explicitly states otherwise. Test fixtures use CC0-1.0 (no copyright restriction on HTML fragments). Brand tokens use MIT (maximum downstream reuse). Every file carries a per-file SPDX-License-Identifier header per REUSE 3.3 specification.

## Consequences

- **Positive:** patent portfolio protection; NLnet alignment; EU public-sector procurement readiness; strong copyleft without AGPL burden on the proprietary scanner.
- **Negative:** EUPL-1.2 is less widely known than Apache-2.0 or MIT among JavaScript ecosystem contributors, requiring explicit education in `CONTRIBUTING.md` and `GOVERNANCE.md`.
- **Neutral:** npm trusted-publisher provenance (OIDC) and Changesets tooling are license-agnostic — no tooling changes required.

## Alternatives considered

- Apache-2.0: rejected (implicit patent grant on unrelated portfolio claims).
- AGPL-3.0: rejected (SaaS-available, but requires open-sourcing the proprietary scanner).
- GPL-3.0: rejected (does not close the SaaS loophole without AGPL).
- MIT: rejected (permissive — allows proprietary forks of the rules pack without reciprocity).

## References

- EUPL-1.2 full text: `LICENSE`
- Per-file SPDX compliance: `REUSE.toml`
- Narrow patent peace statement: `packages/wcag-rules-extended/NOTICE`
- IP separation boundary: `packages/wcag-rules-extended/IP_NEGATIVE_LIST.md`
- NLnet Commons Fund license expectations: https://nlnet.nl/commonsfund/
