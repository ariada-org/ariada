<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# audiovisual-video-has-captions-track

**Rule ID:** `ariada/audiovisual/video-has-captions-track`
**Pack:** audiovisual
**WCAG SC:** 1.2.2 Captions (Prerecorded) (Level A)
**EN 301 549 v3.2.1:** §9.1.2.2
**EAA Annex I §:** I.6 (Audiovisual media services)
**Impact:** serious

## What this rule checks

The rule inspects each `<video>` element and passes when the video carries a child `<track>` whose `kind` is `captions` or `subtitles`. Either kind satisfies the check, because both deliver synchronised timed text that lets deaf and hard-of-hearing users follow the dialogue. The `kind` value is matched case-insensitively, so `kind="CAPTIONS"` passes. A track of any other kind alone (for example `kind="chapters"` or `kind="descriptions"`) does not satisfy the check.

Two patterns are exempt and pass without needing a track: a video with `aria-hidden="true"`, which is decorative and hidden from assistive technology, and the muted background pattern (`autoplay` plus `muted` and no `controls`), which carries no speech to caption. Non-video elements such as `<audio>` are skipped entirely.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires audiovisual media services (Annex I §I.6) to be perceivable by people who cannot hear the soundtrack. Prerecorded video with speech is unusable to deaf and hard-of-hearing viewers unless the dialogue and meaningful sound are presented as captions. EN 301 549 v3.2.1 §9.1.2.2 is the harmonised-standard clause that echoes WCAG 1.2.2 (Captions, Prerecorded) for this requirement.

## Pass example

```html
<video controls>
  <track kind="captions" src="dialogue.vtt" srclang="en">
  <source src="episode.mp4">
</video>
```

## Fail example

```html
<video controls>
  <source src="episode.mp4">
</video>
```

## Implementation notes

The match function acts only on a `<video>` element; other tags are skipped. It returns the video as captionable unless the element is `aria-hidden="true"` or matches the muted-autoplay-no-controls background pattern. When the video is captionable, the check iterates its descendant `<track>` elements and passes on the first one whose lower-cased, trimmed `kind` equals `captions` or `subtitles`. A video that lists several tracks passes as long as one of them is a captions or subtitles track.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.2.2 Captions (Prerecorded): <https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html>
- HTML `track` element: <https://html.spec.whatwg.org/multipage/media.html#the-track-element>
