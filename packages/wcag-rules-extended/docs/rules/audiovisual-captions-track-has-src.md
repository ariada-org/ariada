<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# audiovisual-captions-track-has-src

**Rule ID:** `ariada/audiovisual/captions-track-has-src`
**Pack:** audiovisual
**WCAG SC:** 1.2.2 Captions (Prerecorded) (Level A)
**EN 301 549 v3.2.1:** §9.1.2.2
**EAA Annex I §:** I.6 (Audiovisual media services)
**Impact:** serious

## What this rule checks

The rule inspects each caption or subtitle `<track>` and passes when its `src` attribute points at a real timed-text resource — that is, when `src` is present and non-empty after trimming. A captions track with no `src`, or an empty `src`, loads nothing: the player still exposes a caption control, so the media appears to offer captions while presenting none, which is worse than declaring no track at all.

The rule only matches tracks whose `kind` is `captions` or `subtitles`. A `<track>` with no `kind` attribute defaults to `subtitles` per the HTML specification, so it is covered too. Tracks of other kinds (for example `descriptions` or `chapters`) are skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires audiovisual media services (Annex I §I.6) to make prerecorded video usable by deaf and hard-of-hearing viewers. A caption track that resolves to nothing gives a false signal: the player shows a captions option that produces no text when activated. EN 301 549 v3.2.1 §9.1.2.2 is the harmonised-standard clause that echoes WCAG 1.2.2 (Captions, Prerecorded).

## Pass example

```html
<video controls>
  <track kind="captions" src="captions.vtt" srclang="en">
  <source src="lecture.mp4">
</video>
```

## Fail example

```html
<video controls>
  <track kind="captions" srclang="en">
  <source src="lecture.mp4">
</video>
```

## Implementation notes

The match function acts only on a `<track>` whose resolved kind is `captions` or `subtitles`, where an absent `kind` defaults to `subtitles`. The check reads `src`, trims it, and passes when the result has length greater than zero. The rule does not fetch or validate the referenced file; it only verifies that a non-empty `src` is declared, so the caption control is wired to a resource. The WebVTT (Web Video Text Tracks, `.vtt`) format is the conventional target.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.2.2 Captions (Prerecorded): <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>
- HTML `track` element: <https://html.spec.whatwg.org/multipage/media.html#the-track-element>
