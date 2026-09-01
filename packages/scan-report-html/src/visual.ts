// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// A report that shows where each finding is, as one self-contained file.
//
// The overlay draws boxes on a live page. This draws the same boxes on a
// screenshot, so someone who has not installed anything can still see the
// place. The colours come from `@ariada-org/overlay`, not from a second
// palette here — two renderers, one definition of what a serious finding
// looks like.
//
// Cropping is done by offsetting a whole-page screenshot inside a fixed
// window rather than by cutting the image, so this builds on a machine with no
// native image library. Each screenshot is declared once per page and shared by
// every crop of it; embedding it per card turned six pages into sixty
// megabytes.

import { sevColor } from '@ariada-org/overlay/painters';

import { escapeHtml } from './escape.js';

/** Where an element sits on the full-page screenshot, in its pixels. */
export interface VisualBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A picture of a single element, carrying its own dimensions and encoding
 *  rather than having them guessed from its bytes. */
export interface OwnPicture {
  /** Base64, without the data-URI prefix. */
  data: string;
  /** The encoding, so the report can embed it without assuming one. */
  mime: string;
  w: number;
  h: number;
}

/** One finding, with the place on the page it is about when that is known. */
export interface VisualFinding {
  ruleId: string;
  severity: string;
  message: string;
  /** CSS selector the scan recorded, shown as the fallback when there is no box. */
  selector?: string;
  box?: VisualBox;
  /** The element's own text, used to link straight to it on the live page. */
  text?: string;
  /** A picture taken of this element on its own, for elements the whole-page
   *  capture never covered — the far end of a carousel, anything inside a
   *  container that scrolls. `box` is then in this picture's coordinates. */
  ownImage?: OwnPicture;
}

/** One scanned page: what it is called, where it is, how it looked, what was found. */
export interface VisualPage {
  /** Shown as the heading — a repository, a site, whatever the caller calls it. */
  name: string;
  url: string;
  /** Base64 picture of the whole page, PNG or JPEG — the report reads which
   *  from the bytes rather than being told. */
  screenshot: string;
  findings: VisualFinding[];
}

/** How the report is presented. Everything here has a working default. */
export interface VisualReportOptions {
  title?: string;
  /** One line under the title saying what was scanned and when. */
  subtitle?: string;
  /** Cards drawn per page. Every drawable finding by default: a report whose
   *  headline counts a finding as shown and then does not show it is lying in
   *  the one number a reader trusts. Crops share their page's screenshot, so
   *  drawing them all costs a few hundred bytes each. */
  cardsPerPage?: number;
  /** Report language, for the `lang` attribute and the built-in strings. */
  lang?: 'en' | 'ru';
}

const VIEW_W = 520;
const VIEW_H = 260;

/** Width, height and encoding, read from the picture itself.
 *
 *  The page height measured in the DOM and the height of a full-page capture
 *  are not always the same number, and using the wrong one puts a box outside
 *  its window. The file is the only reliable source — and it also says what it
 *  is, so a caller can hand over a PNG or a JPEG without having to declare
 *  which. */
export function imageSize(base64: string): { w: number; h: number; mime: string } {
  const bytes = Buffer.from(base64, 'base64');

  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89_50_4e_47) {
    return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), mime: 'image/png' };
  }

  // JPEG carries its size in a start-of-frame segment, which sits after a
  // variable number of other segments, so the segments have to be walked.
  if (bytes.length > 4 && bytes.readUInt16BE(0) === 0xff_d8) {
    let at = 2;
    while (at + 9 <= bytes.length) {
      if (bytes[at] !== 0xff) {
        at += 1;
        continue;
      }
      const marker = bytes[at + 1] ?? 0;
      const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isStartOfFrame) {
        return { h: bytes.readUInt16BE(at + 5), w: bytes.readUInt16BE(at + 7), mime: 'image/jpeg' };
      }
      at += 2 + bytes.readUInt16BE(at + 2);
    }
  }

  return { w: 0, h: 0, mime: 'application/octet-stream' };
}

