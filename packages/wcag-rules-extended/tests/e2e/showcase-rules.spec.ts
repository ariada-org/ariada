// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Cross-engine E2E suite — 5 showcase rules × 3 fixture-scenarios.
 *
 * For each showcase rule we exercise three scenarios:
 *   1. A KNOWN-FAIL fixture (or page mutation) authored to trigger the rule
 *      → expect violation.
 *   2. A KNOWN-PASS fixture in the same pack → expect no violation.
 *   3. A CROSS-PACK PASS fixture (different pack entirely, used as a
 *      sanity check) → expect no violation.
 *
 * Across 3 browser projects (chromium / firefox / webkit) this gives:
 *   5 rules × 3 scenarios × 3 browsers = 45 test runs.
 *
 * Why "showcase"? Per-rule logic is exhaustively covered by 310 vitest
 * unit tests in happy-dom. This suite's job is *cross-engine integration
 * confidence* — proving the rule pack fires the same way under real
 * Chromium, real Firefox, and real WebKit on the M7 EU real-world
 * fixtures.
 *
 * Rule selection — 4 from Pack A (Checkout), Pack B (Statement), Pack C
 * (Banking). For Pack C `lang-matches-locale` we use a DOM mutation in
 * the test to construct the FAIL state, because the existing
 * mobilepay-style-bad-merchant-da.html fixture is too sparse for the
 * rule's Nordic-script + function-word heuristic to fire.
 *
 * Author: Alexander Brichkin (Agonist Development AB), 2026-05-17.
 */

import type { Page } from '@playwright/test';

import { analyzeWithEaa, ruleViolated } from './fixtures/axe-eaa.js';
import { test, expect } from './fixtures/server.js';

/** Optional DOM mutation applied after `goto`, before axe runs. */
type Mutator = (page: Page) => Promise<void>;

interface Scenario {
  /** Fixture filename relative to fixtures/eu-real-world. */
  fixture: string;
  /** True if the rule SHOULD fire on this fixture. */
  expectViolation: boolean;
  /** Free-form human description for the test title. */
  description: string;
  /** Optional DOM mutation to apply before running axe. */
  mutate?: Mutator;
}

interface RuleCase {
  ruleId: string;
  scenarios: Scenario[];
}

