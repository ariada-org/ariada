<!--
SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# audiovisual-media-element-has-accessible-name

**Rule ID:** `ariada/audiovisual/media-element-has-accessible-name`
**Pack:** audiovisual
**WCAG SC:** 4.1.2 Name, Role, Value (Level A)
**EN 301 549 v3.2.1:** §9.4.1.2
**EAA Annex I §:** I.6 (Audiovisual media services)
**Impact:** serious

## What this rule checks

The rule inspects each `<video controls>` and `<audio controls>` element — a media player that exposes an interactive control set — and passes when the player has a non-empty accessible name. The name lets a screen-reader user tell which media a player belongs to (for example "Episode 4 audio" or "Product demo video") rather than hearing only the bare role. A player that exposes controls but has no name fails.

The check derives the name from the computed accessible name first, then falls back in order to the `title` attribute, the `aria-label` attribute, and finally the concatenated text of the elements referenced by `aria-labelledby`. A media element without a `controls` attribute is not an exposed player and is skipped.

## Why this matters under EAA 2025

The EAA (European Accessibility Act, Directive (EU) 2019/882) requires audiovisual media services (Annex I §I.6) to expose their user-interface components with a name, role, and value that assistive technology can read. A page may carry several players; without distinguishing names a screen-reader user hears a row of identical "media" controls and cannot choose the right one. EN 301 549 v3.2.1 §9.4.1.2 is the harmonised-standard clause that echoes WCAG 4.1.2 (Name, Role, Value).

## Pass example

```html
<video controls aria-label="Product demo video">
  <source src="demo.mp4">
</video>
```

## Fail example

```html
<video controls>
  <source src="demo.mp4">
</video>
```

## Implementation notes

The match function acts only on a `<video>` or `<audio>` element that has the `controls` attribute. The check computes a name via the package's lightweight accessible-name helper; if that is empty it tries `title`, then `aria-label`, then `aria-labelledby` (splitting the value on whitespace into ID tokens, resolving each via `getElementById`, and joining the trimmed text of the resolved elements). The element passes when the resulting name has length greater than zero.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 4.1.2 Name, Role, Value: <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
