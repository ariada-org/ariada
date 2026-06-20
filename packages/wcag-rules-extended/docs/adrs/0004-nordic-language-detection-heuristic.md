<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# ADR 0004 — Nordic language detection via distinctive-word heuristic

| Field   | Value                                                          |
|---------|----------------------------------------------------------------|
| Status  | Accepted                                                       |
| Date    | 2026-05-14                                                     |
| Authors | Agonist Development AB (Sweden)                                |

## Context

The `ariada/banking/lang-matches-locale` rule needs to detect, for an arbitrary HTML page, which Nordic language (Swedish, Norwegian, Danish, or Finnish) the body content is written in, so it can compare that against the declared `<html lang>` attribute. The detection must run in a Node.js / happy-dom environment without external network calls or large model dependencies.

The candidates considered were: (a) a trained statistical language-identification model (e.g., fastText 176-language), (b) the Compact Language Detector v3 (CLD3) Node binding, (c) a distinctive-word frequency heuristic, and (d) external API call to a language-identification service.

## Decision

Use a **distinctive-word frequency heuristic**: maintain a list of ten high-frequency function words per Nordic language; count occurrences in the document body text; classify the page as the language with the highest count, provided that count meets or exceeds a threshold of five.

## Rationale

Four reasons:

1. **No model dependency.** The heuristic is implemented in ~20 lines of pure TypeScript with no external assets. The package's npm install size stays under 100 kB, which matters for CI cold-start time and for downstream consumers who care about install footprint. fastText models are typically 100-200 MB.
2. **No external network calls.** Per the project's security policy, rules must not call external APIs. An API-based language detector is excluded by policy.
3. **Sufficient precision for the rule's intent.** The rule's purpose is to detect *mismatches* between declared `lang` and actual content language, not to identify language at high granularity. A pre-release test corpus of 1,200 manually-labelled pages (300 per Nordic language) showed 98.4 percent classification accuracy with the heuristic, with the remaining 1.6 percent being multi-language pages where no single language dominated — which the rule correctly defers to the upstream `html-has-lang` rule via the under-threshold pass.
4. **Auditable.** Every contributor reviewing the rule can read the word list and the count threshold and understand exactly what the rule will fire on. A trained statistical model would be opaque: a false-positive complaint would require re-training or evidence-based parameter tuning rather than a focused word-list edit.

Alternatives considered and rejected:

- **fastText / lid.176.bin model** — most accurate, but adds a 100+ MB model file and a native binding dependency. Rejected for install-size and audit-opacity reasons.
- **CLD3 Node binding** — smaller than fastText, but still adds a native binding (compilation issues on some platforms) and the model is closed-source. Rejected for cross-platform reliability and audit-opacity.
- **External API call to a language-identification service** — excluded by security policy (no external API calls from rules) and would not work in air-gapped CI environments.
- **n-gram trigram classifier built in TypeScript** — more accurate than word-list heuristic for short texts, but harder to audit and tune. Considered as a possible v0.3.x replacement if the word-list heuristic shows false-positive issues in production.

The word lists were assembled by cross-referencing the Norsk ordbok and Svenska Akademiens ordlista frequency tables, the Danish Korpus 90, and the Finnish KOTUS corpus. Words with high cross-language collision rate (e.g., `var`, which appears in Swedish, Norwegian, and Danish with different meanings) were excluded. The final ten words per language were selected to maximise discriminative power against the other three Nordic languages while remaining high-frequency enough that they appear in a meaningful fraction of pages.

## Consequences

- The rule's word lists are visible in `src/rules/banking/lang-matches-locale.ts` and are documented in the rule's markdown file (Nordic locale notes section). Any contributor or user can review them.
- Threshold of five distinctive words is conservative: very short pages (under approximately 50 words of body text) will not trip the rule. This is documented as an edge case in the rule's markdown.
- Norwegian Nynorsk (`nn`) typically does not score above threshold because its function words diverge significantly from Bokmål. Nynorsk pages currently pass the rule by deferral, which is acceptable since the rule never claims to validate Nynorsk specifically; future work in v0.2.x will add an `nn` word list.
- The heuristic does not extend to German, French, Spanish, or other EU languages. The general axe-core `html-has-lang` rule covers those.
- Known limitation: nested `lang` attributes are not currently subtracted from the body-text count (e.g., a `<blockquote lang="sv">` in an English page contributes Swedish words to the page-level total). A fix using `dom-accessibility-api` to walk the descendant tree subtracting explicit-lang subtrees is on the v0.2.x roadmap, documented in the rule's markdown changelog.
- If the v0.2.x fix lands and removes false positives on multi-language pages, the threshold may be lowered from five to three. This will be a minor version bump.

## References

- Svenska Akademiens ordlista (frequency basis): <https://svenska.se/saol/>
- Norsk ordbok: <https://ordbokene.no/>
- Korpus 90 (Danish reference corpus): <https://korpus.dsl.dk/>
- KOTUS Finnish reference corpus: <https://www.kotus.fi/aineistot>
- Rule source: `src/rules/banking/lang-matches-locale.ts`
- Per-rule documentation: `docs/rules/banking-lang-matches-locale.md`
