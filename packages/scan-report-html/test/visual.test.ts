// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import { describe, expect, it } from 'vitest';

import { imageSize, isDrawable, nothingToShow, renderVisualReport, whyNotShown } from '../src/visual.js';
import type { VisualPage } from '../src/visual.js';

/** A 1280×955 PNG header, which is all `pngSize` reads. */
function fakePng(w: number, h: number): string {
  const b = Buffer.alloc(48);
  b.write('\x89PNG\r\n\x1a\n', 0, 'binary');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b.toString('base64');
}

const IMAGE = { w: 1280, h: 955 };

describe('reading the capture size', () => {
  it('takes width and height from the PNG header', () => {
    expect(imageSize(fakePng(1306, 6917))).toEqual({ w: 1306, h: 6917, mime: 'image/png' });
  });

  it('walks a JPEG to its start-of-frame segment, past whatever comes first', () => {
    // A JFIF header, then an application segment, then the frame — which is the
    // order a browser's encoder writes, and the reason a fixed offset fails.
    const b = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe0, 0x00, 0x10]),
      Buffer.alloc(14),
      Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x08, 0x05, 0x1a]),
    ]);
    expect(imageSize(b.toString('base64'))).toEqual({ w: 1306, h: 520, mime: 'image/jpeg' });
  });

  it('says nothing rather than guessing when the bytes are neither', () => {
    expect(imageSize(Buffer.from('not a picture').toString('base64')).w).toBe(0);
  });
});

describe('deciding whether a finding can be shown', () => {
  it('shows an ordinary element', () => {
    expect(isDrawable({ x: 40, y: 200, w: 120, h: 30 }, IMAGE, 'nav > a')).toBe(true);
  });

  it('does not show a finding with no element at all', () => {
    expect(isDrawable(undefined, IMAGE, 'nav')).toBe(false);
  });

  it('does not show an element parked off-canvas', () => {
    // A skip link at left:-9999px has coordinates and nothing to point at.
    expect(isDrawable({ x: -9999, y: 10, w: 200, h: 20 }, IMAGE, '.skip')).toBe(false);
  });

  it('does not show an element of no size', () => {
    expect(isDrawable({ x: 10, y: 10, w: 0, h: 0 }, IMAGE, 'span')).toBe(false);
  });

  it('does not show an element below the capture', () => {
    // The page scrolls inside a container, so the element is real and was
    // never photographed.
    expect(isDrawable({ x: 10, y: 1600, w: 100, h: 20 }, IMAGE, 'main p')).toBe(false);
  });

  it('does not outline the whole document', () => {
    expect(isDrawable({ x: 0, y: 0, w: 1280, h: 900 }, IMAGE, 'html')).toBe(false);
    expect(isDrawable({ x: 0, y: 0, w: 1280, h: 900 }, IMAGE, ' body ')).toBe(false);
  });
});

describe('saying why a finding has no picture', () => {
  it('names each case rather than saying nothing', () => {
    expect(whyNotShown(undefined, IMAGE, 'a', 'en')).toMatch(/not found/);
    expect(whyNotShown({ x: 0, y: 0, w: 10, h: 10 }, IMAGE, 'html', 'en')).toMatch(/whole page/);
    expect(whyNotShown({ x: -20, y: 0, w: 10, h: 10 }, IMAGE, '.skip', 'en')).toMatch(/off-canvas/);
    expect(whyNotShown({ x: 0, y: 0, w: 0, h: 0 }, IMAGE, 'i', 'en')).toMatch(/no size/);
    expect(whyNotShown({ x: 0, y: 5000, w: 10, h: 10 }, IMAGE, 'p', 'en')).toMatch(/past the capture/);
  });
});

const PAGE: VisualPage = {
  name: 'example',
  url: 'http://127.0.0.1:8099/',
  screenshot: fakePng(1280, 955),
  findings: [
    { ruleId: 'color-contrast', severity: 'serious', message: 'Contrast too low', selector: '#a', box: { x: 20, y: 40, w: 100, h: 24 } },
    { ruleId: 'image-alt', severity: 'critical', message: 'No alternative text', selector: 'img:nth-of-type(2)', box: { x: 300, y: 500, w: 80, h: 80 } },
    { ruleId: 'region', severity: 'moderate', message: 'No main landmark', selector: 'html', box: { x: 0, y: 0, w: 1280, h: 955 } },
    { ruleId: 'link-name', severity: 'serious', message: 'Link has no name', selector: '.skip', box: { x: -9999, y: 10, w: 200, h: 20 } },
  ],
};

