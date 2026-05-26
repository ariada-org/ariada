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
// eslint-disable-next-line sonarjs/cognitive-complexity -- ACCNAME-Lite mirrors W3C spec branching; refactor planned alongside full ACCNAME compliance
export function getAccessibleNameLite(element: Element): string {
  if (!element) return "";

  const labelledby = element.getAttribute("aria-labelledby");
  if (labelledby) {
    const document = element.ownerDocument;
    const ids = labelledby.split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref?.textContent) parts.push(ref.textContent.trim());
    }
    if (parts.length > 0) return parts.join(" ").trim();
  }

  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // <label for=id>
  const id = element.getAttribute("id");
  if (id) {
    const document = element.ownerDocument;
    const label = findExplicitLabel(document, id);
    if (label?.textContent?.trim()) return label.textContent.trim();
  }

  // wrapping <label>
  const wrappingLabel = element.closest("label");
  if (wrappingLabel?.textContent?.trim())
    return wrappingLabel.textContent.trim();

  const title = element.getAttribute("title");
  if (title && title.trim()) return title.trim();

  const placeholder = element.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) return placeholder.trim();

  // For buttons / links — visible text content. Also covers ARIA role="button"
  // applied to generic elements (`<div role="button">…</div>` is a common
  // pattern for custom UI controls), and `<input type="submit|button|reset">`
  // whose accessible name source is the `value` attribute (per HTML AAM).
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute("role");
  if (tag === "button" || tag === "a" || role === "button") {
    const text = element.textContent?.trim() ?? "";
    if (text) return text;
  }
  if (tag === "input") {
    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (type === "submit" || type === "button" || type === "reset") {
      const value = element.getAttribute("value");
      if (value && value.trim()) return value.trim();
    }
  }

  return "";
}

function findExplicitLabel(
  document: Document,
  id: string,
): HTMLLabelElement | undefined {
  return Array.from(document.getElementsByTagName("label")).find(
    (label) => label.htmlFor === id,
  );
}

/**
 * Best-effort CSS.escape polyfill — happy-dom 15.x supports CSS.escape,
 * but we use a defensive fallback for older runtimes.
 */
export function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
