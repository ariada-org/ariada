<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Maintainers

`ariada-org/ariada` is currently a single-maintainer project. As the
team grows, named maintainers + responsibility areas + response windows
will land here.

## Current maintainer (v0.1)

**Alexander Brichkin**
- Role: Founder, sole maintainer
- Affiliation: Agonist Development AB (Sweden, org.nr 559452-5726)
- GitHub: [@Aftermarked](https://github.com/Aftermarked)
- Email: `git@ariada.org` (commit author noreply) · `compliance@ariada.org`
  (accessibility + EAA / EN 301 549 questions) · `security@ariada.org`
  (security disclosures — see `SECURITY.md` for coordinated-disclosure
  process) · `trademark@ariada.org` (trademark queries — see
  `TRADEMARK.md`)
- Timezone: Europe/Stockholm (CEST UTC+2 summer, CET UTC+1 winter)
- Response window: 48 business hours for normal PRs / issues; **6 hours
  for security disclosures** per `SECURITY.md`
- Languages: English (primary) / Swedish / Russian

## Decision-making

Until a maintainer team forms, all merge decisions are made by the
sole maintainer. PRs are reviewed against the gates documented in
the repo testing strategy (`ROADMAP.md`, `CONTRIBUTING.md` for the
pre-push gate list).

The aggregated `ci-summary` GitHub Status Check is the merge gate —
must pass before merge to `main`.

## Maintainer responsibilities

- Triage incoming issues within 48 business hours (label / assign /
  close as duplicate)
- Review PRs within 48 business hours (initial response — full review
  may take longer for substantive changes)
- Security disclosures: 6-hour acknowledgement window per `SECURITY.md`
- Release management (semver + changesets + CHANGELOG)
- Pre-release content audit (forbidden-tokens scan, REUSE compliance,
  license consistency)
- REUSE 3.3 compliance on every PR (per `REUSE.toml` config files)

## Future co-maintainer onboarding

When the project adds co-maintainers:
- Co-maintainer onboarding via 3 successful PR reviews + 1 security
  triage as a non-merging reviewer
- Promotion to merge rights by sole maintainer
- Per-package CODEOWNERS expansion (`.github/CODEOWNERS`)
- Quarterly maintainer sync rotated across timezones

## Contact priority

1. **Security:** `security@ariada.org` (PGP key planned for v0.2 — see
   `SECURITY.md`)
2. **Compliance / EAA / EN 301 549:** `compliance@ariada.org`
3. **Trademark / brand:** `trademark@ariada.org`
4. **Everything else:** GitHub issues at
   [`ariada-org/ariada/issues`](https://github.com/ariada-org/ariada/issues)

---

Maintained by Alexander Brichkin (Agonist Development AB, Sweden,
org.nr 559452-5726). Last updated 2026-05-20.
