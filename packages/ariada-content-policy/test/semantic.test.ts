// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import {
  evaluateContentAsync,
  promptProfile,
  type ContentProfile,
  type RulePack,
  type SemanticEvaluator,
  type SemanticRequest,
} from '../src/index.js';

/**
 * A fake evaluator standing in for the injected LLM. It implements the prompt
 * contract deterministically: it flags any line containing a keyword named in
 * the rule's prompt. Real hosts inject a host-supplied evaluator (internal use) or
 * a managed-API adapter (client runtime); the engine never calls an LLM itself.
 */
const keywordEvaluator: SemanticEvaluator = {
  evaluate(req: SemanticRequest) {
    const keyword = req.rule.prompt.toLowerCase().replace(/^flag any mention of\s+/i, '').trim();
    const lines = req.content.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const idx = line.toLowerCase().indexOf(keyword);
      if (idx !== -1) {
        hits.push({
          matchedText: line.slice(idx, idx + keyword.length),
          line: i + 1,
          reason: `matched the prompt instruction "${req.rule.prompt}"`,
        });
      }
    }
    return Promise.resolve(hits);
  },
};

describe('promptProfile — a filter authored from a single client prompt', () => {
  it('builds a one-rule semantic profile + pack from a natural-language prompt', () => {
    const { profile, pack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    expect(profile.surface).toBe('public-blog');
    expect(profile.packs).toEqual([pack.id]);
    expect(pack.rules).toHaveLength(1);
    expect(pack.rules[0]?.prompt).toBe('Flag any mention of Acme');
    expect(pack.rules[0]?.patterns).toEqual([]); // no regex — the prompt is the filter
  });
});

describe('evaluateContentAsync — prompt rules run through the injected evaluator', () => {
  it('returns semantic findings (tier=semantic) in the GateDecision shape', async () => {
    const { profile, pack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    const decision = await evaluateContentAsync(
      'A clean first line.\nOur rival Acme shipped a feature.',
      profile,
      [pack],
      keywordEvaluator,
    );
    expect(decision.result).toBe('fail');
    expect(decision.findings).toHaveLength(1);
    expect(decision.findings[0]?.tier).toBe('semantic');
    expect(decision.findings[0]?.matchedText.toLowerCase()).toBe('acme');
    expect(decision.findings[0]?.line).toBe(2);
    expect(decision.findings[0]?.reason).toContain('Flag any mention of Acme');
  });

  it('passes clean content against the prompt', async () => {
    const { profile, pack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    const decision = await evaluateContentAsync('Nothing forbidden here.', profile, [pack], keywordEvaluator);
    expect(decision.result).toBe('pass');
    expect(decision.findings).toHaveLength(0);
  });

  it('records prompt rules as unevaluated when NO evaluator is injected (never silently passes)', async () => {
    const { profile, pack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    const decision = await evaluateContentAsync('Our rival Acme shipped.', profile, [pack]);
    expect(decision.unevaluated).toBeDefined();
    expect(decision.unevaluated).toHaveLength(1);
    expect(decision.unevaluated?.[0]?.ruleId).toContain('prompt');
    // the leak is NOT counted as a finding, but the gap is visible to the caller
    expect(decision.findings).toHaveLength(0);
  });

  it('runs deterministic and prompt rules together, tagging each finding tier', async () => {
    const detPack: RulePack = {
      id: 'det',
      description: 'deterministic',
      rules: [{ id: 'token', description: 'fake token', action: 'fail', category: 'secret', patterns: ['secret-\\d+'] }],
    };
    const { pack: promptPack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    const profile: ContentProfile = { id: 'mixed', surface: 'public-blog', packs: ['det', promptPack.id] };
    const decision = await evaluateContentAsync(
      'token secret-42 here\nrival Acme also',
      profile,
      [detPack, promptPack],
      keywordEvaluator,
    );
    const tiers = decision.findings.map((f) => f.tier).sort();
    expect(tiers).toEqual(['deterministic', 'semantic']);
    expect(decision.result).toBe('fail');
  });

  it('honours the allow-list for semantic hits too', async () => {
    const { profile, pack } = promptProfile('client-x', 'public-blog', 'Flag any mention of Acme');
    const withAllow: ContentProfile = { ...profile, allowlist: ['Acme'] };
    const decision = await evaluateContentAsync('rival Acme shipped', withAllow, [pack], keywordEvaluator);
    expect(decision.findings).toHaveLength(0);
    expect(decision.counts.allowlisted).toBe(1);
  });
});
