---
"@ariada-org/cli": patch
---

The help text says what the rules reach instead of claiming the whole standard.

It described the accessibility scan as the "full WCAG 2.2 AA rule set". The
registered rules reference 23 of the 55 success criteria in WCAG 2.2 AA — a
reasonable number, since most of the rest cannot be judged by a machine at all,
but not the whole standard. It now says the automatable part and points at
`list-rules`, which answers the question exactly.
