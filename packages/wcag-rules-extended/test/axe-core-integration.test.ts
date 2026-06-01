// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
// Author: Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
/**
 * Integration tests — verify the public surface (`addEaaRules`, `eaaConfig`,
 * `allRules`, `allChecks`) registers cleanly with a real axe-core instance.
 *
 * These tests do NOT exercise rule logic against real DOM (that's covered
 * by per-rule unit tests). They confirm:
 *   - axe-core accepts our rule + check definitions without throwing
 *   - rule ids and check ids referenced in `any` arrays exist in `allChecks`
 *   - tags include at least one WCAG-2.x identifier per rule
 *   - metadata blocks satisfy the documented schema
 *
 * Without this, a schema drift between @ariada-org/wcag-rules-extended and
 * axe-core could ship to production undetected.
 */

import axe from 'axe-core';
import { describe, it, expect } from 'vitest';

import {
  addEaaRules,
  eaaConfig,
  allRules,
  allChecks,
  ecommerceCheckoutRules,
  statementRules,
  bankingRules,
  ebooksRules,
} from '../src/index.js';

describe('axe-core integration', () => {
  it('exposes 36 rules across all 4 packs', () => {
    expect(allRules.length).toBe(36);
    expect(ecommerceCheckoutRules.length).toBe(11);
    expect(statementRules.length).toBe(10);
    expect(bankingRules.length).toBe(10);
    expect(ebooksRules.length).toBe(5);
  });

  it('exposes one check per rule (36 total)', () => {
    expect(allChecks.length).toBe(36);
  });

  it('every rule.any[] references exactly one check id that exists in allChecks', () => {
    const checkIds = new Set(allChecks.map((c) => c.id));
    for (const rule of allRules) {
      expect(rule.any.length, `${rule.id} should have exactly 1 'any' check`).toBe(1);
      const checkId = rule.any[0];
      expect(checkIds.has(checkId), `${rule.id} references missing check '${checkId}'`).toBe(
        true,
      );
    }
  });

  it('every rule has a unique id namespaced under "ariada/"', () => {
    const ids = allRules.map((r) => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length); // No duplicates
    for (const id of ids) {
      expect(id.startsWith('ariada/'), `rule id ${id} not namespaced`).toBe(true);
    }
  });

  it('every rule tag set includes at least one WCAG SC tag (wcag\\d{3} or wcag22a)', () => {
    for (const rule of allRules) {
      const hasWcagTag = rule.tags.some((t) => /^wcag\d{2,3}$|^wcag2(2)?a{1,3}$/.test(t));
      expect(hasWcagTag, `${rule.id} has no WCAG SC tag in ${JSON.stringify(rule.tags)}`).toBe(
        true,
      );
    }
  });

  it('every rule metadata has wcag[] with ≥1 entry and a help-URL', () => {
    for (const rule of allRules) {
      const m = rule.metadata;
      expect(m.wcag.length, `${rule.id} metadata.wcag is empty`).toBeGreaterThanOrEqual(1);
      expect(typeof m.helpUrl).toBe('string');
      expect(m.helpUrl.length).toBeGreaterThan(0);
    }
  });

  it('eaaConfig() returns shape { rules: [...], checks: [...] } and counts match allRules / allChecks', () => {
    const config = eaaConfig();
    expect(config.rules.length).toBe(allRules.length);
    expect(config.checks.length).toBe(allChecks.length);
  });

  it('addEaaRules() registers cleanly with axe-core without throwing', () => {
    // Use the captured fake to verify the call shape, then also exercise the
    // real axe (which is a global object in axe-core).
    let captured: unknown = null;
    const fake = {
      configure: (config: unknown) => {
        captured = config;
      },
    };
    expect(() => addEaaRules(fake)).not.toThrow();
    expect(captured).toBeTruthy();
    expect((captured as { rules: unknown[] }).rules.length).toBe(allRules.length);

    // Real axe-core integration: configure should not throw.
    // axe-core types are loose — we cast through unknown to avoid pulling in
    // a heavy type import here.
    const axeAsConfigurable = axe as unknown as { configure: (c: unknown) => void };
    expect(() => addEaaRules(axeAsConfigurable)).not.toThrow();
  });

  it('exposes evidence emitters and penalty estimator from the public surface', async () => {
    // Smoke test that the secondary public exports remain wired up. Without
    // this, a refactor that drops a re-export would only break consumers in
    // production rather than at build time.
    const index = await import('../src/index.js');
    expect(typeof index.emitVpat).toBe('function');
    expect(typeof index.emitEn301549).toBe('function');
    expect(typeof index.emitDosLagen).toBe('function');
    expect(typeof index.estimatePenalty).toBe('function');
    expect(typeof index.generateStatement).toBe('function');
  });
});
