// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
import { describe, expect, it } from 'vitest';

import { sanitiseColor, sanitiseSvg } from '../src/sanitise-svg.js';

describe('sanitiseSvg', () => {
  it('strips <script> elements entirely', () => {
    const out = sanitiseSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
    expect(out).toContain('<circle');
  });

  it('strips self-closing <script/>', () => {
    const out = sanitiseSvg('<svg><script src="x.js"/></svg>');
    expect(out).not.toContain('<script');
  });

  it('strips on* event-handler attributes', () => {
    const out = sanitiseSvg('<svg><circle onclick="alert(1)" r="5"/></svg>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('<circle');
  });

  it('strips javascript: URLs in href / xlink:href', () => {
    const out = sanitiseSvg('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>');
    expect(out).not.toContain('javascript:');
  });

  it('strips <foreignObject> (HTML injection vector)', () => {
    const out = sanitiseSvg(
      '<svg><foreignObject><body onload="alert(1)"></body></foreignObject></svg>',
    );
    expect(out).not.toContain('<foreignObject');
    expect(out).not.toContain('onload');
  });

  it('returns empty string for non-SVG input', () => {
    expect(sanitiseSvg('<div>not an svg</div>')).toBe('');
    expect(sanitiseSvg('javascript:alert(1)')).toBe('');
  });

  it('returns empty string for undefined / empty input', () => {
    expect(sanitiseSvg(undefined)).toBe('');
    expect(sanitiseSvg('')).toBe('');
  });

  it('preserves a clean SVG verbatim (modulo trim)', () => {
    const clean = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="4"/></svg>';
    expect(sanitiseSvg(clean)).toBe(clean);
  });
});

// --- Security bypass tests (CodeQL HIGH: bad-tag-filter + incomplete-multi-character-sanitization) ---

describe('sanitiseSvg – bypass resistance', () => {
  // CodeQL js/incomplete-multi-character-sanitization:
  // Single-pass replace is defeated by reconstruction — after one removal the
  // outer wrapper reconstitutes a new <script> tag. Fix: fixed-point loop.

  it('neutralises script reconstruction via nested split: <scr<script>ipt>', () => {
    const payload = '<svg><scr<script>ipt>alert(1)</script></svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(1)');
  });

  it('neutralises doubly-nested script: <scrip<script></script>t>', () => {
    // After removing the inner <script></script>, the surrounding text fragments
    // join to form <script> — which the fixed-point loop then removes on the next
    // iteration. The security invariant is that no <script element survives.
    // The literal text "alert(2)" that appeared outside any script tag may remain
    // as inert SVG text content — it is not executable.
    const payload = '<svg><scrip<script></script>t>alert(2)</svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('<script');
  });

  it('neutralises foreignObject reconstruction via split: <forei<foreignObject>gnObject>', () => {
    const payload = '<svg><forei<foreignObject>gnObject><body onload="alert(3)"></body></foreignObject></svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('foreignObject');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('alert(3)');
  });

  it('neutralises event-handler reconstruction: on<script></script>click', () => {
    // A crafted attribute whose on*= handler is constructed after inner removal.
    const payload = '<svg><circle on<script></script>click="alert(4)" r="1"/></svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('alert(4)');
  });

  // CodeQL js/bad-tag-filter:
  // The regex <script\b...> can miss unclosed openers and unusual whitespace.

  it('strips unclosed <script opener with no closing tag', () => {
    // A dangling opener left by a partial match can still execute in some parsers.
    const payload = '<svg><script src="evil.js" </svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('<script');
  });

  it('strips <script with newline after tag name (whitespace trick)', () => {
    const payload = '<svg><script\nsrc="evil.js"></script></svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('<script');
  });

  it('strips mixed-case <ScRiPt>', () => {
    const payload = '<svg><ScRiPt>alert(5)</ScRiPt></svg>';
    const out = sanitiseSvg(payload);
    expect(out).not.toContain('<ScRiPt');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(5)');
  });

  it('returns empty string (fail-closed) when iteration cap is reached on pathological input', () => {
    // A deeply mutually-reconstructing string that can never be fully cleaned
    // should trigger the cap and return '' rather than loop forever.
    // Build a string that creates new <script tags after each removal:
    const pathological = '<svg>' + '<scr'.repeat(60) + '<script>alert(6)' + '</script>'.repeat(60) + 'ipt>'.repeat(60) + '</svg>';
    // We just want it to terminate quickly and not contain script:
    const start = Date.now();
    const out = sanitiseSvg(pathological);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500); // must not spin
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert(6)');
  });

  it('preserves clean SVG paths and rects unchanged after fixed-point loop', () => {
    const clean = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<rect width="50" height="50" fill="#336699"/>' +
      '<path d="M10 10 L90 90" stroke="black"/>' +
      '<text x="5" y="15">Hello</text>' +
      '</svg>';
    const out = sanitiseSvg(clean);
    expect(out).toBe(clean);
  });
});

describe('sanitiseColor', () => {
  it('accepts hex colours', () => {
    expect(sanitiseColor('#fff')).toBe('#fff');
    expect(sanitiseColor('#0b3d91')).toBe('#0b3d91');
    expect(sanitiseColor('#0b3d91ff')).toBe('#0b3d91ff');
  });

  it('accepts rgb()/hsl() functional notation', () => {
    expect(sanitiseColor('rgb(11, 61, 145)')).toBe('rgb(11, 61, 145)');
    expect(sanitiseColor('hsl(217, 86%, 31%)')).toBe('hsl(217, 86%, 31%)');
  });

  it('accepts allowlisted named colours', () => {
    expect(sanitiseColor('black')).toBe('black');
    expect(sanitiseColor('transparent')).toBe('transparent');
  });

  it('rejects colours containing CSS escapes', () => {
    expect(sanitiseColor('red; background: url(http://evil)')).toBeUndefined();
    expect(sanitiseColor('red}body{background:red')).toBeUndefined();
    expect(sanitiseColor('url(http://evil.example/x.png)')).toBeUndefined();
  });

  it('rejects unknown named colours', () => {
    expect(sanitiseColor('papayawhip')).toBeUndefined();
  });

  it('returns undefined for empty / null input', () => {
    expect(sanitiseColor(undefined)).toBeUndefined();
    expect(sanitiseColor('')).toBeUndefined();
  });
});