/** Whether this box can be drawn on this capture.
 *
 *  Four things disqualify it, and each is a real case rather than a guard for
 *  its own sake: a box past the bottom of the capture (the page scrolls inside
 *  a container, so the element is real but was never photographed); a negative
 *  coordinate (an element parked off-canvas, which is how skip links are
 *  hidden); a zero size; and a box covering the whole document, which is what a
 *  page-level finding resolves to — outlining everything says as little as
 *  outlining nothing. */
export function isDrawable(
  box: VisualBox | undefined,
  image: { w: number; h: number },
  selector?: string,
  ownImage?: OwnPicture,
): boolean {
  if (!box) return false;
  if (box.w <= 0 || box.h <= 0) return false;
  if (/^(html|body)$/i.test((selector ?? '').trim())) return false;
  // A picture of the element alone answers for itself, but only if the element
  // is actually in it: a carousel that would not scroll produced pictures whose
  // subject sat two thousand pixels off to the left.
  const within = ownImage ? { w: ownImage.w, h: ownImage.h } : image;
  if (box.x < 0 || box.y < 0) return false;
  if (box.y + box.h > within.h || box.x + box.w > within.w) return false;
  return true;
}

/** Whether the absence of a picture is the page's doing or ours.
 *
 *  An element parked off-canvas, one with no size, and a finding about the
 *  whole document have no visible place to point at — a picture of them would
 *  be a picture of nothing. An element we could not reach is a limit of this
 *  tool. Listing both under one heading lets the second hide behind the first. */
export function nothingToShow(
  box: VisualBox | undefined,
  selector: string | undefined,
): boolean {
  if (/^(html|body)$/i.test((selector ?? '').trim())) return true;
  if (!box) return false;
  return box.x < 0 || box.y < 0 || box.w <= 0 || box.h <= 0;
}

/** Why a finding has no picture, in words the reader can act on. */
export function whyNotShown(
  box: VisualBox | undefined,
  image: { w: number; h: number },
  selector: string | undefined,
  lang: 'en' | 'ru',
): string {
  const ru = lang === 'ru';
  if (!box)
    return ru ? 'элемент не найден на странице' : 'the element was not found on the page';
  if (/^(html|body)$/i.test((selector ?? '').trim()))
    return ru
      ? 'находка о странице целиком — обводить нечего'
      : 'a finding about the whole page — there is nothing to outline';
  if (box.x < 0 || box.y < 0)
    return ru
      ? 'элемент уведён за пределы экрана'
      : 'the element is positioned off-canvas';
  if (box.w <= 0 || box.h <= 0)
    return ru ? 'у элемента нулевой размер' : 'the element has no size';
  return ru
    ? 'элемент ниже или правее снимка — страница прокручивается внутри блока'
    : 'the element lies past the capture — the page scrolls inside a container';
}

function cropHtml(
  pageIndex: number,
  image: { w: number; h: number },
  box: VisualBox,
  severity: string,
  ownImage?: OwnPicture,
): string {
  // An element larger than the window would show as a corner of an outline,
  // which tells the reader where it starts and nothing about how far it goes.
  // Scale the picture down until the whole element fits, with room around it.
  const MARGIN = 24;
  const room = { w: VIEW_W - MARGIN * 2, h: VIEW_H - MARGIN * 2 };
  const scale = Math.min(1, room.w / box.w, room.h / box.h);

  const shown = { x: box.x * scale, y: box.y * scale, w: box.w * scale, h: box.h * scale };
  const scaled = { w: image.w * scale, h: image.h * scale };

  // Centre on the element, then keep the window inside the picture. A picture
  // smaller than the window is centred in it instead — pinned to the corner it
  // read as a rendering fault rather than as a small photograph.
  const place = (
    centre: number,
    pictureSize: number,
    windowSize: number,
  ): number =>
    pictureSize <= windowSize
      ? -(windowSize - pictureSize) / 2
      : Math.max(0, Math.min(centre - windowSize / 2, pictureSize - windowSize));

  const left = place(shown.x + shown.w / 2, scaled.w, VIEW_W);
  const top = place(shown.y + shown.h / 2, scaled.h, VIEW_H);

  const colour = sevColor(severity);
  const size = scale < 1 ? `background-size:${Math.round(scaled.w)}px auto;` : '';
  // Its own picture is written into the element rather than into the shared
  // stylesheet: there is one of these per finding, not one per page.
  const own = ownImage ? `background-image:url(data:${ownImage.mime};base64,${ownImage.data});` : '';
  return [
    `<div class="crop p${pageIndex}" style="${own}${size}background-position:${-left}px ${-top}px">`,
    `<span class="mark" style="left:${shown.x - left}px;top:${shown.y - top}px;`,
    `width:${Math.max(shown.w, 4)}px;height:${Math.max(shown.h, 4)}px;border:2px solid ${colour}"></span>`,
    '</div>',
  ].join('');
}

