// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Small DOM utilities shared across rule checks.
 *
 * All helpers MUST be deterministic, side-effect free, no network.
 * Tested via `helpers.test.ts`.
 */

/**
 * Return the trimmed accessible name of an element, preferring (in order):
 *   1. `aria-labelledby` (resolved)
 *   2. `aria-label`
 *   3. Associated `<label>` via `for=` or wrapping
 *   4. `title`
 *   5. `placeholder` (fallback only — placeholder is NOT a proper accessible name per WCAG 3.3.2)
 *
 * Returns empty string if none found. This is NOT a full accessible-name
 * computation per W3C ACCNAME spec — it's a pragmatic subset sufficient for
 * the checks in this package. Full ACCNAME computation is delegated to
 * upstream axe-core.
 *
 * @see https://www.w3.org/TR/accname-1.2/
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- ACCNAME-Lite mirrors W3C spec branching; refactor planned in Wave 2 alongside full ACCNAME compliance
export function getAccessibleNameLite(el: Element): string {
  if (!el) return '';

  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const doc = el.ownerDocument;
    const ids = labelledby.split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (const id of ids) {
      const ref = doc.getElementById(id);
      if (ref?.textContent) parts.push(ref.textContent.trim());
    }
    if (parts.length > 0) return parts.join(' ').trim();
  }

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // <label for=id>
  const id = el.getAttribute('id');
  if (id) {
    const doc = el.ownerDocument;
    const label = doc.querySelector(`label[for="${cssEscape(id)}"]`);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // wrapping <label>
  const wrappingLabel = el.closest('label');
  if (wrappingLabel?.textContent?.trim()) return wrappingLabel.textContent.trim();

  const title = el.getAttribute('title');
  if (title && title.trim()) return title.trim();

  const placeholder = el.getAttribute('placeholder');
  if (placeholder && placeholder.trim()) return placeholder.trim();

  // For buttons / links — visible text content. Also covers ARIA role="button"
  // applied to generic elements (`<div role="button">…</div>` is a common
  // pattern for custom UI controls), and `<input type="submit|button|reset">`
  // whose accessible name source is the `value` attribute (per HTML AAM).
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  if (tag === 'button' || tag === 'a' || role === 'button') {
    const text = el.textContent?.trim() ?? '';
    if (text) return text;
  }
  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (type === 'submit' || type === 'button' || type === 'reset') {
      const value = el.getAttribute('value');
      if (value && value.trim()) return value.trim();
    }
  }

  return '';
}

/**
 * Best-effort CSS.escape polyfill — happy-dom 15.x supports CSS.escape,
 * but we use a defensive fallback for older runtimes.
 */
export function cssEscape(s: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

