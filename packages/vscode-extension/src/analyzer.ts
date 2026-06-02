// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { getRule, listRules, meetsThreshold, type RuleDefinition, type RuleSeverity } from './rules.js';

/**
 * Pure-function template analyzer.
 *
 * The analyzer surface is LSP-shaped: «document text + URI» in,
 * «finding list» out. No vscode API references here so the module can be
 * shared with a future Language Server or a CLI runner without modification.
 */

/**
 *
 */
export interface AnalysisRange {
  readonly startOffset: number;
  readonly endOffset: number;
}

/**
 *
 */
export interface Finding {
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  readonly range: AnalysisRange;
}

/**
 *
 */
export interface AnalyzeOptions {
  readonly languageId: string;
  readonly severityThreshold?: RuleSeverity;
  readonly disabledRules?: readonly string[];
}

interface Element {
  readonly tag: string;
  readonly attrs: ReadonlyMap<string, string | true>;
  readonly start: number;
  readonly end: number;
}

const TAG_REGEX = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)\/?>/g;
const ATTR_REGEX = /(\w[\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
const ATTR_PRESENT_REGEX = /\b([\w:.-]+)\b(?:\s*=|\s|\/|>|$)/g;

const SUPPORTED_LANGUAGES = new Set<string>([
  'html',
  'javascriptreact',
  'typescriptreact',
  'vue',
  'svelte',
]);

/**
 *
 */
export function isSupportedLanguage(languageId: string): boolean {
  return SUPPORTED_LANGUAGES.has(languageId);
}

/**
 *
 */
export function analyze(text: string, options: AnalyzeOptions): readonly Finding[] {
  if (!isSupportedLanguage(options.languageId)) {
    return [];
  }
  const threshold: RuleSeverity = options.severityThreshold ?? 'minor';
  const disabled = new Set(options.disabledRules ?? []);

  const elements = scanElements(text);
  const findings: Finding[] = [];

  for (const el of elements) {
    collectPerElementFindings(text, el, findings);
  }

  collectHeadingOrderFindings(elements, findings);

  if (options.languageId === 'html') {
    collectLanguageOfPageFindings(elements, findings);
  }

  return findings.filter((f) => !disabled.has(f.ruleId) && meetsThreshold(f.severity, threshold));
}

function scanElements(text: string): Element[] {
  const elements: Element[] = [];
  let match: RegExpExecArray | null;
  TAG_REGEX.lastIndex = 0;
  while ((match = TAG_REGEX.exec(text)) !== null) {
    elements.push({
      tag: match[1]!.toLowerCase(),
      attrs: parseAttributes(match[2] ?? ''),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return elements;
}

function collectPerElementFindings(text: string, el: Element, out: Finding[]): void {
  if (el.tag === 'img') {
    if (!el.attrs.has('alt')) {
      pushFinding(out, 'wcag-22-1-1-1-image-alt', el.start, el.end);
    }
    return;
  }

  if (el.tag === 'input') {
    checkInputName(el, out);
    return;
  }

  if (el.tag === 'button') {
    checkButtonName(text, el, out);
    return;
  }

  if (el.tag === 'a') {
    checkLinkPurpose(text, el, out);
    return;
  }

  if (/^h[1-6]$/.test(el.tag)) {
    checkEmptyHeading(text, el, out);
  }
}

function checkInputName(el: Element, out: Finding[]): void {
  const type = (getAttributeValue(el.attrs, 'type') ?? 'text').toLowerCase();
  const skipTypes = new Set(['hidden', 'submit', 'reset', 'button', 'image']);
  if (skipTypes.has(type)) {
    return;
  }
  const hasName =
    el.attrs.has('aria-label') ||
    el.attrs.has('aria-labelledby') ||
    el.attrs.has('title') ||
    el.attrs.has('id');
  if (!hasName) {
    pushFinding(out, 'wcag-22-3-3-2-input-name', el.start, el.end);
  }
}

function checkButtonName(text: string, el: Element, out: Finding[]): void {
  const hasAriaName = el.attrs.has('aria-label') || el.attrs.has('aria-labelledby');
  if (hasAriaName) {
    return;
  }
  if (!hasInnerText(text, el.end, '</button>')) {
    pushFinding(out, 'wcag-22-4-1-2-button-name', el.start, el.end);
  }
}

function checkLinkPurpose(text: string, el: Element, out: Finding[]): void {
  const hasAriaName = el.attrs.has('aria-label') || el.attrs.has('aria-labelledby');
  if (hasAriaName) {
    return;
  }
  if (!hasInnerText(text, el.end, '</a>')) {
    pushFinding(out, 'wcag-22-2-4-4-link-purpose', el.start, el.end);
  }
}

function checkEmptyHeading(text: string, el: Element, out: Finding[]): void {
  if (!hasInnerText(text, el.end, `</${el.tag}>`)) {
    pushFinding(out, 'wcag-22-2-4-6-heading-empty', el.start, el.end);
  }
}

function hasInnerText(text: string, fromOffset: number, closeTag: string): boolean {
  const closeIndex = text.indexOf(closeTag, fromOffset);
  if (closeIndex <= fromOffset) {
    return false;
  }
  const inner = stripTags(text.slice(fromOffset, closeIndex)).trim();
  return inner.length > 0;
}

/**
 * Remove HTML/SGML tag spans from a fragment to recover the visible text.
 *
 * A single `replace(/<[^>]+>/g, '')` pass is unsafe: removing inner spans can
 * splice the surrounding angle brackets back together into a fresh tag (for
 * example `<<b>i>` collapses to `<i>` after one pass), so a single pass leaves
 * reconstructed tags behind. We instead replace repeatedly until the result is
 * stable, which guarantees no `<...>` span survives.
 */
function stripTags(fragment: string): string {
  let current = fragment;
  for (;;) {
    const next = current.replace(/<[^<>]*>/g, '');
    if (next === current) {
      return next;
    }
    current = next;
  }
}

function collectHeadingOrderFindings(elements: readonly Element[], out: Finding[]): void {
  const headings = elements.filter((e) => /^h[1-6]$/.test(e.tag));
  let prevLevel: number | null = null;
  for (const h of headings) {
    const level = parseInt(h.tag.substring(1), 10);
    if (prevLevel !== null && level > prevLevel + 1) {
      pushFinding(out, 'wcag-22-1-3-1-heading-order', h.start, h.end);
    }
    prevLevel = level;
  }
}

function collectLanguageOfPageFindings(elements: readonly Element[], out: Finding[]): void {
  const html = elements.find((e) => e.tag === 'html');
  if (html && !html.attrs.has('lang')) {
    pushFinding(out, 'eaa-language-of-page', html.start, html.end);
  }
}

function pushFinding(out: Finding[], ruleId: string, startOffset: number, endOffset: number): void {
  const rule = getRule(ruleId);
  if (!rule) {
    return;
  }
  out.push({
    ruleId,
    severity: rule.severity,
    message: rule.shortMessage,
    range: { startOffset, endOffset },
  });
}

function parseAttributes(blob: string): Map<string, string | true> {
  const attrs = new Map<string, string | true>();
  if (!blob || blob.trim().length === 0) {
    return attrs;
  }
  let m: RegExpExecArray | null;
  ATTR_REGEX.lastIndex = 0;
  while ((m = ATTR_REGEX.exec(blob)) !== null) {
    const name = m[1]!.toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    attrs.set(name, value);
  }
  ATTR_PRESENT_REGEX.lastIndex = 0;
  while ((m = ATTR_PRESENT_REGEX.exec(blob)) !== null) {
    const name = m[1]!.toLowerCase();
    if (!attrs.has(name)) {
      attrs.set(name, true);
    }
  }
  return attrs;
}

function getAttributeValue(
  attrs: ReadonlyMap<string, string | true>,
  name: string,
): string | undefined {
  const v = attrs.get(name.toLowerCase());
  if (v === true || v === undefined) {
    return undefined;
  }
  return v;
}

/**
 *
 */
export function listAvailableRules(): readonly RuleDefinition[] {
  return listRules();
}
