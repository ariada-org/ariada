// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// Brand-logo SVG sanitiser.
//
// Customers supply inline SVG (Scalable Vector Graphics) strings for cover-
// page branding. We strip:
//   1. <script> elements (entire subtree)
//   2. event-handler attributes (on*=...)
//   3. javascript: / data: URLs in href / xlink:href / src attributes
//   4. <foreignObject> (allows arbitrary HTML embedding)
//
// This is conservative — we do NOT pull in DOMPurify or a full SAX parser.
// Customers wanting richer SVG should pre-sanitise themselves and accept
// the responsibility.

const SCRIPT_ELEMENT_RE = /<script\b[\s\S]*?<\/script>/gi;
const SCRIPT_SELF_CLOSING_RE = /<script\b[^>]*\/>/gi;
const FOREIGN_OBJECT_RE = /<foreignObject\b[\s\S]*?<\/foreignObject>/gi;
const FOREIGN_OBJECT_SELF_CLOSING_RE = /<foreignObject\b[^>]*\/>/gi;
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_URL_RE =
  /\s+(?:href|xlink:href|src)\s*=\s*(?:"\s*(?:javascript|data|vbscript):[^"]*"|'\s*(?:javascript|data|vbscript):[^']*')/gi;

/**
 * Sanitise an inline SVG string. Returns the sanitised SVG, or an empty
 * string if the input does not look like an SVG document.
 */
export function sanitiseSvg(svg: string | undefined): string {
  if (svg === undefined || svg === null || svg === '') {
    return '';
  }
  const trimmed = String(svg).trim();
  if (!/^<svg\b/i.test(trimmed)) {
    // Not an SVG root — refuse rather than risk embedding arbitrary markup.
    return '';
  }
  return trimmed
    .replace(SCRIPT_ELEMENT_RE, '')
    .replace(SCRIPT_SELF_CLOSING_RE, '')
    .replace(FOREIGN_OBJECT_RE, '')
    .replace(FOREIGN_OBJECT_SELF_CLOSING_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(DANGEROUS_URL_RE, '');
}

/**
 * Validate a CSS colour literal. Accepts `#rgb`, `#rrggbb`, `#rrggbbaa`,
 * `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, and a small allowlist
 * of CSS named colours. Returns the validated colour, or `undefined` if
 * the input is unsafe (contains `;`, `{`, `}`, `<`, `>`, or `url(`).
 */
export function sanitiseColor(color: string | undefined): string | undefined {
  if (color === undefined || color === null || color === '') {
    return undefined;
  }
  const candidate = String(color).trim();
  if (/[<>{};]/.test(candidate) || /url\s*\(/i.test(candidate)) {
    return undefined;
  }
  // Hex
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)) {
    return candidate;
  }
  // rgb/rgba/hsl/hsla functional notation
  if (/^(?:rgb|rgba|hsl|hsla)\s*\([0-9,.\s%/-]+\)$/i.test(candidate)) {
    return candidate;
  }
  // Tiny named-colour allowlist (extend as needed)
  const NAMED = new Set([
    'black',
    'white',
    'red',
    'green',
    'blue',
    'gray',
    'grey',
    'navy',
    'teal',
    'orange',
    'purple',
    'maroon',
    'olive',
    'silver',
    'lime',
    'aqua',
    'fuchsia',
    'yellow',
    'transparent',
    'currentcolor',
  ]);
  if (NAMED.has(candidate.toLowerCase())) {
    return candidate;
  }
  return undefined;
}
