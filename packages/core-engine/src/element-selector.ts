// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// One definition of how an element is named in a finding.
//
// A finding says which element failed. If the selector it records cannot find
// that element again, everything downstream loses its footing: the report
// cannot show where the problem is, a fix cannot be verified, and the
// fingerprint that ties this finding to the same finding in the next scan is
// built on a name that points at nothing.
//
// The rule that matters is at the bottom of `buildElementSelector`: a selector
// is only accepted once it has been asked to find the element and has come back
// with that element and nothing else. A selector that was merely constructed
// correctly is not the same as one that works — `img:nth-of-type(23)` looks
// plausible and means "an image that is the twenty-third image of its parent",
// which is almost never the twenty-third image on the page.
//
// The whole function is self-contained on purpose, and takes only the element.
// It is handed to a browser to run inside the page it is describing: it arrives
// as its own source text and can reach nothing from the scope it was written
// in. That also keeps it clear of a page's content-security policy, which would
// block the usual trick of rebuilding a function from a string.

/** The elements a finding can be about.
 *
 *  Both passes over a page — the outline and the contrast read — must walk the
 *  same set in the same order, so the list lives here rather than being written
 *  out twice. */
export const FINDING_ELEMENTS =
  'h1, h2, h3, h4, h5, h6, a, button, img, input, select, textarea, [role], [aria-label], p, li, label, [tabindex]';

/** Name an element so the same element can be found again in its document. */
export function buildElementSelector(el: Element): string {
  const doc = el.ownerDocument;
  /** Escape a value so it is safe as a CSS identifier, with a fallback for
   *  contexts where `CSS.escape` is missing. */
  function cssIdentifier(value: string): string {
    const cssEscape = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS?.escape;
    if (cssEscape) return cssEscape(value);

    return Array.from(value)
      .map((char, index) => {
        if (char === '\0') return '�';
        const codePoint = char.codePointAt(0) ?? 0;
        const isAsciiLetter =
          (codePoint >= 0x41 && codePoint <= 0x5a) || (codePoint >= 0x61 && codePoint <= 0x7a);
        const isDigit = codePoint >= 0x30 && codePoint <= 0x39;
        const isSafeContinuation = index > 0 && (isDigit || char === '-');
        if (isAsciiLetter || char === '_' || isSafeContinuation) return char;
        return `\\${codePoint.toString(16)} `;
      })
      .join('');
  }

  /** Position among siblings of the same tag — which is what `:nth-of-type`
   *  actually means, and not the element's position on the page. */
  function nthOfTypeSelectorPart(node: Element): string {
    const tag = node.tagName.toLowerCase();
    let position = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === node.tagName) position += 1;
      sibling = sibling.previousElementSibling;
    }
    return `${tag}:nth-of-type(${position})`;
  }

  /** The short, readable form to try first. */
  function preferredSelectorPart(node: Element): string {
    const tag = node.tagName.toLowerCase();
    const id = node.getAttribute('id');
    if (id) return `${tag}#${cssIdentifier(id)}`;
    const cls = (node.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)[0];
    if (cls) return `${tag}.${cssIdentifier(cls)}`;
    return nthOfTypeSelectorPart(node);
  }

  /** Ask the document. This is the check the rest of the function exists for. */
  function selectorResolvesTo(candidate: string): boolean {
    try {
      return doc.querySelector(candidate) === el && doc.querySelectorAll(candidate).length === 1;
    } catch {
      return false;
    }
  }

  const preferred = preferredSelectorPart(el);
  if (selectorResolvesTo(preferred)) return preferred;

  // Not unique on its own, so walk up adding one ancestor at a time and stop as
  // soon as the path picks out this element alone.
  const parts = [nthOfTypeSelectorPart(el)];
  let parent = el.parentElement;
  while (parent) {
    parts.unshift(nthOfTypeSelectorPart(parent));
    const candidate = parts.join(' > ');
    if (selectorResolvesTo(candidate)) return candidate;
    parent = parent.parentElement;
  }

  // Reaching here means even the full path from the root is ambiguous, which
  // takes a document that repeats an identical structure. Return the path
  // anyway: it is the most specific thing available, and it is honest about
  // what it points at.
  return parts.join(' > ');
}
