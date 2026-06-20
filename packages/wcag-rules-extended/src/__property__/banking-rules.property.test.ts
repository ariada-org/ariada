// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Property-based tests for banking rule checks (iban-input-format,
 * currency-format-readable). Generates random valid + invalid inputs and
 * asserts each rule's invariants hold across the entire generated space.
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { check as currencyCheck } from '../rules/banking/currency-format-readable.js';
import { check as ibanCheck } from '../rules/banking/iban-input-format.js';
import { setBodyFromFragment, resetBody } from '../test-utils.js';

describe('rules/banking/iban-input-format — property tests', () => {
  beforeEach(() => resetBody());

  /**
   * Arbitrary that generates a valid segmented IBAN-format placeholder
   * matching SEGMENTED_FORMAT_RE: `^[A-Z]{2}\d{2}(\s\d{2,4}){2,}`.
   *
   * Examples: "SE45 5000 0000 0583 9825 7466", "FI21 1234 5600 0007 85".
   */
  const upperLetterArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
  const digitArb = fc.constantFrom(...'0123456789'.split(''));
  const validSegmentedIbanArb = fc
    .tuple(
      // Country: exactly 2 uppercase letters (ISO 3166-1 alpha-2 shape)
      fc.tuple(upperLetterArb, upperLetterArb).map(([a, b]) => `${a}${b}`),
      // Check digits: exactly 2 digits
      fc.tuple(digitArb, digitArb).map(([a, b]) => `${a}${b}`),
      // Body segments: 2-7 segments of 2-4 digits each
      fc.array(
        fc.array(digitArb, { minLength: 2, maxLength: 4 }).map((array) => array.join('')),
        { minLength: 2, maxLength: 7 },
      ),
    )
    .map(([country, checkDigits, segs]) => `${country}${checkDigits} ${segs.join(' ')}`);

  it('PROP: IBAN check PASSES for any IBAN input with segmented placeholder matching ISO 13616-pattern prefix', () => {
    fc.assert(
      fc.property(validSegmentedIbanArb, (placeholder) => {
        const document = setBodyFromFragment(
          `<input type="text" name="iban" aria-label="IBAN" placeholder="${placeholder}">`,
        );
        const result = ibanCheck(document.querySelector('input')!);
        expect(result).toBe(true);
      }),
      {
        numRuns: 100,
        examples: [
          ['SE45 5000 0000 0583 9825 7466'],
          ['FI21 1234 5600 0007 85'],
          ['DE89 3704 0044 0532 0130 00'],
          ['NO93 8601 1117 947'], // 3 segments, shortest accepted form
        ],
      },
    );
  });

  it('PROP: IBAN check FAILS for IBAN inputs with placeholders TOO SHORT (no segmented prefix)', () => {
    // Strings shorter than `XX99 NNNN NNNN` (i.e. less than 2 trailing
    // segments) must fail. We generate single-segment or zero-segment forms.
    const shortPlaceholderArb = fc.oneof(
      fc.constant(''),
      // "XX99" — country + check digits, no segments
      fc
        .tuple(upperLetterArb, upperLetterArb, digitArb, digitArb)
        .map(([a, b, c, d]) => `${a}${b}${c}${d}`),
      // "XX99 NNN" — country + check digits + one segment (need ≥2 segments to pass)
      fc
        .tuple(
          upperLetterArb,
          upperLetterArb,
          digitArb,
          digitArb,
          fc.array(digitArb, { minLength: 2, maxLength: 4 }),
        )
        .map(([a, b, c, d, seg]) => `${a}${b}${c}${d} ${seg.join('')}`),
    );
    fc.assert(
      fc.property(shortPlaceholderArb, (placeholder) => {
        const document = setBodyFromFragment(
          `<input type="text" name="iban" aria-label="IBAN" placeholder="${placeholder}">`,
        );
        const result = ibanCheck(document.querySelector('input')!);
        expect(result).toBe(false);
      }),
      {
        numRuns: 100,
        examples: [[''], ['SE45'], ['SE45 5000'], ['FI21 1234']],
      },
    );
  });
});

describe('rules/banking/currency-format-readable — property tests', () => {
  beforeEach(() => resetBody());

  /**
   * Arbitrary for unicode-formatted currency strings. Mixes locale formats:
   *   - Nordic (Swedish/Norwegian/Danish/Finnish): "1 234,56 kr" / "1 234,56 €"
   *   - US:     "$1,234.56"
   *   - EU:     "1.234,56 €"
   *   - UK:     "£1,234.56"
   *
   * Always contains a digit + a recognized currency token, so
   * `looksLikeCurrencyDisplay` will fire.
   */
  const currencyTextArb = fc
    .tuple(
      fc.integer({ min: 1, max: 999_999_999 }),
      fc.integer({ min: 0, max: 99 }),
      fc.constantFrom(
        // Each entry is [thousandsSep, decimalSep, currencyToken, position]
        [' ', ',', 'kr', 'suffix'],
        [' ', ',', '€', 'suffix'],
        [' ', ',', 'SEK', 'suffix'],
        [' ', ',', 'NOK', 'suffix'],
        [' ', ',', 'DKK', 'suffix'],
        [' ', ',', 'eur', 'suffix'],
        [',', '.', '$', 'prefix'],
        [',', '.', '£', 'prefix'],
        ['.', ',', '€', 'suffix'],
      ) as fc.Arbitrary<[string, string, string, 'prefix' | 'suffix']>,
    )
    .map(([intPart, frac, [thSeparator, decSeparator, token, pos]]) => {
      const intString = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, thSeparator);
      const fracString = String(frac).padStart(2, '0');
      const amount = `${intString}${decSeparator}${fracString}`;
      return pos === 'prefix' ? `${token}${amount}` : `${amount} ${token}`;
    });

  it('PROP: currency check FAILS for any unicode-formatted currency in plain banking-class element', () => {
    fc.assert(
      fc.property(
        currencyTextArb,
        fc.constantFrom('balance', 'amount', 'price', 'saldo', 'belopp', 'summa'),
        (currencyText, className) => {
          // Escape any HTML special chars in currencyText (none expected from
          // the arbitrary above, but defensive).
          const safe = currencyText.replace(/[<>&"]/g, '');
          const document = setBodyFromFragment(`<span class="${className}">${safe}</span>`);
          const element = document.querySelector(`.${className}`)!;
          // Plain text in a banking-class element MUST fail — the rule's
          // entire point is to require <data> / <output> / aria-label.
          const result = currencyCheck(element);
          expect(result).toBe(false);
        },
      ),
      {
        numRuns: 100,
        examples: [
          ['1 234,56 kr', 'balance'],
          ['$1,234.56', 'amount'],
          ['€999,00', 'price'],
          ['1.000.000,00 €', 'saldo'],
          ['0,01 kr', 'belopp'],
        ],
      },
    );
  });

  it('PROP: currency check PASSES when same currency text is wrapped in <data value>', () => {
    fc.assert(
      fc.property(currencyTextArb, (currencyText) => {
        const safe = currencyText.replace(/[<>&"]/g, '');
        const document = setBodyFromFragment(
          `<span class="balance"><data value="1234.56">${safe}</data></span>`,
        );
        const element = document.querySelector('.balance')!;
        expect(currencyCheck(element)).toBe(true);
      }),
      {
        numRuns: 100,
        examples: [['1 234,56 kr'], ['$1,234.56'], ['€999,00']],
      },
    );
  });
});
