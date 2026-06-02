// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { analyze, isSupportedLanguage } from '../../src/analyzer.js';

describe('analyzer — isSupportedLanguage', () => {
  it('accepts html, jsx, tsx, vue, svelte', () => {
    for (const id of ['html', 'javascriptreact', 'typescriptreact', 'vue', 'svelte']) {
      expect(isSupportedLanguage(id)).toBe(true);
    }
  });

  it('rejects unknown language ids', () => {
    for (const id of ['plaintext', 'python', 'markdown', '']) {
      expect(isSupportedLanguage(id)).toBe(false);
    }
  });
});

describe('analyzer — image alt rule', () => {
  it('flags <img> missing alt', () => {
    const text = `<div><img src="x.png" /></div>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-1-1-image-alt')).toBeTruthy();
  });

  it('does not flag <img> with alt', () => {
    const text = `<img src="x.png" alt="Logo" />`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-1-1-image-alt')).toBeUndefined();
  });

  it('does not flag <img> with empty alt (explicit decorative)', () => {
    const text = `<img src="x.png" alt="" />`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-1-1-image-alt')).toBeUndefined();
  });
});

describe('analyzer — empty button rule', () => {
  it('flags button with no text and no aria-label', () => {
    const text = `<button></button>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-4-1-2-button-name')).toBeTruthy();
  });

  it('does not flag button with text content', () => {
    const text = `<button>Submit</button>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-4-1-2-button-name')).toBeUndefined();
  });

  it('does not flag button with aria-label', () => {
    const text = `<button aria-label="Close"></button>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-4-1-2-button-name')).toBeUndefined();
  });

  it('treats nested/reconstructable tag-only content as empty (no visible text)', () => {
    // `<<b>i>` collapses to `<i>` after a single tag-strip pass; the inner-text
    // check must keep stripping until stable so this counts as no visible text
    // and the empty-button rule still fires.
    const text = `<button><<b>i></button>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-4-1-2-button-name')).toBeTruthy();
  });

  it('still detects real text wrapped in nested tags', () => {
    const text = `<button><span><b>Save</b></span></button>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-4-1-2-button-name')).toBeUndefined();
  });
});

describe('analyzer — link purpose rule', () => {
  it('flags empty anchor', () => {
    const text = `<a href="/x"></a>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-2-4-4-link-purpose')).toBeTruthy();
  });

  it('does not flag anchor with text', () => {
    const text = `<a href="/x">Home</a>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-2-4-4-link-purpose')).toBeUndefined();
  });
});

describe('analyzer — empty heading rule', () => {
  it('flags <h2></h2>', () => {
    const text = `<h2></h2>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-2-4-6-heading-empty')).toBeTruthy();
  });
});

describe('analyzer — heading order rule', () => {
  it('flags h1 then h3 (skip h2)', () => {
    const text = `<h1>A</h1><h3>B</h3>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-3-1-heading-order')).toBeTruthy();
  });

  it('does not flag h1 then h2', () => {
    const text = `<h1>A</h1><h2>B</h2>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-3-1-heading-order')).toBeUndefined();
  });
});

describe('analyzer — language of page rule', () => {
  it('flags root <html> without lang', () => {
    const text = `<html><head></head><body></body></html>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'eaa-language-of-page')).toBeTruthy();
  });

  it('does not flag root <html> with lang', () => {
    const text = `<html lang="sv"><head></head><body></body></html>`;
    const findings = analyze(text, { languageId: 'html' });
    expect(findings.find((f) => f.ruleId === 'eaa-language-of-page')).toBeUndefined();
  });
});

describe('analyzer — JSX support', () => {
  it('flags <img /> in TSX', () => {
    const text = `export function X() { return <img src="x.png" />; }`;
    const findings = analyze(text, { languageId: 'typescriptreact' });
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-1-1-image-alt')).toBeTruthy();
  });
});

describe('analyzer — severity threshold', () => {
  it('filters out moderate findings when threshold is serious', () => {
    const text = `<html><body><img src="x.png" /></body></html>`;
    const findings = analyze(text, {
      languageId: 'html',
      severityThreshold: 'serious',
    });
    // critical (image-alt) survives, moderate (eaa-language-of-page) is filtered
    expect(findings.find((f) => f.ruleId === 'wcag-22-1-1-1-image-alt')).toBeTruthy();
    expect(findings.find((f) => f.ruleId === 'eaa-language-of-page')).toBeUndefined();
  });
});

describe('analyzer — disabled rules', () => {
  it('skips disabled rule IDs', () => {
    const text = `<img src="x.png" />`;
    const findings = analyze(text, {
      languageId: 'html',
      disabledRules: ['wcag-22-1-1-1-image-alt'],
    });
    expect(findings).toHaveLength(0);
  });
});

describe('analyzer — unsupported language returns empty', () => {
  it('returns empty for python', () => {
    const findings = analyze('print("hello")', { languageId: 'python' });
    expect(findings).toHaveLength(0);
  });
});
