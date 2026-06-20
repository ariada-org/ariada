// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Cross-engine E2E suite — Pack C (Banking), 9 remaining rules × 3 scenarios.
 *
 * The 1 showcase Pack-C rule (`lang-matches-locale`) is covered in
 * `showcase-rules.spec.ts`. This file covers the other 9:
 *
 *   1. 2fa-keyboard-accessible
 *   2. bank-login-error-not-blocking
 *   3. currency-format-readable           ← test.fixme — broken selector (CSS L4 `i` flag)
 *   4. date-format-locale
 *   5. iban-input-format
 *   6. locale-fallback
 *   7. numeric-validation-error-locale
 *   8. session-timeout-warning            ← test.fixme — broken selector (CSS L4 `i` flag)
 *   9. transaction-amount-input
 *
 * Each rule × 3 scenarios × 3 browsers = 81 test runs.
 *
 * KNOWN LIMITATION — 2 rules above use the CSS Selectors Level-4 case-
 * insensitive flag in their `selector` strings (e.g. `[class*="amount" i]`)
 * which axe-core's internal parser does NOT accept — every match raises
 * `Error: Expected "]" but "i" found.` Those rules are marked
 * `test.fixme` until the rule pack lowercases its selectors.
 *
 * Strategy for the 7 testable rules: FAIL scenarios use deterministic DOM
 * mutation against a baseline fixture (precedent set by
 * `lang-matches-locale` in showcase-rules.spec.ts). PASS scenarios capture
 * a full-page screenshot under `test-results/screenshots/` as a visual
 * artifact for docs / reviewer.
 */

import type { Page } from '@playwright/test';

import { analyzeWithEaa, ruleViolated } from './fixtures/axe-eaa.js';
import { test, expect } from './fixtures/server.js';

type Mutator = (page: Page) => Promise<void>;

interface Scenario {
  fixture: string;
  expectViolation: boolean;
  description: string;
  mutate?: Mutator;
}

interface RuleCase {
  ruleId: string;
  fixme?: string;
  scenarios: Scenario[];
}

