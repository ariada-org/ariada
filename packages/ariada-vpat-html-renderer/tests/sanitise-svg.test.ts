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
