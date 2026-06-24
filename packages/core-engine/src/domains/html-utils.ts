// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

interface AttributeMatch {
  readonly name: string;
  readonly nextOffset: number;
  readonly value: string;
}

/** A lightweight raw HTML element match from the string scanner. */
export interface HtmlElementMatch {
  readonly attrs: string;
  readonly body: string;
  readonly openTag: string;
  readonly tagName: string;
}

/** A lightweight raw HTML opening-tag match from the string scanner. */
export interface HtmlOpeningTagMatch {
  readonly attrs: string;
  readonly fullTag: string;
  readonly tagName: string;
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '\f';
}

function isTagBoundary(char: string): boolean {
  return char === '' || char === '>' || char === '/' || isWhitespace(char);
}

function findOpeningTagEnd(html: string, openIndex: number): number {
  let quote: string | undefined;
  for (let i = openIndex + 1; i < html.length; i += 1) {
    const char = html[i] ?? '';
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

function readAttribute(attrs: string, offset: number): AttributeMatch | undefined {
  let i = offset;
  while (i < attrs.length && isWhitespace(attrs[i] ?? '')) i += 1;
  const nameStart = i;
  while (i < attrs.length) {
    const char = attrs[i] ?? '';
    if (char === '=' || char === '/' || isWhitespace(char)) break;
    i += 1;
  }
  if (i === nameStart) return undefined;

  const name = attrs.slice(nameStart, i).toLowerCase();
  while (i < attrs.length && isWhitespace(attrs[i] ?? '')) i += 1;
  if (attrs[i] !== '=') return { name, nextOffset: i, value: '' };
  i += 1;
  while (i < attrs.length && isWhitespace(attrs[i] ?? '')) i += 1;

  const quote = attrs[i];
  if (quote === '"' || quote === "'") {
    i += 1;
    const valueStart = i;
    const valueEnd = attrs.indexOf(quote, valueStart);
    if (valueEnd === -1) return { name, nextOffset: attrs.length, value: attrs.slice(valueStart) };
    return { name, nextOffset: valueEnd + 1, value: attrs.slice(valueStart, valueEnd) };
  }

  const valueStart = i;
  while (i < attrs.length && !isWhitespace(attrs[i] ?? '') && attrs[i] !== '>') i += 1;
  return { name, nextOffset: i, value: attrs.slice(valueStart, i) };
}

/** Return an attribute value from a raw opening-tag attribute string. */
export function getHtmlAttribute(attrs: string, attributeName: string): string | undefined {
  const target = attributeName.toLowerCase();
  let offset = 0;
  while (offset < attrs.length) {
    const match = readAttribute(attrs, offset);
    if (match === undefined) break;
    if (match.name === target) return match.value;
    offset = Math.max(match.nextOffset, offset + 1);
  }
  return undefined;
}

/** Remove closed HTML comment blocks without using nested wildcard regexes. */
export function stripHtmlComments(html: string): string {
  let out = '';
  let cursor = 0;
  while (cursor < html.length) {
    const open = html.indexOf('<!--', cursor);
    if (open === -1) {
      out += html.slice(cursor);
      break;
    }
    const close = html.indexOf('-->', open + 4);
    if (close === -1) {
      out += html.slice(cursor);
      break;
    }
    out += html.slice(cursor, open);
    cursor = close + 3;
  }
  return out;
}

/** Return visible text content by removing complete HTML tags from a fragment. */
export function stripHtmlTags(fragment: string): string {
  let out = '';
  let cursor = 0;
  while (cursor < fragment.length) {
    const open = fragment.indexOf('<', cursor);
    if (open === -1) {
      out += fragment.slice(cursor);
      break;
    }
    const close = findOpeningTagEnd(fragment, open);
    if (close === -1) {
      out += fragment.slice(cursor);
      break;
    }
    out += fragment.slice(cursor, open);
    cursor = close + 1;
  }
  return out;
}

function readTagName(html: string, offset: number): { end: number; name: string } {
  let end = offset;
  while (end < html.length) {
    const char = html[end] ?? '';
    if (char === '' || char === '>' || char === '/' || isWhitespace(char)) break;
    end += 1;
  }
  return { end, name: html.slice(offset, end).toLowerCase() };
}

/** Return every complete opening tag, optionally restricted to tag names. */
export function findHtmlOpeningTags(html: string, tagNames?: readonly string[]): HtmlOpeningTagMatch[] {
  const allowed = tagNames === undefined ? undefined : new Set(tagNames.map((tag) => tag.toLowerCase()));
  const matches: HtmlOpeningTagMatch[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) break;
    const afterOpen = html[open + 1] ?? '';
    if (afterOpen === '/' || afterOpen === '!' || afterOpen === '?') {
      cursor = open + 1;
      continue;
    }

    const tag = readTagName(html, open + 1);
    if (tag.name === '') {
      cursor = open + 1;
      continue;
    }

    const end = findOpeningTagEnd(html, open);
    if (end === -1) break;
    if (allowed === undefined || allowed.has(tag.name)) {
      matches.push({
        attrs: html.slice(tag.end, end),
        fullTag: html.slice(open, end + 1),
        tagName: tag.name,
      });
    }
    cursor = end + 1;
  }

  return matches;
}

/** Return elements with their raw body by scanning matching open and close tags. */
export function findHtmlElements(html: string, tagNames: readonly string[]): HtmlElementMatch[] {
  const allowed = new Set(tagNames.map((tag) => tag.toLowerCase()));
  const matches: HtmlElementMatch[] = [];
  let cursor = 0;
  const lower = html.toLowerCase();

  while (cursor < html.length) {
    const open = html.indexOf('<', cursor);
    if (open === -1) break;
    const tag = readTagName(html, open + 1);
    if (!allowed.has(tag.name)) {
      cursor = open + 1;
      continue;
    }

    const openEnd = findOpeningTagEnd(html, open);
    if (openEnd === -1) break;
    const closeNeedle = `</${tag.name}`;
    const close = lower.indexOf(closeNeedle, openEnd + 1);
    if (close === -1) {
      cursor = openEnd + 1;
      continue;
    }
    const closeEnd = findOpeningTagEnd(html, close);
    if (closeEnd === -1) break;

    matches.push({
      attrs: html.slice(tag.end, openEnd),
      body: html.slice(openEnd + 1, close),
      openTag: html.slice(open, openEnd + 1),
      tagName: tag.name,
    });
    cursor = closeEnd + 1;
  }

  return matches;
}

/** Return true when an attribute is present regardless of its value. */
export function hasHtmlAttribute(attrs: string, attributeName: string): boolean {
  return getHtmlAttribute(attrs, attributeName) !== undefined;
}

/** Case-insensitive substring check for an HTML attribute. */
export function htmlAttributeIncludesAny(
  attrs: string,
  attributeName: string,
  terms: readonly string[],
): boolean {
  const value = getHtmlAttribute(attrs, attributeName)?.toLowerCase() ?? '';
  return terms.some((term) => value.includes(term.toLowerCase()));
}

/** Collapse whitespace runs without regex backtracking. */
export function collapseWhitespace(text: string): string {
  let out = '';
  let inWhitespace = false;
  for (const char of text) {
    if (isWhitespace(char)) {
      if (!inWhitespace) out += ' ';
      inWhitespace = true;
      continue;
    }
    out += char;
    inWhitespace = false;
  }
  return out.trim();
}

/** Extract the inner HTML of the first matching element, if it has a close tag. */
export function extractFirstElementContent(html: string, tagName: string): string | undefined {
  const lower = html.toLowerCase();
  const tag = tagName.toLowerCase();
  const openNeedle = `<${tag}`;
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const open = lower.indexOf(openNeedle, searchFrom);
    if (open === -1) return undefined;
    const boundary = lower[open + openNeedle.length] ?? '';
    if (!isTagBoundary(boundary)) {
      searchFrom = open + openNeedle.length;
      continue;
    }

    const openEnd = findOpeningTagEnd(html, open);
    if (openEnd === -1) return undefined;
    const close = lower.indexOf(`</${tag}`, openEnd + 1);
    if (close === -1) return undefined;
    return html.slice(openEnd + 1, close);
  }

  return undefined;
}

/** Extract raw application/ld+json script contents from an HTML document. */
export function extractJsonLdScriptBlocks(html: string): string[] {
  const lower = html.toLowerCase();
  const blocks: string[] = [];
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const open = lower.indexOf('<script', searchFrom);
    if (open === -1) break;
    const boundary = lower[open + '<script'.length] ?? '';
    if (!isTagBoundary(boundary)) {
      searchFrom = open + '<script'.length;
      continue;
    }

    const openEnd = findOpeningTagEnd(html, open);
    if (openEnd === -1) break;
    const attrs = html.slice(open + '<script'.length, openEnd);
    const close = lower.indexOf('</script', openEnd + 1);
    if (close === -1) break;
    const closeEnd = findOpeningTagEnd(html, close);
    searchFrom = closeEnd === -1 ? close + '</script'.length : closeEnd + 1;

    const type = getHtmlAttribute(attrs, 'type')?.trim().toLowerCase();
    if (type === 'application/ld+json') {
      blocks.push(html.slice(openEnd + 1, close));
    }
  }

  return blocks;
}