const STRINGS = {
  en: {
    shown: (a: number, b: number) => `${a} of ${b}`,
    shownNote:
      'findings are shown in place. The rest are listed with the reason there is no picture, not dropped.',
    byPage: 'By page',
    page: 'Page',
    found: 'Findings',
    displayed: 'Shown',
    more: (n: number) => `and ${n} more shown the same way`,
    noPlace: (n: number) => `${n} findings without a picture:`,
    nothingToShow: (n: number) =>
      `${n} findings with nothing to show — the element is invisible or the finding is about the page itself:`,
    couldNotShow: (n: number) => `${n} findings this report could not reach:`,
    noPicture: 'No picture',
    openOnPage: 'Open on the page →',
    severity: 'What the colours mean',
    levels: { critical: 'critical', serious: 'serious', moderate: 'moderate', minor: 'minor' },
  },
  ru: {
    shown: (a: number, b: number) => `${a} из ${b}`,
    shownNote:
      'находок показаны на месте. Остальные перечислены с причиной, по которой картинки нет, а не отброшены.',
    byPage: 'По страницам',
    page: 'Страница',
    found: 'Находок',
    displayed: 'Показано',
    more: (n: number) => `и ещё ${n} показанных тем же способом`,
    noPlace: (n: number) => `${n} находок без картинки:`,
    nothingToShow: (n: number) =>
      `${n} находок, у которых нечего показывать — элемент невидим либо находка о самой странице:`,
    couldNotShow: (n: number) => `${n} находок, до которых отчёт не дотянулся:`,
    noPicture: 'Без картинки',
    openOnPage: 'Открыть на странице →',
    severity: 'Что означают цвета',
    levels: { critical: 'критическая', serious: 'серьёзная', moderate: 'умеренная', minor: 'незначительная' },
  },
} as const;

/** A link that opens the page and, where the element has text, scrolls to it.
 *
 *  Browsers understand a text fragment in the address; a selector in the
 *  address means nothing to them. Where there is no text to aim at, the link
 *  opens the page and the selector beside it says where to look. */
function livePageLink(url: string, finding: VisualFinding): string {
  const text = (finding.text ?? '').trim().replaceAll(/\s+/gu, ' ').slice(0, 60);
  if (!text) return url;
  return `${url}#:~:text=${encodeURIComponent(text)}`;
}

/** The colour key, with how many findings sit under each colour.
 *
 *  Levels that share a colour share a key: the palette is the overlay's, and
 *  two identical squares under different labels would read as a mistake in the
 *  report rather than as what it is. */