const RULE_CASES: RuleCase[] = [
  // ─── 1. 2fa-keyboard-accessible ──────────────────────────────────────
  {
    ruleId: 'ariada/banking/2fa-keyboard-accessible',
    scenarios: [
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: true,
        description:
          'fires when injected 6-digit OTP cell inputs carry inputmode="none" (blocks paste/SR)',
        mutate: async (page) => {
          // Rule matches input[maxlength="1"] (OTP-style cell inputs) and
          // FAILS if inputmode="none" OR tabindex="-1" OR readonly. Inject
          // 6 such inputs with inputmode="none".
          await page.evaluate(() => {
            const wrap = document.createElement('div');
            wrap.id = 'otp-bad';
            for (let i = 0; i < 6; i++) {
              const inp = document.createElement('input');
              inp.type = 'text';
              inp.maxLength = 1;
              inp.inputMode = 'none';
              inp.setAttribute('aria-label', `Siffra ${i + 1}`);
              wrap.appendChild(inp);
            }
            document.body.appendChild(wrap);
          });
        },
      },
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: false,
        description:
          'passes when injected OTP cell inputs use inputmode="numeric" (keyboard-friendly)',
        mutate: async (page) => {
          await page.evaluate(() => {
            const wrap = document.createElement('div');
            wrap.id = 'otp-good';
            for (let i = 0; i < 6; i++) {
              const inp = document.createElement('input');
              inp.type = 'text';
              inp.maxLength = 1;
              inp.inputMode = 'numeric';
              inp.setAttribute('aria-label', `Siffra ${i + 1}`);
              wrap.appendChild(inp);
            }
            document.body.appendChild(wrap);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no OTP-style inputs)',
      },
    ],
  },

  // ─── 2. bank-login-error-not-blocking ────────────────────────────────
  {
    ruleId: 'ariada/banking/login-error-not-blocking',
    scenarios: [
      {
        fixture: 'bankid-style-sso-redirect-sv.html',
        expectViolation: true,
        description:
          'fires when a login page shows a non-announceable .error-msg + disables the username input',
        mutate: async (page) => {
          // `isBankLoginContext` matches via title regex (e.g. "Bank") or
          // URL — bankid-sso-redirect fixture title satisfies. Then check
          // scans for error-classed elements without live/role=alert, AND
          // for disabled username/password inputs. Inject both anti-patterns.
          await page.evaluate(() => {
            const err = document.createElement('div');
            err.className = 'error-msg';
            err.textContent = 'Fel personnummer angivet.';
            document.body.appendChild(err);
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.name = 'username';
            inp.disabled = true;
            document.body.appendChild(inp);
          });
        },
      },
      {
        fixture: 'bankid-style-sso-redirect-sv.html',
        expectViolation: false,
        description:
          'passes on baseline SV BankID SSO page (no error elements, no disabled inputs)',
      },
      {
        fixture: 'klarna-style-cart-sv.html',
        expectViolation: false,
        description:
          'does not fire on cross-pack cart page (no bank-login context per title/URL)',
      },
    ],
  },

  // ─── 3. currency-format-readable ─────────────────────────────────────
  {
    ruleId: 'ariada/banking/currency-format-readable',
    scenarios: [
      {
        fixture: 'klarna-style-cart-sv.html',
        expectViolation: true,
        description:
          'fires when an injected amount span has Nordic "1 234,56 kr" text without <data>, <output>, or aria-label',
        mutate: async (page) => {
          await page.evaluate(() => {
            const bad = document.createElement('span');
            bad.className = 'amount';
            bad.textContent = '1 234,56 kr';
            document.body.appendChild(bad);
          });
        },
      },
      {
        fixture: 'klarna-style-cart-sv.html',
        expectViolation: false,
        description:
          'passes when the same amount text is wrapped in a <data value="1234.56"> element',
        mutate: async (page) => {
          await page.evaluate(() => {
            const ok = document.createElement('data');
            ok.className = 'amount';
            ok.setAttribute('value', '1234.56');
            ok.textContent = '1 234,56 kr';
            document.body.appendChild(ok);
          });
        },
      },
      {
        fixture: 'accessibility-statement-fi.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no price/amount classed nodes)',
      },
    ],
  },

  // ─── 4. date-format-locale ───────────────────────────────────────────
  {
    ruleId: 'ariada/banking/date-format-locale',
    scenarios: [
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: true,
        description:
          'fires when injected text date input lacks any DD/MM/YYYY format hint',
        mutate: async (page) => {
          // Rule matches input[type=text|tel] with name/id/placeholder
          // matching /\bdate|datum|dato|date-of-birth|fødselsdato|...
          // and FAILS if no DD/MM/YYYY-style hint in placeholder /
          // accessible name / aria-describedby.
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="dob-bad">Födelsedatum</label>' +
              '<input id="dob-bad" name="datum" type="text">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: false,
        description:
          'passes when injected date input carries placeholder format hint "ÅÅÅÅ-MM-DD"',
        mutate: async (page) => {
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="dob-ok">Födelsedatum</label>' +
              '<input id="dob-ok" name="datum" type="text" placeholder="ÅÅÅÅ-MM-DD">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no date-named inputs)',
      },
    ],
  },

  // ─── 5. iban-input-format ────────────────────────────────────────────
  {
    ruleId: 'ariada/banking/iban-input-format',
    scenarios: [
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: true,
        description:
          'fires when injected IBAN input has no segmented placeholder format',
        mutate: async (page) => {
          // Rule matches input whose name/id/accName contains "iban", and
          // FAILS if placeholder does not match a 4-char-grouped pattern.
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="iban-bad">IBAN</label>' +
              '<input id="iban-bad" name="iban" type="text">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: false,
        description:
          'passes when injected IBAN input carries 4-char-grouped placeholder',
        mutate: async (page) => {
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="iban-ok">IBAN</label>' +
              '<input id="iban-ok" name="iban" type="text" placeholder="SE45 0000 0000 0000 0000 0000">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'accessibility-statement-fi.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no IBAN inputs)',
      },
    ],
  },

  // ─── 6. locale-fallback ──────────────────────────────────────────────
  {
    ruleId: 'ariada/banking/locale-fallback',
    scenarios: [
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: true,
        description:
          'fires when a long English paragraph is injected into an SV page without lang="en" marker',
        mutate: async (page) => {
          // Rule: on Nordic-langs pages, any block ≥80 chars that "looks
          // English" must be marked with lang= override.
          await page.evaluate(() => {
            const p = document.createElement('p');
            p.textContent =
              'This is a long paragraph of English text that the rule should ' +
              'detect as foreign content on a Swedish-language page. ' +
              'According to the rule we need to mark this with a lang attribute.';
            document.body.appendChild(p);
          });
        },
      },
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: false,
        description:
          'passes when the same English block carries lang="en" override (mutated)',
        mutate: async (page) => {
          await page.evaluate(() => {
            const p = document.createElement('p');
            p.lang = 'en';
            p.textContent =
              'This is a long paragraph of English text that the rule should ' +
              'detect as foreign content on a Swedish-language page. ' +
              'According to the rule we need to mark this with a lang attribute.';
            document.body.appendChild(p);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description:
          'does not fire on cross-pack French statement (not a Nordic-locale page)',
      },
    ],
  },

  // ─── 7. numeric-validation-error-locale ──────────────────────────────
  {
    ruleId: 'ariada/banking/numeric-validation-error-locale',
    scenarios: [
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: true,
        description:
          'fires when an English-only validation error is injected into a Nordic-locale page',
        mutate: async (page) => {
          // Rule: on Nordic-langs pages, any element with role=alert or
          // class containing "error"/"invalid" that contains EN-only tokens
          // (e.g. "Please enter") fails.
          await page.evaluate(() => {
            const e = document.createElement('div');
            e.setAttribute('role', 'alert');
            e.textContent = 'Please enter a valid amount and try again.';
            document.body.appendChild(e);
          });
        },
      },
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: false,
        description:
          'passes when same alert carries the localised Swedish message (mutated)',
        mutate: async (page) => {
          await page.evaluate(() => {
            const e = document.createElement('div');
            e.setAttribute('role', 'alert');
            e.textContent = 'Ange ett giltigt belopp och försök igen.';
            document.body.appendChild(e);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description:
          'does not fire on cross-pack French statement (not a Nordic-locale page)',
      },
    ],
  },

  // ─── 8. session-timeout-warning ──────────────────────────────────────
  {
    ruleId: 'ariada/banking/session-timeout-warning',
    scenarios: [
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: true,
        description:
          'fires when an injected timeout alertdialog has no extend / continue button',
        mutate: async (page) => {
          await page.evaluate(() => {
            const dlg = document.createElement('div');
            dlg.setAttribute('role', 'alertdialog');
            dlg.className = 'timeout-warning';
            dlg.innerHTML =
              '<p>Din session löper snart ut.</p><button type="button">Avbryt</button>';
            document.body.appendChild(dlg);
          });
        },
      },
      {
        fixture: 'bankid-style-2fa-challenge-sv.html',
        expectViolation: false,
        description:
          'passes when every timeout-related region carries a "Fortsätt session" continue button',
        mutate: async (page) => {
          // Baseline fixture already contains <div id="timeout-warning"> with
          // no extend button — that alone would trigger the rule. Inject an
          // extend button into it AND add a separate alertdialog also with
          // its own extend button, so every node matched by
          // looksLikeTimeoutWarning carries the required action.
          await page.evaluate(() => {
            const existing = document.getElementById('timeout-warning');
            if (existing) {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.textContent = 'Fortsätt session';
              existing.appendChild(btn);
            }
            const dlg = document.createElement('div');
            dlg.setAttribute('role', 'alertdialog');
            dlg.className = 'session-timeout';
            dlg.innerHTML =
              '<p>Din session löper snart ut.</p>' +
              '<button type="button">Fortsätt session</button>';
            document.body.appendChild(dlg);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no timeout dialog elements)',
      },
    ],
  },

  // ─── 9. transaction-amount-input ─────────────────────────────────────
  {
    ruleId: 'ariada/banking/transaction-amount-input',
    scenarios: [
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: true,
        description:
          'fires when injected amount input has inputmode=decimal but no currency context',
        mutate: async (page) => {
          // Rule matches input with type text/number/tel + name/id matching
          // amount-ish + inputmode=decimal/numeric. FAILS if accessible
          // name / described-by lacks a currency token.
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="amt-bad">Belopp</label>' +
              '<input id="amt-bad" name="amount" type="text" inputmode="decimal">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'klarna-style-checkout-sv.html',
        expectViolation: false,
        description:
          'passes when injected amount input has currency context "(SEK)" in its label',
        mutate: async (page) => {
          await page.evaluate(() => {
            const w = document.createElement('div');
            w.innerHTML =
              '<label for="amt-ok">Belopp (SEK)</label>' +
              '<input id="amt-ok" name="amount" type="text" inputmode="decimal">';
            document.body.appendChild(w);
          });
        },
      },
      {
        fixture: 'rgaa-statement-fr.html',
        expectViolation: false,
        description: 'does not fire on cross-pack statement (no amount inputs)',
      },
    ],
  },
];

for (const { ruleId, scenarios, fixme } of RULE_CASES) {
  test.describe(ruleId, () => {
    for (const sc of scenarios) {
      const tag = sc.expectViolation ? '[FAIL fixture]' : '[PASS fixture]';
      const title = `${tag} ${sc.description} — ${sc.fixture}`;
      test(title, async ({ page, fixtureServer }, testInfo) => {
        if (fixme) {
          test.fixme(true, fixme);
        }
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

          const safeRuleId = ruleId.replace(/\//g, '_');
          const scenarioTag = sc.fixture.replace(/\.html$/i, '');
          await page.screenshot({
            path: `test-results/screenshots/${safeRuleId}-${testInfo.project.name}-${scenarioTag}.png`,
            fullPage: true,
          });
        }
      });
    }
  });
}
