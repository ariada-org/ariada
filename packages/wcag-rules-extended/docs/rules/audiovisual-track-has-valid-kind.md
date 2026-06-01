<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# audiovisual-track-has-valid-kind

**Rule ID:** `ariada/audiovisual/track-has-valid-kind`
**Pack:** audiovisual
**WCAG SC:** 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.4.1.2
**EAA Annex I §:** I.6 (Audiovisual media services)
**Impact:** minor

## What this rule checks

The rule inspects each `<track>` element and passes when its `kind` is one of the values the HTML specification defines: `subtitles`, `captions`, `descriptions`, `chapters`, or `metadata`. A misspelled or invented kind such as `kind="caption"` fails, because browsers silently treat an unknown kind as `metadata`, so the intended timed text never reaches assistive technology. The value is matched case-insensitively and trimmed.

A `<track>` with no `kind` attribute defaults to `subtitles` per the HTML specification, so it is treated as subtitles. Subtitles — whether explicit or defaulted — additionally require a non-empty `srclang`; a subtitles track without `srclang` fails, while the other kinds do not need one.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires audiovisual media services (Annex I §I.6) to expose their components correctly to assistive technology. The `kind` of a `<track>` is the value that tells the player and the user agent what the timed text is for. An invalid kind makes the track inert, so captions or descriptions that authors believe they shipped never appear. EN 301 549 v3.2.1 §9.4.1.2 is the harmonised-standard clause that echoes WCAG 4.1.2 (Name, Role, Value).

## Pass example

```html
<video controls>
  <track kind="subtitles" src="subs.vtt" srclang="sv">
  <source src="film.mp4">
</video>
```

## Fail example

```html
<video controls>
  <track kind="caption" src="subs.vtt" srclang="sv">
  <source src="film.mp4">
</video>
```

## Implementation notes

The match function acts only on a `<track>` element. The check reads the raw `kind`; when it is absent the value defaults to `subtitles`, otherwise it is trimmed and lower-cased. The kind must be a member of the set `{subtitles, captions, descriptions, chapters, metadata}` or the check fails. When the kind resolves to `subtitles` (including the defaulted case), the trimmed `srclang` must be non-empty, otherwise the check fails. A BCP-47 language tag such as `sv` or `en-GB` is the expected `srclang` value, though the rule only checks that it is present and non-empty.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 4.1.2 Name, Role, Value: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- HTML `track` element: <https://html.spec.whatwg.org/multipage/media.html#the-track-element>