describe('the rendered report', () => {
  const html = renderVisualReport([PAGE], { subtitle: 'run of the day', lang: 'en' });

  it('is one self-contained file with the screenshot inside', () => {
    expect(html).toContain('data:image/png;base64,');
    expect(html).not.toMatch(/<img[^>]+src="(?!data:)/);
    expect(html).not.toContain('<script');
  });

  it('declares the screenshot once however many crops use it', () => {
    const declarations = html.match(/background-image:url\(data:image\/png/g) ?? [];
    expect(declarations).toHaveLength(1);
    const crops = html.match(/class="crop p0"/g) ?? [];
    expect(crops.length).toBeGreaterThan(1);
  });

  it('counts what it showed against what it found, and the two differ honestly', () => {
    expect(html).toContain('2 of 4');
  });

  it('colours the box by severity from the shared palette', () => {
    expect(html).toContain('border:2px solid #ffb224'); // serious
    expect(html).toContain('border:2px solid #e5484d'); // critical
  });

  it('lists what it could not show, with the reason', () => {
    expect(html).toMatch(/whole page/);
    expect(html).toMatch(/off-canvas/);
  });

  it('places each mark inside its own window', () => {
    // The offset maths put nine of fifty-four marks outside their crop once.
    const marks = [...html.matchAll(/left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px;height:([\d.]+)px/g)];
    expect(marks.length).toBeGreaterThan(0);
    for (const [, left, top, w, h] of marks) {
      expect(Number(left)).toBeGreaterThanOrEqual(-2);
      expect(Number(top)).toBeGreaterThanOrEqual(-2);
      expect(Number(left) + Number(w)).toBeLessThanOrEqual(520 + 2);
      expect(Number(top) + Number(h)).toBeLessThanOrEqual(260 + 2);
    }
  });

  it('escapes what came from the scanned page', () => {
    const nasty = renderVisualReport(
      [{ ...PAGE, name: '<script>x</script>', findings: [{ ruleId: 'r', severity: 'minor', message: '<b>hi</b>', selector: '"><img>', box: { x: 1, y: 1, w: 5, h: 5 } }] }],
      { lang: 'en' },
    );
    expect(nasty).not.toContain('<script>x</script>');
    expect(nasty).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });
});

describe('the count in the headline', () => {
  it('counts findings that got a picture, not findings that could have had one', () => {
    // The headline said 259 of 436 while 68 cards were drawn: the cap was
    // silently below the number the headline promised.
    const html = renderVisualReport([PAGE], { cardsPerPage: 1, lang: 'en' });
    expect(html).toContain('1 of 4');
    const crops = html.match(/class="crop p0"/g) ?? [];
    expect(crops).toHaveLength(1);
  });

  it('draws every drawable finding when no cap is asked for', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).toContain('2 of 4');
    expect(html.match(/class="crop p0"/g) ?? []).toHaveLength(2);
  });
});

describe('finding your way around the report', () => {
  const html = renderVisualReport([PAGE], { lang: 'en' });

  it('says what the colours mean', () => {
    expect(html).toContain('What the colours mean');
    expect(html).toContain('border-color:#e5484d');
  });

  it('links the summary rows to their sections and names the page scanned', () => {
    expect(html).toContain('href="#page-0"');
    expect(html).toContain('id="page-0"');
    expect(html).toContain('http://127.0.0.1:8099/');
  });
});

