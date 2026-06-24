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

const FORBIDDEN_ELEMENT_NAMES = new Set(['script', 'foreignobject']);
const URL_ATTRIBUTE_NAMES = new Set(['href', 'xlink:href', 'src']);
const DANGEROUS_URL_SCHEMES = new Set(['javascript', 'data', 'vbscript']);
const NAMED_COLOURS = new Set([
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

/**
 * Maximum number of fixed-point iterations before giving up.
 * A clean SVG converges in 1 pass; a pathological reconstruction chain should
 * converge in 2-3. If it hasn't after MAX_ITERATIONS the input is adversarial —
 * we fail closed and return an empty string.
 */
const MAX_STRIP_ITERATIONS = 32;

function isSvgWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
}

function isTagBoundary(char: string): boolean {
  return char === '' || char === '>' || char === '/' || isSvgWhitespace(char);
}

function isNameChar(char: string): boolean {
  return char !== '' && char !== '=' && char !== '/' && char !== '>' && !isSvgWhitespace(char);
}

function findTagEnd(markup: string, openIndex: number): number {
  let quote: string | undefined;
  for (let i = openIndex + 1; i < markup.length; i += 1) {
    const char = markup[i] ?? '';
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return i;
  }
  return -1;
}

function readName(markup: string, offset: number): { name: string; end: number } {
  let end = offset;
  while (end < markup.length && isNameChar(markup[end] ?? '')) end += 1;
  return { name: markup.slice(offset, end).toLowerCase(), end };
}

function matchesElement(markup: string, openIndex: number, name: string): boolean {
  const lower = markup.toLowerCase();
  const needle = `<${name}`;
  return lower.startsWith(needle, openIndex) && isTagBoundary(lower[openIndex + needle.length] ?? '');
}

function findForbiddenOpen(markup: string, start: number, end: number): number {
  const lower = markup.toLowerCase();
  let script = lower.indexOf('<script', start);
  while (script !== -1 && script < end) {
    if (isTagBoundary(lower[script + '<script'.length] ?? '')) return script;
    script = lower.indexOf('<script', script + 1);
  }

  let foreignObject = lower.indexOf('<foreignobject', start);
  while (foreignObject !== -1 && foreignObject < end) {
    if (isTagBoundary(lower[foreignObject + '<foreignobject'.length] ?? '')) return foreignObject;
    foreignObject = lower.indexOf('<foreignobject', foreignObject + 1);
  }

  return -1;
}

function findForbiddenElementEnd(markup: string, openIndex: number, name: string): number {
  const openEnd = findTagEnd(markup, openIndex);
  if (openEnd === -1) return markup.length;
  if (markup.slice(openIndex, openEnd).trimEnd().endsWith('/')) return openEnd + 1;

  const lower = markup.toLowerCase();
  const closeNeedle = `</${name}`;
  const closeStart = lower.indexOf(closeNeedle, openEnd + 1);
  if (closeStart === -1 || !isTagBoundary(lower[closeStart + closeNeedle.length] ?? '')) {
    return openEnd + 1;
  }
  const closeEnd = findTagEnd(markup, closeStart);
  return closeEnd === -1 ? markup.length : closeEnd + 1;
}

function readAttributeValue(tag: string, offset: number): { end: number; value: string } {
  let i = offset;
  while (i < tag.length && isSvgWhitespace(tag[i] ?? '')) i += 1;
  if (tag[i] !== '=') return { end: i, value: '' };
  i += 1;
  while (i < tag.length && isSvgWhitespace(tag[i] ?? '')) i += 1;

  const quote = tag[i];
  if (quote === '"' || quote === "'") {
    i += 1;
    const valueStart = i;
    const valueEnd = tag.indexOf(quote, valueStart);
    if (valueEnd === -1) return { end: tag.length, value: tag.slice(valueStart) };
    return { end: valueEnd + 1, value: tag.slice(valueStart, valueEnd) };
  }

  const valueStart = i;
  while (i < tag.length && !isSvgWhitespace(tag[i] ?? '') && tag[i] !== '>') i += 1;
  return { end: i, value: tag.slice(valueStart, i) };
}

function hasDangerousUrlScheme(value: string): boolean {
  const colon = value.trimStart().indexOf(':');
  if (colon === -1) return false;
  return DANGEROUS_URL_SCHEMES.has(value.trimStart().slice(0, colon).toLowerCase());
}

function hasForbiddenCssSyntax(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  for (let i = 0; i < lower.length; i += 1) {
    const char = lower[i] ?? '';
    if (char === '<' || char === '>' || char === '{' || char === '}' || char === ';') return true;
    if (lower.startsWith('url', i)) {
      let next = i + 3;
      while (next < lower.length && isSvgWhitespace(lower[next] ?? '')) next += 1;
      if (lower[next] === '(') return true;
    }
  }
  return false;
}

function isHexDigit(char: string): boolean {
  return (
    (char >= '0' && char <= '9') ||
    (char >= 'a' && char <= 'f') ||
    (char >= 'A' && char <= 'F')
  );
}

function isHexColour(candidate: string): boolean {
  if (!candidate.startsWith('#')) return false;
  if (![4, 5, 7, 9].includes(candidate.length)) return false;
  for (let i = 1; i < candidate.length; i += 1) {
    if (!isHexDigit(candidate[i] ?? '')) return false;
  }
  return true;
}

function isColourFunctionBodyChar(char: string): boolean {
  return (
    (char >= '0' && char <= '9') ||
    char === ',' ||
    char === '.' ||
    char === '%' ||
    char === '/' ||
    char === '-' ||
    isSvgWhitespace(char)
  );
}

function isFunctionalColour(candidate: string): boolean {
  const lower = candidate.toLowerCase();
  const functionName = ['rgba', 'hsla', 'rgb', 'hsl'].find((name) => lower.startsWith(name));
  if (functionName === undefined) return false;

  let cursor = functionName.length;
  while (cursor < lower.length && isSvgWhitespace(lower[cursor] ?? '')) cursor += 1;
  if (lower[cursor] !== '(' || !lower.endsWith(')')) return false;

  const bodyStart = cursor + 1;
  const bodyEnd = lower.length - 1;
  if (bodyStart >= bodyEnd) return false;
  for (let i = bodyStart; i < bodyEnd; i += 1) {
    if (!isColourFunctionBodyChar(candidate[i] ?? '')) return false;
  }
  return true;
}

function sanitiseOpeningTag(tag: string): string {
  let i = 1;
  if (tag[i] === '/') return tag;
  const tagName = readName(tag, i);
  if (tagName.name === '') return tag;
  i = tagName.end;

  let out = tag.slice(0, i);
  while (i < tag.length) {
    const attrStart = i;
    while (i < tag.length && isSvgWhitespace(tag[i] ?? '')) i += 1;
    const whitespace = tag.slice(attrStart, i);
    if (tag[i] === '/' || tag[i] === '>' || i >= tag.length) {
      out += tag.slice(attrStart);
      break;
    }

    const name = readName(tag, i);
    if (name.name === '') {
      out += tag.slice(attrStart);
      break;
    }
    const value = readAttributeValue(tag, name.end);
    const shouldDrop =
      name.name.startsWith('on') ||
      (URL_ATTRIBUTE_NAMES.has(name.name) && hasDangerousUrlScheme(value.value));
    if (!shouldDrop) out += whitespace + tag.slice(i, value.end);
    i = Math.max(value.end, i + 1);
  }

  return out;
}

function applyScannerPass(markup: string): string {
  let out = '';
  let cursor = 0;

  while (cursor < markup.length) {
    const open = markup.indexOf('<', cursor);
    if (open === -1) {
      out += markup.slice(cursor);
      break;
    }
    out += markup.slice(cursor, open);

    const forbiddenName = [...FORBIDDEN_ELEMENT_NAMES].find((name) => matchesElement(markup, open, name));
    if (forbiddenName !== undefined) {
      cursor = findForbiddenElementEnd(markup, open, forbiddenName);
      continue;
    }

    const tagEnd = findTagEnd(markup, open);
    if (tagEnd === -1) {
      out += markup.slice(open);
      break;
    }

    const embeddedForbidden = findForbiddenOpen(markup, open + 1, tagEnd);
    if (embeddedForbidden !== -1) {
      out += markup.slice(open, embeddedForbidden);
      const embeddedName = [...FORBIDDEN_ELEMENT_NAMES].find((name) =>
        matchesElement(markup, embeddedForbidden, name),
      );
      cursor =
        embeddedName === undefined
          ? embeddedForbidden + 1
          : findForbiddenElementEnd(markup, embeddedForbidden, embeddedName);
      continue;
    }

    out += sanitiseOpeningTag(markup.slice(open, tagEnd + 1));
    cursor = tagEnd + 1;
  }

  return out;
}

/**
 * Sanitise an inline SVG string. Returns the sanitised SVG, or an empty
 * string if the input does not look like an SVG document.
 *
 * Each strip pattern is applied in a fixed-point loop: the full set of
 * replacements is repeated until the string stops changing (or the iteration
 * cap is reached, in which case the function fails closed with ''). This
 * eliminates the incomplete-multi-character-sanitization bypass where a single
 * pass leaves behind a reconstructed attack vector.
 */
export function sanitiseSvg(svg: string | undefined): string {
  if (svg === undefined || svg === null || svg === '') {
    return '';
  }
  const trimmed = String(svg).trim();
  if (!matchesElement(trimmed, 0, 'svg')) {
    // Not an SVG root — refuse rather than risk embedding arbitrary markup.
    return '';
  }

  let current = trimmed;
  for (let i = 0; i < MAX_STRIP_ITERATIONS; i++) {
    const next = applyScannerPass(current);
    if (next === current) {
      // Fixed point reached — no further changes possible.
      return current;
    }
    current = next;
  }

  // Iteration cap reached — the input is adversarially constructed such that
  // strip patterns keep producing new attack vectors. Fail closed.
  return '';
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
  if (hasForbiddenCssSyntax(candidate)) {
    return undefined;
  }
  // Hex
  if (isHexColour(candidate)) {
    return candidate;
  }
  // rgb/rgba/hsl/hsla functional notation
  if (isFunctionalColour(candidate)) {
    return candidate;
  }
  // Tiny named-colour allowlist (extend as needed)
  if (NAMED_COLOURS.has(candidate.toLowerCase())) {
    return candidate;
  }
  return undefined;
}
