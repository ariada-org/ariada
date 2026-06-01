<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# ebooks-audio-control-on-autoplay

**Rule ID:** `ariada/ebooks/audio-control-on-autoplay`
**Pack:** ebooks
**WCAG SC:** 1.4.2 Audio Control (Level A)
**EN 301 549 v3.2.1:** §9.1.4.2
**EAA Annex I §:** I.5 (E-books and dedicated software)
**Impact:** serious

## What this rule checks

The rule inspects `<audio>` and `<video>` elements that carry the `autoplay` attribute. WCAG 1.4.2 requires a mechanism to pause or stop any sound that plays automatically for more than three seconds without the user starting it. The check passes an autoplaying element when it either exposes the native `controls` UI (giving the user an in-page stop control) or is `muted` (producing no sound at all). An autoplaying element with neither `controls` nor `muted` fails. Media without `autoplay` is skipped entirely, as is any non-media element that happens to carry an `autoplay` attribute.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) covers read-aloud e-books and dedicated reading software (Annex I §I.5), which frequently embed narration or ambient audio that begins on load. Unexpected sound interferes with screen-reader speech and is disorienting for users with cognitive disabilities; if it cannot be stopped, the whole reading session is affected. EN 301 549 v3.2.1 §9.1.4.2 is the harmonised-standard clause that echoes WCAG 1.4.2 (Audio Control).

## Pass example

```html
<audio src="chapter-01.mp3" autoplay controls></audio>
```

## Fail example

```html
<audio src="chapter-01.mp3" autoplay></audio>
```

## Implementation notes

The check matches only `audio` and `video` tags that have the `autoplay` attribute. Either `muted` or `controls` satisfies the rule, and an element carrying both passes. The common hero pattern of an autoplaying muted background video passes because a muted element makes no sound. The rule does not attempt to measure clip duration; it treats the presence of a stop mechanism (controls) or the absence of sound (muted) as the requirement, in line with how WCAG 1.4.2 is automated.

This is static markup analysis: the check reads the `muted` and `controls` content attributes as authored. A page that ships `autoplay muted` in HTML but un-mutes the element later through script is out of scope for a static check — that dynamic case needs runtime or manual testing.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 1.4.2 Audio Control: <https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html>