describe('the legend and the overlay palette', () => {
  it('gives one swatch per colour, so no two squares look alike', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    const swatches = html.match(/border-color:(#[0-9a-f]{6})/g) ?? [];
    expect(new Set(swatches).size).toBe(swatches.length);
    // moderate and minor share a colour in the shared palette, so they share a key.
    expect(html).toContain('moderate / minor');
  });
});

describe('an element larger than the window', () => {
  it('scales the picture so the whole outline fits, rather than showing a corner', () => {
    const hero: VisualPage = {
      ...PAGE,
      findings: [
        {
          ruleId: 'image-alt',
          severity: 'serious',
          message: 'Image is missing alternative text',
          selector: 'img.hero',
          box: { x: 0, y: 100, w: 1240, h: 620 },
        },
      ],
    };
    const html = renderVisualReport([hero], { lang: 'en' });
    expect(html).toContain('background-size:');
    const mark = /width:([\d.]+)px;height:([\d.]+)px/.exec(html);
    expect(Number(mark?.[1])).toBeLessThanOrEqual(520);
    expect(Number(mark?.[2])).toBeLessThanOrEqual(260);
  });

  it('keeps a normal-sized element at full size', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).not.toContain('background-size:');
  });
});

describe('how many of each severity', () => {
  it('counts every finding against its colour, drawn or not', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).toContain('serious — 2');
    expect(html).toContain('critical — 1');
    // The whole-page finding has no picture and is still counted.
    expect(html).toContain('moderate / minor — 1');
  });
});

describe('a picture smaller than the window', () => {
  it('centres it instead of pinning it to the corner', () => {
    const small: VisualPage = {
      ...PAGE,
      findings: [
        {
          ruleId: 'color-contrast',
          severity: 'serious',
          message: 'Contrast too low',
          selector: '.kbd',
          box: { x: 60, y: 40, w: 30, h: 20 },
          ownImage: { data: 'AAAA', mime: 'image/jpeg', w: 200, h: 120 },
        },
      ],
    };
    const html = renderVisualReport([small], { lang: 'en' });
    // 200 wide inside a 520 window leaves 160 either side; 120 tall inside 260 leaves 70.
    expect(html).toContain('background-position:160px 70px');
    expect(html).toContain('data:image/jpeg;base64,AAAA');
  });

  it('does not draw an element that its own picture failed to contain', () => {
    // A carousel that would not scroll produced pictures whose subject sat
    // outside the frame; the report must not present those as evidence.
    expect(
      isDrawable({ x: -2278, y: 24, w: 337, h: 212 }, IMAGE, '.slide', {
        data: 'AAAA',
        mime: 'image/jpeg',
        w: 766,
        h: 526,
      }),
    ).toBe(false);
  });
});

describe('getting from a finding to the live page', () => {
  it('aims at the element by its text, which browsers understand', () => {
    const withText: VisualPage = {
      ...PAGE,
      findings: [{ ...PAGE.findings[0]!, text: 'Quick  Links' }],
    };
    const html = renderVisualReport([withText], { lang: 'en' });
    expect(html).toContain('#:~:text=Quick%20Links');
  });

  it('falls back to the page itself when the element has no text', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).toContain('href="http://127.0.0.1:8099/"');
    expect(html).not.toContain('#:~:text=undefined');
  });

  it('says how many findings have no picture, rather than leaving it to be subtracted', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).toContain('No picture');
    // Four findings, two drawable, so two without.
    expect(html).toMatch(/<td class="n">4<\/td><td class="n">2<\/td><td class="n">2<\/td>/);
  });
});

describe('separating what cannot be shown from what we failed to show', () => {
  it('calls an invisible element nothing-to-show, not a failure', () => {
    expect(nothingToShow({ x: -9999, y: 10, w: 200, h: 20 }, '.skip')).toBe(true);
    expect(nothingToShow({ x: 10, y: 10, w: 0, h: 0 }, 'span')).toBe(true);
    expect(nothingToShow({ x: 0, y: 0, w: 100, h: 50 }, 'html')).toBe(true);
  });

  it('calls an element we could not reach our own limitation', () => {
    // Inside a carousel that would not scroll: real, visible, and missed.
    expect(nothingToShow({ x: 2019, y: 5088, w: 60, h: 60 }, '.slide')).toBe(false);
    expect(nothingToShow(undefined, '.gone')).toBe(false);
  });

  it('gives the two groups separate headings so one cannot hide behind the other', () => {
    const html = renderVisualReport([PAGE], { lang: 'en' });
    expect(html).toContain('nothing to show');
    expect(html).toMatch(/2 findings with nothing to show/);
  });
});
