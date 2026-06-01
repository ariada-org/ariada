<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# audiovisual-video-has-audio-description-track

**Rule ID:** `ariada/audiovisual/video-has-audio-description-track`
**Pack:** audiovisual
**WCAG SC:** 1.2.5 Audio Description (Prerecorded) (Level AA)
**EN 301 549 v3.2.1:** §9.1.2.5
**EAA Annex I §:** I.6 (Audiovisual media services)
**Impact:** moderate

## What this rule checks

The rule inspects each `<video>` element and passes when the visual information is available to viewers who cannot see it. It accepts two mechanisms: a child `<track>` whose `kind` is `descriptions` (the native audio-description channel), or an `aria-describedby` reference that resolves to at least one element with non-empty text, which stands in for an on-page transcript or description. The `kind` value is matched case-insensitively. If neither mechanism is present the check fails.

The same two exemptions as the captions rule apply: a video with `aria-hidden="true"` is decorative and skipped, and the muted background pattern (`autoplay` plus `muted` and no `controls`) carries no information to describe. Non-video elements are skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires audiovisual media services (Annex I §I.6) to convey visual information to blind and low-vision viewers. When a video shows something the soundtrack does not state — on-screen text, an action, a setting — a viewer who cannot see it misses that content unless an audio description or an equivalent text alternative supplies it. EN 301 549 v3.2.1 §9.1.2.5 is the harmonised-standard clause that echoes WCAG 1.2.5 (Audio Description, Prerecorded).

## Pass example

```html
<video controls>
  <track kind="descriptions" src="audio-description.vtt" srclang="en">
  <source src="demo.mp4">
</video>
```

## Fail example

```html
<video controls>
  <track kind="captions" src="dialogue.vtt" srclang="en">
  <source src="demo.mp4">
</video>
```

## Implementation notes

The match function acts only on a captionable `<video>`, applying the same `aria-hidden` and muted-background exemptions. The check first iterates the descendant `<track>` elements and passes on the first one whose lower-cased, trimmed `kind` equals `descriptions`. If no descriptions track exists it reads `aria-describedby`, splits it on whitespace into ID tokens, resolves each via `getElementById`, and passes if any referenced element has non-empty trimmed text content. A captions-only video fails this rule because captions do not describe the visuals.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.2.5 Audio Description (Prerecorded): <https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html>
- HTML `track` element: <https://html.spec.whatwg.org/multipage/media.html#the-track-element>