// Each rule gets exactly 3 scenarios → 15 tests per browser → 45 total.
const RULE_CASES: RuleCase[] = [
  // ─── Pack A: Checkout ──────────────────────────────────────────────
  {
    ruleId: 'ariada/checkout/payment-fieldset-grouping',
    scenarios: [
      {
        fixture: 'klarna-style-bad-checkout-sv.html',
        expectViolation: true,
        description:
          'fires on payment radios without <fieldset><legend> (SV bad checkout)',
      },
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: false,
        description: 'passes on grouped payment radios with <legend>Betalningssätt</legend>',
      },
      {
        fixture: 'accessibility-statement-fi.html',
        expectViolation: false,
        description:
          'does not fire on cross-pack statement page (no payment radios at all)',
      },
    ],
  },
  {
    ruleId: 'ariada/checkout/autocomplete-personal-data',
    scenarios: [
      {
        fixture: 'klarna-style-bad-checkout-sv.html',
        expectViolation: true,
        description:
          'fires on personal-data inputs missing autocomplete (förnamn / efternamn / etc.)',
      },
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: false,
        description: 'passes when all personal-data fields declare autocomplete="..."',
      },
      {
        fixture: 'bankid-style-success-sv.html',
        expectViolation: false,
        description:
          'does not fire on cross-pack BankID success page (no personal-data inputs)',
      },
    ],
  },
  {
    ruleId: 'ariada/checkout/required-field-machine-readable',
    scenarios: [
      {
        fixture: 'mittelstand-bad-checkout-de.html',
        expectViolation: true,
        description:
          'fires when required Mittelstand checkout fields lack required / aria-required',
      },
      {
        fixture: 'mittelstand-checkout-de.html',
        expectViolation: false,
        description:
          'passes when Mittelstand checkout fields declare required attribute',
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description: 'does not fire on cross-pack RGAA statement (no checkout fields)',
      },
    ],
  },
  // ─── Pack B: Statement ─────────────────────────────────────────────
  {
    ruleId: 'ariada/statement/enforcement-procedure-link',
    scenarios: [
      {
        fixture: 'accessibility-statement-fi-incomplete.html',
        expectViolation: true,
        description: 'fires on FI statement missing Avi enforcement-procedure link',
      },
      {
        fixture: 'accessibility-statement-fi.html',
        expectViolation: false,
        description: 'passes on complete FI statement with enforcement section',
      },
      {
        fixture: 'klarna-style-cart-sv.html',
        expectViolation: false,
        description: 'does not fire on cross-pack non-statement page (Swedish cart)',
      },
    ],
  },
  // ─── Pack C: Banking ───────────────────────────────────────────────
  {
    ruleId: 'ariada/banking/lang-matches-locale',
    scenarios: [
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: true,
        description:
          'fires when page is forced to lang="en" but body carries distinctive SV text (DOM mutation)',
        mutate: async (page) => {
          // The bare 2FA fixture has too few SV function words to trip
          // the rule's heuristic. We force lang="en" AND inject enough
          // distinctive Swedish content (≥5 function words from the SV
          // list + an å/ö character) to satisfy both the Nordic-script
          // gate and the function-word threshold.
          await page.evaluate(() => {
            document.documentElement.setAttribute('lang', 'en');
            const p = document.createElement('p');
            p.textContent =
              'Detta är information om att du måste bekräfta att det är du som loggar in. ' +
              'Du kan välja mellan att skanna QR-koden eller att ange en kod manuellt med din ' +
              'mobila bankapp. Vi vill också påminna att din session löper ut snart, och denna ' +
              'sida innehåller känslig information för dig.';
            document.body.appendChild(p);
          });
        },
      },
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: false,
        description:
          'passes when same SV-bulked page keeps the matching lang="sv" (mutated)',
        mutate: async (page) => {
          // Mirror of the FAIL mutation, but leaving lang="sv" intact —
          // proves the rule's pass branch fires on the same content shape.
          await page.evaluate(() => {
            const p = document.createElement('p');
            p.textContent =
              'Detta är information om att du måste bekräfta att det är du som loggar in. ' +
              'Du kan välja mellan att skanna QR-koden eller att ange en kod manuellt med din ' +
              'mobila bankapp. Vi vill också påminna att din session löper ut snart, och denna ' +
              'sida innehåller känslig information för dig.';
            document.body.appendChild(p);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description:
          'does not fire on French RGAA statement (no Nordic-script content)',
      },
    ],
  },
];

for (const { ruleId, scenarios } of RULE_CASES) {
  test.describe(ruleId, () => {
    for (const sc of scenarios) {
      const tag = sc.expectViolation ? '[FAIL fixture]' : '[PASS fixture]';
      const title = `${tag} ${sc.description} — ${sc.fixture}`;
      test(title, async ({ page, fixtureServer }) => {
        await page.goto(fixtureServer.fixtureUrl(sc.fixture), {
          waitUntil: 'domcontentloaded',
        });

        if (sc.mutate) {
          await sc.mutate(page);
        }

        const results = await analyzeWithEaa(page, { ruleIds: [ruleId] });

        const violated = ruleViolated(results, ruleId);
        if (sc.expectViolation) {
          expect(
            violated,
            `expected rule ${ruleId} to violate on ${sc.fixture}, got violations=${JSON.stringify(
              results.violations.map((v) => v.id),
            )} incomplete=${JSON.stringify(results.incomplete.map((v) => v.id))}`,
          ).toBe(true);
        } else {
          expect(
            violated,
            `expected rule ${ruleId} NOT to violate on ${sc.fixture}, got nodes=${JSON.stringify(
              results.violations
                .filter((v) => v.id === ruleId)
                .map((v) => v.nodes.map((n) => n.html))
                .flat(),
            )}`,
          ).toBe(false);
        }
      });
    }
  });
}