function renderLegend(
  measured: Array<{ page: VisualPage }>,
  t: (typeof STRINGS)['en'] | (typeof STRINGS)['ru'],
): string {
  const byColour = new Map<string, string[]>();
  for (const level of ['critical', 'serious', 'moderate', 'minor'] as const) {
    const colour = sevColor(level);
    byColour.set(colour, [...(byColour.get(colour) ?? []), t.levels[level]]);
  }

  const counted = new Map<string, number>();
  for (const m of measured) {
    for (const f of m.page.findings) {
      const key = sevColor(f.severity);
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
  }

  const keys = [...byColour].map(
    ([colour, labels]) =>
      `<span class="key"><span class="swatch" style="border-color:${colour}"></span>` +
      `${escapeHtml(labels.join(' / '))} — ${counted.get(colour) ?? 0}</span>`,
  );
  return `<section><h2>${t.severity}</h2><p class="legend">${keys.join('')}</p></section>`;
}

/** The findings with no picture, in two groups.
 *
 *  What has nothing to show and what this report could not reach are different
 *  admissions, and one heading over both lets the second hide behind the
 *  first. */
function renderMissing(
  m: { page: VisualPage; image: { w: number; h: number }; rest: VisualFinding[] },
  lang: 'en' | 'ru',
  t: (typeof STRINGS)['en'] | (typeof STRINGS)['ru'],
): string {
  const out: string[] = [];
  const groups = [
    [t.nothingToShow, m.rest.filter((f) => nothingToShow(f.box, f.selector))],
    [t.couldNotShow, m.rest.filter((f) => !nothingToShow(f.box, f.selector))],
  ] as const;

  for (const [heading, group] of groups) {
    if (group.length === 0) continue;
    out.push(`<p class="why">${heading(group.length)}</p><ul class="rest">`);
    const grouped = new Map<string, number>();
    for (const f of group) {
      const key = `${f.ruleId} — ${whyNotShown(f.box, m.image, f.selector, lang)}`;
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    for (const [key, n] of [...grouped].sort((a, b) => b[1] - a[1])) {
      const times = n > 1 ? ` × ${n}` : '';
      out.push(`<li>${escapeHtml(key)}${times}</li>`);
    }
    out.push('</ul>');
  }
  return out.join('\n');
}

/** Render the whole report as one HTML string with everything inside it. */
export function renderVisualReport(pages: VisualPage[], options: VisualReportOptions = {}): string {
  const lang = options.lang ?? 'en';
  const t = STRINGS[lang];
  const cardsPerPage = options.cardsPerPage ?? Number.POSITIVE_INFINITY;
  const title = options.title ?? (lang === 'ru' ? 'Где именно проблемы' : 'Where each finding is');

  const measured = pages.map((page) => {
    const image = imageSize(page.screenshot);
    const drawable = page.findings.filter((f) => isDrawable(f.box, image, f.selector, f.ownImage));
    const rest = page.findings.filter((f) => !isDrawable(f.box, image, f.selector, f.ownImage));
    return { page, image, drawable, rest };
  });

  const total = measured.reduce((n, m) => n + m.page.findings.length, 0);
  const shown = measured.reduce((n, m) => n + Math.min(m.drawable.length, cardsPerPage), 0);

  const backgrounds = measured
    .map((m, i) => `.crop.p${i}{background-image:url(data:${m.image.mime};base64,${m.page.screenshot})}`)
    .join('\n');

  const out: string[] = [];
  out.push(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8">`);
  out.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  out.push(`<title>${escapeHtml(title)}</title><style>`);
  out.push(`:root{color-scheme:light dark;--ink:#17202a;--muted:#5b6672;--line:#dde3ea;--bg:#f6f8fa;--card:#fff}
@media(prefers-color-scheme:dark){:root{--ink:#e8e8e8;--muted:#9aa4ae;--line:#2a3138;--bg:#0e1116;--card:#161b22}}
*,*:before,*:after{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:1.9rem;margin:0 0 .3rem}h2{font-size:1.3rem;margin:0 0 .8rem}
.lede{color:var(--muted);margin:0 0 1.6rem}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:22px;margin:0 0 20px}
.big{font-size:2.6rem;font-weight:700;line-height:1.1}
.card{display:grid;grid-template-columns:${VIEW_W}px 1fr;gap:18px;padding:16px 0;border-top:1px solid var(--line)}
@media(max-width:820px){.card{grid-template-columns:1fr}}
.crop{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:6px;background-color:#fff;background-repeat:no-repeat;width:${VIEW_W}px;height:${VIEW_H}px;max-width:100%}
.crop .mark{position:absolute;border-radius:3px;box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.rule{font:13px ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--line);padding:.1em .4em;border-radius:3px}
.sev{font-size:.78rem;padding:.15em .6em;border-radius:999px;color:#000;font-weight:600}
.why{color:var(--muted);font-size:.92rem;border-left:3px solid var(--line);padding-left:12px;margin:.4rem 0}
table{border-collapse:collapse;width:100%;font-size:.94rem}
th,td{border-bottom:1px solid var(--line);padding:.45rem .6rem;text-align:left}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
ul.rest{margin:.4rem 0 0;padding-left:1.1rem;color:var(--muted);font-size:.92rem}
.legend{display:flex;flex-wrap:wrap;gap:18px;margin:0}
.key{display:flex;align-items:center;gap:8px;font-size:.94rem}
.swatch{width:22px;height:14px;border:2px solid;border-radius:3px;display:inline-block}
a{color:inherit}
a.open{font-size:.9rem;color:#0969da;text-decoration:none;border-bottom:1px solid currentColor}
@media(prefers-color-scheme:dark){a.open{color:#58a6ff}}`);
  out.push(backgrounds);
  out.push('</style></head><body><main>');
  out.push(`<h1>${escapeHtml(title)}</h1>`);
  if (options.subtitle) out.push(`<p class="lede">${escapeHtml(options.subtitle)}</p>`);

  out.push(`<section><div class="big">${t.shown(shown, total)}</div><p>${t.shownNote}</p></section>`);

  out.push(renderLegend(measured, t));

  out.push(`<section><h2>${t.byPage}</h2><table><thead><tr>`);
  out.push(
    `<th scope="col">${t.page}</th><th scope="col" class="n">${t.found}</th>` +
      `<th scope="col" class="n">${t.displayed}</th><th scope="col" class="n">${t.noPicture}</th>`,
  );
  out.push('</tr></thead><tbody>');
  for (const [i, m] of measured.entries()) {
    out.push(
      `<tr><td><a href="#page-${i}"><span class="rule">${escapeHtml(m.page.name)}</span></a></td>` +
        `<td class="n">${m.page.findings.length}</td>` +
        `<td class="n">${Math.min(m.drawable.length, cardsPerPage)}</td>` +
        `<td class="n">${m.page.findings.length - Math.min(m.drawable.length, cardsPerPage)}</td></tr>`,
    );
  }
  out.push('</tbody></table></section>');

  for (const [i, m] of measured.entries()) {
    out.push(`<section id="page-${i}"><h2>${escapeHtml(m.page.name)} — ${m.page.findings.length} ${t.found.toLowerCase()}</h2>`);
    out.push(`<p class="lede"><a href="${escapeHtml(m.page.url)}">${escapeHtml(m.page.url)}</a></p>`);
    for (const f of m.drawable.slice(0, cardsPerPage)) {
      const colour = sevColor(f.severity);
      out.push('<div class="card">');
      // The picture's own size, carried with it, rather than the page capture's.
      const size = f.ownImage ? { w: f.ownImage.w, h: f.ownImage.h } : m.image;
      out.push(cropHtml(i, size, f.box as VisualBox, f.severity, f.ownImage));
      out.push('<div>');
      out.push(
        `<p><span class="rule">${escapeHtml(f.ruleId)}</span> ` +
          `<span class="sev" style="background:${colour}">${escapeHtml(f.severity)}</span></p>`,
      );
      out.push(`<p>${escapeHtml(f.message)}</p>`);
      if (f.selector) out.push(`<p class="why">${escapeHtml(f.selector)}</p>`);
      out.push(
        `<p><a class="open" href="${escapeHtml(livePageLink(m.page.url, f))}">${t.openOnPage}</a></p>`,
      );
      out.push('</div></div>');
    }
    if (m.drawable.length > cardsPerPage) {
      out.push(`<p class="why">${t.more(m.drawable.length - cardsPerPage)}</p>`);
    }
    out.push(renderMissing(m, lang, t));
    out.push('</section>');
  }

  out.push('</main></body></html>');
  return out.join('\n');
}
