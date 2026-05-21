<!-- SPDX-FileCopyrightText: 2025-2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Security policy

If you believe you have found a vulnerability in `@ariada-org/vpat-html-renderer`
— for example a XSS (Cross-Site Scripting) bypass through `meta.productName`
or `criteria[].remarks`, a SVG (Scalable Vector Graphics) sanitiser bypass in
`BrandOptions.logoSvg`, a denial-of-service through pathological input, or a
non-determinism that breaks reproducible-build verification — please report it
privately so we can fix it before it is publicised.

## Reporting a vulnerability

**Preferred channel — GitHub Security Advisories.** Open a draft advisory at:

`https://github.com/ariada-org/ariada/security/advisories/new`

**Fallback channel — email.** `security@ariada.org` (use OpenPGP if available).

## Disclosure timeline

We aim to acknowledge within 5 business days, ship a fix within 30 days for
critical/serious issues, and publish a CVE (Common Vulnerabilities and
Exposures) identifier on public release.

## Out of scope

- Issues in the input `VpatReport` JSON itself (those belong to the upstream
  emitter package).
- Browser-rendering bugs in third-party browsers that do not respect WCAG 2.2
  AA contrast or focus-indication rules.
