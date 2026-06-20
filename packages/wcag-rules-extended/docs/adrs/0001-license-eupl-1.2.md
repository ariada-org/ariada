<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# ADR 0001 — License: EUPL-1.2

| Field   | Value                                                          |
|---------|----------------------------------------------------------------|
| Status  | Accepted                                                       |
| Date    | 2026-05-13                                                     |
| Authors | Agonist Development AB (Sweden)                                |

## Context

The package needs a license that is acceptable to NLnet / NGI Zero Commons (the upcoming grant funder), to EU public-sector procurers, and to small and medium European businesses that intend to use the rule library in their own compliance pipelines. The candidates considered were Apache-2.0, MIT, EUPL-1.2, and AGPLv3.

## Decision

The package is licensed under [EUPL-1.2](https://eupl.eu/), the European Union Public Licence version 1.2.

## Rationale

EUPL-1.2 is the only license on the candidate list that meets all four of the following requirements simultaneously:

1. **Free-software and open-source compliant.** EUPL-1.2 is OSI-approved and FSF-recognised, so contributors and downstream users get the same protections they would under Apache or MIT.
2. **Explicit patent grant analogous to Apache §3.** EUPL-1.2 article 2 grants both copyright and patent rights from contributors to recipients. This matters because the parent Agonist Development AB holds 9 USPTO patent provisional applications in adjacent technical areas; the EUPL-1.2 patent grant makes clear which inventions are licensed for use of this package and which are not (the patent-peace pledge at <https://ariada.org/legal/patent-peace> documents this further).
3. **EU institutional acceptance.** EUPL-1.2 is the European Commission's recommended OSS license for projects involving EU public sector funding. NGI Zero Commons grant applications consistently rate EUPL-1.2 projects as aligned with the funder's preferred licensing posture. Apache-2.0 and MIT are also acceptable to NLnet but carry a less direct fit with EU public-sector procurement guidelines (which sometimes mandate EUPL).
4. **Compatibility with widely-used permissive licenses.** EUPL-1.2 Article 5 includes a compatibility clause that permits relicensing the package's code under several other licenses (GPL, AGPL, LGPL, MPL, Apache, CeCILL) when combined with code under those licenses. This avoids the EUPL trap that earlier EUPL-1.1 deployments hit: downstream projects could not vendor-in EUPL code if their own project was GPL.

Alternatives considered and rejected:

- **Apache-2.0** — preferred by Anthropic, by many cloud-native projects, and would have been the simplest choice. Rejected because it carries no EU-procurement-specific advantage, and the parent organisation already has Apache-licensed code in adjacent repositories where the choice was made for compatibility reasons that do not apply here.
- **MIT** — too permissive: no patent grant means a future patent dispute with a contributor could disrupt the project. Rejected for that reason alone.
- **AGPLv3** — too restrictive for a *rule library* that is intended to be embedded in proprietary scanners and CI pipelines. AGPLv3's network-use copyleft would force every downstream SaaS user to publish their entire stack. Rejected as inappropriate for the package's role as middleware.

## Consequences

- The package's NOTICE file documents the re-license history: an internal precursor was Apache-2.0; the public release is EUPL-1.2. The change is permitted under Apache-2.0 §4(c) which allows redistribution under different terms.
- Downstream consumers who can accept EUPL-1.2 (the overwhelming majority of EU SaaS and public sector) get the package under EUPL-1.2 for free.
- Downstream consumers whose procurement cannot accept EUPL-1.2 (a small number of US enterprises with strict permissive-only policies) can request a commercial license covering the same code; the commercial dual-license is documented in README.md.
- Contributors sign DCO on every commit; no CLA is required. This matches NGI Zero Commons recommended practice.
- Forks that wish to incorporate EUPL-1.2 code into a GPL or MPL project may do so under EUPL-1.2 Article 5 compatibility.

## References

- EUPL-1.2 full text: <https://eupl.eu/1.2/en/>
- Joinup compatibility matrix: <https://joinup.ec.europa.eu/collection/eupl/matrix-eupl-compatible-open-source-licences>
- HUMAN_AUTHORSHIP_POLICY.md (repo level, 2026-05-13): <../../../legal/HUMAN_AUTHORSHIP_POLICY.md>
- README.md, "License" section.
- NOTICE file, re-license history.
