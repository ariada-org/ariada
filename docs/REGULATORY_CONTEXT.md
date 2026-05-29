# Regulatory Context Reference — v0.1

> Canonical regulatory reference for the ariada repo. Cite this doc (not
> paraphrases from model training) when writing grant text, marketing copy,
> README, blog posts, docs, or PRDs that touch accessibility regulation, NLnet
> grant criteria, or licence compatibility.
>
> **Author:** Alexander Brichkin (Agonist Development AB)
> **Date:** 2026-05-17
> **Status:** v0.1 reference stub — verbatim primary-source links carry the
> authoritative numbers; this doc summarises and points back.
> **VERIFY caveat:** every numeric (fine ranges, transposition dates,
> evaluator rubric weights) MUST be re-checked against the primary source
> before public-facing use. Numbers below are best-effort, not lawyer-cleared.

## Table of contents

- [§1 EU Accessibility Act (Directive 2019/882/EU)](#1-eu-accessibility-act)
- [§2 EN 301 549 v3.2.1](#2-en-301-549-v321)
- [§3 WCAG 2.2 AA](#3-wcag-22-aa)
- [§4 National transpositions (SE / DE / FR / DK / FI / NO)](#4-national-transpositions)
- [§5 Per-regulator (DIGG / BFSG / ARCOM-DGCCRF / Digst / uutilsynet)](#5-per-regulator)
- [§6 NLnet NGI0 Commons](#6-nlnet-ngi0-commons)
- [§7 EUPL-1.2 vs MIT vs CC0-1.0 — compatibility matrix](#7-licence-compatibility-matrix)
- [§8 Related EU regulations (GDPR / NIS2 / DORA / CSRD)](#8-related-eu-regulations)
- [§9 Cite-don't-paraphrase rule](#9-cite-dont-paraphrase-rule)

---

## §1 EU Accessibility Act

**Primary instrument:** Directive (EU) 2019/882 of the European Parliament
and of the Council of 17 April 2019 on the accessibility requirements for
products and services. Short form: **EAA (European Accessibility Act)**.

**Purpose (Art. 1):** approximate the laws, regulations and administrative
provisions of the Member States on the accessibility requirements for
certain products and services, in particular by eliminating and preventing
barriers to the free movement of accessible products and services.

**Compliance date for service providers (Art. 31(2)):** 28 June 2025. After
that date, in-scope services placed on the EU market must comply with the
accessibility requirements in Annex I.

**Service scope summary (Art. 2(2)):**

| Sector tag | Service category                                                                |
| ---------- | ------------------------------------------------------------------------------- |
| ES-1       | Electronic communications services (excluding M2M)                              |
| ES-2       | Services providing access to audiovisual media services                          |
| ES-3       | Air, bus, rail, waterborne passenger transport (websites, mobile apps, e-tickets) |
| ES-4       | Consumer banking services                                                        |
| ES-5       | E-books and dedicated software                                                   |
| ES-6       | E-commerce services                                                              |
| ES-7       | Emergency communications to the single European emergency number 112             |

ariada's scanner / SaaS sits primarily in scope for **ES-6 (e-commerce)** and
indirectly for **ES-4 (banking)** when targeting financial-services
customers. ES-5 covers downloadable / cloud reader software.

**Extraterritorial reach (Art. 6 — free movement):** any service provided
to consumers in the EU is in scope regardless of the provider's place of
establishment. A US-incorporated SaaS serving EU consumers must comply.

**Microenterprise carve-out (Art. 4(5)):** services provided by
microenterprises (<10 employees AND annual turnover or balance sheet ≤ €2M)
are exempt from compliance with the accessibility requirements but MUST
notify their Member State authority on request.

**Annex I — accessibility requirements (per-sector):**

- §I.1 General accessibility requirements (perceivable / operable /
  understandable / robust — borrows from WCAG POUR principles)
- §I.2 Information about functioning of products
- §I.3 User-interface and functionality
- §I.4 Support services
- §I.5 Built environment (where related to in-scope service)
- §I.6 E-commerce service-specific requirements (search / cart /
  checkout / billing presented accessibly)
- §I.7 Specific requirements for emergency communications

**Conformity presumption (Art. 15):** services in conformity with
harmonised standards (the published EN 301 549 reference in OJEU) are
presumed to be in conformity with EAA accessibility requirements.

**Accessibility statement (Art. 13 + Annex V):** service providers MUST
publish an accessibility statement that covers (a) general description of
the service, (b) accessibility features, (c) non-accessible content with
justification + alternatives, (d) feedback mechanism, (e) enforcement
procedure.

**Penalties (Art. 30 — set by each Member State):** Member States lay down
the rules on penalties, which must be effective, proportionate and
dissuasive. Numeric ranges vary per national transposition — see §4 and §5.

**Primary-source link:**
[EUR-Lex — Directive (EU) 2019/882](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32019L0882)

---

## §2 EN 301 549 v3.2.1

**Title:** "Accessibility requirements for ICT products and services"
**Publishing body:** ETSI / CEN / CENELEC (joint European Standards body)
**Current version (as of 2026-05):** v3.2.1 (published 2021-03), with v4
in draft and expected to incorporate WCAG 2.2 (and ATAG 2.0 elements)
formally — re-verify before citing v4.

**Clause structure (high-level):**

| Clause | Topic                                            |
| ------ | ------------------------------------------------ |
| 4      | Functional performance statements                |
| 5      | Generic requirements                              |
| 6      | ICT with two-way voice communication             |
| 7      | ICT with video capabilities                       |
| 8      | Hardware                                          |
| 9      | Web (maps to WCAG 2.1 AA — clause 9 == WCAG SC)  |
| 10     | Non-web documents                                 |
| 11     | Software (including mobile apps)                  |
| 12     | Documentation and support services                |
| 13     | ICT providing relay or emergency service access  |

**Clause 9 ↔ WCAG mapping:** every WCAG 2.1 Level A and Level AA success
criterion is reproduced verbatim under EN 301 549 clause 9 (numbered
9.1.1.1 = WCAG SC 1.1.1, 9.1.4.3 = WCAG SC 1.4.3, etc.). When citing for
EAA conformity, prefer the EN clause number (9.X.Y.Z) — that's the
harmonised-standard reference Member State authorities recognise.

**WCAG 2.2 incorporation:** v3.2.1 is anchored on WCAG 2.1 AA. Member State
transpositions of EAA already reference WCAG 2.2 in some cases (e.g.
France RGAA 4.1.2 — see §4). v4 is expected to formally adopt WCAG 2.2;
until then, the safest claim is "EN 301 549 v3.2.1 + WCAG 2.2 SC
delta-additions".

**Primary-source link:**
[ETSI EN 301 549 v3.2.1 (PDF)](https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf)

---

## §3 WCAG 2.2 AA

**Publishing body:** W3C Web Accessibility Initiative (WAI)
**Published:** 2023-10-05 (W3C Recommendation)
**Levels:** A (lowest), AA (legal-baseline), AAA (highest)

WCAG 2.2 AA = the 50 success criteria across Levels A + AA. ariada's
scanner targets WCAG 2.2 AA as default conformance; AAA criteria are
opt-in.

**Four principles (POUR):**

1. **Perceivable** — information and user-interface components must be
   presentable to users in ways they can perceive.
2. **Operable** — user-interface components and navigation must be operable.
3. **Understandable** — information and operation of the user interface
   must be understandable.
4. **Robust** — content must be robust enough to be interpreted by a wide
   variety of user agents, including assistive technologies.

**Key 2.2 additions vs 2.1:** nine new success criteria, of which six are
Level A or AA. The most relevant for scanner work:

- **SC 2.4.11 Focus Not Obscured (Minimum) — AA**
- **SC 2.4.12 Focus Not Obscured (Enhanced) — AAA**
- **SC 2.4.13 Focus Appearance — AAA**
- **SC 2.5.7 Dragging Movements — AA**
- **SC 2.5.8 Target Size (Minimum) — AA** (≥24×24 CSS pixels with stated exceptions)
- **SC 3.2.6 Consistent Help — A**
- **SC 3.3.7 Redundant Entry — A**
- **SC 3.3.8 Accessible Authentication (Minimum) — AA**
- **SC 3.3.9 Accessible Authentication (Enhanced) — AAA**

**Removed in 2.2:** SC 4.1.1 Parsing (was Level A) — obsoleted, since
modern parsers handle invalid markup robustly.

**Citation form:** "WCAG 2.2 SC 2.5.8" (specific criterion) or "WCAG 2.2
Level AA" (conformance level). Avoid the bare "WCAG-compliant" claim —
ambiguous and historically misused.

**Primary-source link:**
[W3C WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/)

---

## §4 National transpositions

Member States had to transpose EAA into national law by **28 June 2022**
(Art. 31(1)) and apply it to in-scope services from **28 June 2025**
(Art. 31(2)). Brief per-country reference below. VERIFY caveat applies
to every numeric.

### SE — DOS-lagen / EAA transposition

- **DOS-lagen** = Lag (2018:1937) om tillgänglighet till digitala offentliga
  tjänster (Sweden's transposition of the earlier Web Accessibility
  Directive 2016/2102, public-sector). Predates EAA.
- **EAA transposition:** Lag (2023:254) om vissa produkters och tjänsters
  tillgänglighet (sometimes shortened to "tillgänglighetslagen"). Covers
  the EAA private-sector service scope. Effective for new services from
  2025-06-28.
- **Supervisory authority:** Myndigheten för digital förvaltning (**DIGG**)
  for digital services; sector-specific authorities for transport, banking,
  telecom under their existing remits.

### DE — BFSG (Barrierefreiheitsstärkungsgesetz)

- **Statute:** Barrierefreiheitsstärkungsgesetz (BFSG), 2021-07-16,
  effective 2025-06-28. Transposes EAA into German law.
- **Scope:** identical to EAA Annex I service categories. Microenterprise
  exemption preserved.
- **Implementing regulation:** Barrierefreiheitsstärkungsgesetz-Verordnung
  (BFSGV) — operational rules for accessibility statements, market
  surveillance, conformity assessment.
- **Existing public-sector framework:** Behindertengleichstellungsgesetz
  (BGG) + Barrierefreie-Informationstechnik-Verordnung (BITV 2.0) — these
  remain the public-sector accessibility regime; BFSG adds the private-
  sector EAA layer.

### FR — Loi 2023-171 / RGAA 4.1.2

- **Transposition:** Loi n° 2023-171 du 9 mars 2023 portant diverses
  dispositions d'adaptation au droit de l'Union européenne. The
  accessibility provisions transpose EAA into French law via amendments to
  Code de la consommation and Code des postes et des communications
  électroniques.
- **Technical reference standard:** RGAA 4.1.2 (Référentiel général
  d'amélioration de l'accessibilité), maintained by DINUM. RGAA 4.1.2
  embeds WCAG 2.1 AA criteria with French-specific testing methodology;
  EAA-scope updates rolling in.
- **Supervisory authorities:** ARCOM (audiovisual / e-commerce) + DGCCRF
  (consumer-protection sector).

### DK — Lov om tilgængelighed

- **Statute:** Lov om tilgængelighedskrav til produkter og tjenester
  (2022-12-13), effective 2025-06-28. Direct EAA transposition.
- **Supervisory authority:** Digitaliseringsstyrelsen (**Digst**) for
  digital services; sector authorities for transport / banking.

### FI — Saavutettavuuslaki + EAA amendments

- **Existing law:** Laki digitaalisten palvelujen tarjoamisesta (306/2019),
  combined with Saavutettavuusdirektiivin täytäntöönpano — Finland's WAD
  transposition.
- **EAA additions:** Laki tuotteiden ja palvelujen esteettömyydestä
  (102/2023) extending coverage to EAA private-sector services from
  2025-06-28.
- **Supervisory authority:** Etelä-Suomen aluehallintovirasto (AVI Southern
  Finland) — Saavutettavuusvalvonta.

### NO — Tilgjengelighetsforskriften (EEA channel)

- Norway implements EAA via the EEA Agreement. Transposition lands as
  amendments to Forskrift om universell utforming av
  informasjons- og kommunikasjonsteknologiske (IKT-) løsninger
  (Tilgjengelighetsforskriften).
- **Supervisory authority:** Direktoratet for forvaltning og økonomistyring
  (Digdir) and within it, **uutilsynet** (Tilsynet for universell utforming
  av ikt).

---

## §5 Per-regulator

Short references to the supervisory authorities ariada will most often
interact with. **Fine ranges below are VERIFY-caveat — re-check primary
source before public claim.**

### DIGG (Sweden) — Myndigheten för digital förvaltning

- **Scope:** public-sector digital service supervision under DOS-lagen;
  EAA private-sector supervision shared with sector authorities (FI / PTS).
- **Enforcement style:** annual surveillance-monitoring sample of public
  sector + complaint-driven for private. Statement-of-accessibility
  required (must be linked from every in-scope service).
- **Sanction range:** statutory injunction + administrative penalties —
  range varies; the practical lever is the obligation to publish a
  compliant statement and to remediate within a defined deadline.

### BFSG (Germany) — Marktüberwachungsbehörden der Länder

- **Scope:** market-surveillance authorities of the 16 German Länder
  enforce BFSG against in-scope private-sector services.
- **Enforcement style:** complaint-driven plus risk-based market
  surveillance; Bundesamt für Justiz handles cross-Länder coordination.
- **Sanction range:** BFSG §37 — administrative offences carry fines up to
  €100,000 (VERIFY — published ceilings have shifted in implementing
  regulation drafts; re-confirm against published Gesetzblatt before
  citation in customer-facing materials).

### ARCOM (France) + DGCCRF — joint supervisory split

- **Scope:** ARCOM (formerly CSA) handles audiovisual + electronic
  communications; DGCCRF covers consumer-protection sectors (e-commerce,
  banking interfaces, transport ticketing). Both can act under the EAA
  transposition.
- **Enforcement style:** declarations of accessibility published per
  RGAA 4.1.2 template; complaint mechanism via service-provider feedback
  channel mandatory.
- **Sanction range:** fines up to €25,000 per non-conforming service
  (recurring on repeat findings) per Loi 2023-171 + Code de la consommation
  amendments (VERIFY).

### Digst (Denmark) — Digitaliseringsstyrelsen

- **Scope:** EAA private-sector services + public-sector accessibility
  under existing transposition.
- **Enforcement style:** declaration-and-complaint model with
  Digitaliseringsstyrelsen as central body; sector authorities for
  transport / banking.
- **Sanction range:** administrative penalties under Lov om tilgængelighed
  (VERIFY).

### uutilsynet (Norway) — within Digdir

- **Scope:** universal-design supervision for IKT solutions in Norway;
  EEA-channel EAA transposition.
- **Enforcement style:** annual monitoring + complaint-driven; published
  test methodology aligned to WCAG 2.1 AA with ongoing 2.2 + EAA delta
  updates.
- **Sanction range:** coercive fines (tvangsmulkt) under
  Likestillings- og diskrimineringsloven for non-compliance with
  remediation orders.

---

## §6 NLnet NGI0 Commons

**Funder:** Stichting NLnet (the Dutch Internet Society's grant-making
foundation), executing the European Commission's Next Generation Internet
(NGI) initiative.

**Relevant fund:** NGI0 Commons Fund — supports free / libre / open-
source projects strengthening the public-interest Internet, with strong
emphasis on accessibility, privacy, decentralisation, security, and trust.

**Application format:** open-call short-form (target ~3000 words / ~10
sections), submitted via NLnet web portal. Founder + project description +
licensing + funding plan + use of funds + risks + community impact.

**Cycle calendar (illustrative — VERIFY exact dates per cycle):** NLnet
runs continuous open calls with deadlines roughly every 2 months (Feb
1 / Apr 1 / Jun 1 / Aug 1 / Oct 1 / Dec 1). ariada Wave-1 target:
2026-06-01 cycle (with v0.7 application draft as the working artefact).

**Funding tiers:** typically €5k–€50k for a defined project phase
(individual application); larger phased programmes possible.

**Evaluator rubric (high-level — distilled in our internal
NLNET_APPLICATION_DRAFT_v0.7.md + mock-evaluator review):**

- Strategic relevance to NGI principles (open / commons / European public
  interest)
- Free-software licensing + governance model
- Technical merit and feasibility of the proposed phase
- Open-source maturity (existing artefacts, community presence)
- Bang-for-buck (value delivered relative to funding requested)
- Founder credibility and execution track record
- Accessibility / inclusion impact (especially for the Accessibility-themed
  open calls)

**Evaluator psychology — observed patterns:**

- Evaluators read fast. Front-load specifics; cite primary sources by
  Article/Annex number; avoid marketing voice.
- Evaluators dislike vague "we will explore" language. Replace with
  "we will deliver X by month N, measured by Y".
- Evaluators flag licence ambiguity instantly. Specify the exact licence
  (EUPL-1.2 / MIT / CC0-1.0) per component and ensure compatibility.
- Evaluators distrust commercial-only authors. Demonstrate community
  benefit beyond the founder's own product.

**Multi-application rules:**

- Founders may submit multiple applications across cycles, but cannot have
  more than one active grant at a time within a single fund stream
  (re-verify per current call rules).
- Multiple applications across DIFFERENT NLnet streams (NGI0 Core, NGI0
  Commons, NGI0 Entrust) are permitted concurrently if scope does not
  overlap.

**Mock-evaluator findings:** pre-submission review notes maintained by the project team.

**Primary-source link:**
[NLnet — Apply for funding](https://nlnet.nl/propose/)

---

## §7 Licence compatibility matrix

ariada's repo uses a mixed-licence stack to satisfy (a) NLnet preference
for FLOSS, (b) EUPL-1.2 enforceability under EU law, (c) MIT permissiveness
for downstream adopter convenience, (d) CC0-1.0 for non-software artefacts
(docs, datasets, test fixtures).

### Quick matrix

| Producer (component) → Consumer | EUPL-1.2     | MIT           | CC0-1.0  | AGPL-3.0      | Apache-2.0     |
| ------------------------------- | ------------ | ------------- | -------- | ------------- | -------------- |
| EUPL-1.2 → ...                  | OK           | downstream-only via Appendix compatibility list | OK | OK     | OK             |
| MIT → ...                       | OK (relicensing allowed if combined) | OK | OK | OK | OK           |
| CC0-1.0 → ...                   | OK           | OK            | OK       | OK            | OK             |
| AGPL-3.0 → ...                  | upstream-incompatible (one-way only) | upstream-incompatible | OK upstream | OK | OK upstream |
| Apache-2.0 → ...                | OK (patent grant aligns) | OK | OK | OK     | OK             |

### When each applies in ariada

- **EUPL-1.2** — server-side / SaaS components where strong copyleft +
  EU-jurisdiction enforceability is desired. Default for ariada's
  evidence-emitter and scan-backend.
- **MIT** — client-side libraries and SDKs where adopter convenience
  outweighs copyleft. Default for ariada-brand-tokens, embed-badge.
- **CC0-1.0** — non-software artefacts: docs, datasets, test fixtures,
  rule-extension YAML where attribution would be a friction.
- **AGPL-3.0** — explicitly NOT used in ariada repo (would break adopter
  embedding into closed services).
- **Apache-2.0** — used in core / core-engine / core-playwright (patent
  grant clause + permissive blend).

### Compatibility footnotes

- **EUPL-1.2 Appendix:** lists explicit compatible-licence relicensing
  targets including AGPL-3.0, EPL-1.0, OSL-2.1+, CECILL-2.0, GPL-2.0+,
  and MPL-2.0. The compatibility runs ONE WAY (EUPL-licensed code may be
  re-distributed under one of these licences when combined with code
  already under that licence).
- **AGPL-3.0 caveat:** if ANY transitive dependency is AGPL, downstream
  network-service deployment may trigger source-distribution obligations.
  ariada's policy: zero AGPL in production artefact dependency graph.

**Primary-source links:**

- [EUPL-1.2 text (EUR-Lex)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32017D0863)
- [MIT (OSI)](https://opensource.org/license/mit/)
- [CC0-1.0 (Creative Commons)](https://creativecommons.org/publicdomain/zero/1.0/)

---

## §8 Related EU regulations

Adjacent regulations that touch ariada's platform surface. Cite the
specific Article when discussing in grant or docs text.

### GDPR — Regulation (EU) 2016/679

- **Art. 6 lawful basis** — relevant when scan results contain personal
  data (e.g. screenshots that incidentally capture user-generated content,
  AX tree dumps that include user-entered form data). ariada's policy:
  no PII in scan reports; anonymise screenshots; strip form values.
- **Art. 13/14 information** — controllers must disclose processing
  purposes and retention; applies if ariada offers customer-facing
  scanning that processes operator-side data.
- **Art. 28 processor agreement** — ariada-as-processor model when
  offering scan-as-a-service; the DPA template is maintained separately
  and is available to counterparties on request.
- **Art. 32 security of processing** — required engineering controls
  (encryption in transit + at rest, access control, audit).

### NIS2 — Directive (EU) 2022/2555

- **Scope:** essential and important entities in 18 sectors. ariada itself
  is below the size threshold; however, customers in scope may demand
  evidence retention + audit-trail capability from suppliers.
- **Audit-trail retention:** Art. 21 requires risk-management measures
  including logging and monitoring. ariada-evidence-emitter targets
  WORM-grade retention for scan evidence to support customer NIS2
  obligations.

### DORA — Regulation (EU) 2022/2554

- **Scope:** financial entities + their ICT third-party providers.
  Applies to ariada when serving in-scope financial-sector customers
  (consumer-banking accessibility — overlaps with EAA Annex I ES-4).
- **Third-party register:** financial entities must maintain a register
  of ICT third-party arrangements (Art. 28). ariada should be enumerable
  in customer registers and provide standardised supplier-info packs.

### CSRD — Directive (EU) 2022/2464

- **Scope:** sustainability reporting; ESRS S1 (own workforce — including
  accessibility) and S4 (consumers — including accessibility of products
  / services) may reference EAA conformity in disclosure.
- **Relevance:** customers in CSRD scope will increasingly request
  accessibility evidence packs to substantiate their S1 / S4 disclosures.

---

## §9 Cite-don't-paraphrase rule

When writing for ANY public surface (grant text, marketing copy, README,
docs, blog posts, PRDs that may be open-sourced), follow this discipline:

1. **Cite specific Article / Annex / Clause / SC numbers** — not vague
   paraphrases. "Directive 2019/882/EU Annex I §I.6" is better than "the
   accessibility directive's e-commerce annex".
2. **Identify the publishing body** — "ETSI EN 301 549 v3.2.1" not "the
   European accessibility standard".
3. **Pin the version** — "WCAG 2.2 SC 2.5.8" not "WCAG SC 2.5.8".
4. **Use the canonical short form on second mention** — first mention:
   "European Accessibility Act (EAA), Directive 2019/882/EU"; subsequent:
   "EAA" alone.
5. **Avoid the bare term "compliant"** — say "conforms to EN 301 549
   v3.2.1 clause 9" or "passes WCAG 2.2 AA via axe-core ruleset X".
6. **Flag VERIFY-needed numbers explicitly** when re-using fine ranges,
   evaluator rubric weights, transposition dates, or threshold sizes
   without re-checking. Use `(VERIFY)` inline.
7. **Run `validate_compliance_claim` via this MCP server** on any draft
   that includes regulatory citations before committing.
8. **Lawyer review** is required for ToS / DPA / privacy / accessibility-
   statement copy that customers will rely on — this doc is NOT legal
   advice; it's a citation reference for engineering and grant work.

---

## Update history

- **2026-05-17 (v0.1)** — initial reference stub.
  Covers EAA Directive, EN 301 549 v3.2.1, WCAG 2.2 AA, SE/DE/FR/DK/FI/NO
  transpositions, DIGG/BFSG/ARCOM/Digst/uutilsynet supervisory authorities,
  NLnet NGI0 Commons rubric + cycle, EUPL/MIT/CC0/AGPL/Apache-2.0
  compatibility matrix, GDPR/NIS2/DORA/CSRD adjacencies, cite-don't-
  paraphrase rule. All numeric figures marked VERIFY where primary-source
  re-check is required.
