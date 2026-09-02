// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Tier-0 deterministic remediation applied to a LIVE document — the engine
// behind the extension's healed before/after preview (the console's "open live
// in plugin" loop). Zero model calls: it fixes what WCAG maths can decide with
// certainty — insufficient text contrast (recolour to meet 4.5:1), images with
// no accessible name (mark decorative), and inputs with visible-but-unassociated
// labels. Every change is recorded so the overlay can toggle before/after and
// the console can show exactly what Reverter would apply.

/**
 *
 */
export interface Fix {
  rule: 'color-contrast' | 'image-alt' | 'label';
  selector: string;
  before: string;
  after: string;
}

/**
 *
 */
export interface RemediationResult {
  fixes: Fix[];
  revert: () => void;
}

// --- WCAG contrast maths (self-contained; mirrors reverter-cascade tier-0) ----
const AA_NORMAL = 4.5;
type RGB = [number, number, number];

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: RGB): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}
function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function parseColor(value: string): RGB | null {
  const m = /rgba?\(([^)]+)\)/.exec(value);
  if (!m?.[1]) return null;
  const parts = m[1].split(',').map((p) => Number.parseFloat(p.trim()));
  const [r, g, b, a] = parts;
  if (r === undefined || g === undefined || b === undefined) return null;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  if (a === 0) return null; // fully transparent
  return [r, g, b];
}
function toCss([r, g, b]: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}
// Effective background: walk ancestors until a non-transparent bg is found.
function effectiveBg(el: Element): RGB {
  let node: Element | null = el;
  while (node) {
    const bg = parseColor(getComputedStyle(node).backgroundColor);
    if (bg) return bg;
    node = node.parentElement;
  }
  return [255, 255, 255];
}
// Nudge a foreground colour toward black or white until it clears AA on the bg.
function fixForeground(fg: RGB, bg: RGB): RGB | null {
  if (contrastRatio(fg, bg) >= AA_NORMAL) return null;
  const target: RGB = luminance(bg) > 0.5 ? [0, 0, 0] : [255, 255, 255];
  let lo = 0;
  let hi = 1;
  // binary-search the blend fraction toward the target that just clears AA
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const blended: RGB = [
      fg[0] + (target[0] - fg[0]) * mid,
      fg[1] + (target[1] - fg[1]) * mid,
      fg[2] + (target[2] - fg[2]) * mid,
    ];
    if (contrastRatio(blended, bg) >= AA_NORMAL) hi = mid;
    else lo = mid;
  }
  return [
    fg[0] + (target[0] - fg[0]) * hi,
    fg[1] + (target[1] - fg[1]) * hi,
    fg[2] + (target[2] - fg[2]) * hi,
  ];
}

function cssPath(el: Element): string {
  if (el.id) return `#${el.id}`;
  const tag = el.tagName.toLowerCase();
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return cls.length ? `${tag}.${cls.join('.')}` : tag;
}

function hasText(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim().length > 0,
  );
}

/** What each pass is handed: somewhere to record a fix, and somewhere to record how to take it back. */
interface Pass {
  fixes: Fix[];
  undo: Array<() => void>;
}

/** Recolour text that fails AA against its effective background. */
function fixContrast(doc: Document, { fixes, undo }: Pass): void {
  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('*'))) {
    if (!hasText(el)) continue;
    const style = getComputedStyle(el);
    const fg = parseColor(style.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const fixed = fixForeground(fg, bg);
    if (!fixed) continue;
    const beforeInline = el.style.color;
    const beforeCss = toCss(fg);
    el.style.setProperty('color', toCss(fixed), 'important');
    undo.push(() => (el.style.color = beforeInline));
    fixes.push({ rule: 'color-contrast', selector: cssPath(el), before: beforeCss, after: toCss(fixed) });
  }
}

/** An image with no accessible name is marked decorative rather than guessed at. */
function fixImageAlt(doc: Document, { fixes, undo }: Pass): void {
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    if (img.hasAttribute('alt') || img.getAttribute('aria-label') || img.getAttribute('role') === 'presentation') continue;
    img.setAttribute('alt', '');
    undo.push(() => img.removeAttribute('alt'));
    fixes.push({ rule: 'image-alt', selector: cssPath(img), before: '(no alt)', after: 'alt="" (decorative)' });
  }
}

/** A field whose label sits beside it unassociated gets the association spelled out. */
function fixMissingLabel(doc: Document, { fixes, undo }: Pass): void {
  for (const input of Array.from(doc.querySelectorAll<HTMLInputElement>('input, select, textarea'))) {
    if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby') || input.id) continue;
    const prev = input.previousElementSibling;
    const text = prev && !prev.matches('input,select,textarea') ? (prev.textContent || '').trim() : '';
    if (!text || text.length > 60) continue;
    input.setAttribute('aria-label', text);
    undo.push(() => input.removeAttribute('aria-label'));
    fixes.push({ rule: 'label', selector: cssPath(input), before: '(no accessible name)', after: `aria-label="${text}"` });
  }
}

/** Apply tier-0 deterministic fixes to `doc`. Returns the list + a revert(). */
export function applyTier0Remediations(doc: Document = document): RemediationResult {
  const pass: Pass = { fixes: [], undo: [] };

  fixContrast(doc, pass);
  fixImageAlt(doc, pass);
  fixMissingLabel(doc, pass);

  // A copy is reversed, not the list itself: reverting twice used to undo in
  // the order the fixes were applied the second time, because the first call
  // had turned the list around and left it that way.
  return { fixes: pass.fixes, revert: () => { for (const f of [...pass.undo].reverse()) f() } };
}
