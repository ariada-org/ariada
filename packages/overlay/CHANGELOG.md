# @ariada-org/overlay

## 0.2.0

### Minor Changes

- 8bd4173: Show where each finding is

  `renderVisualReport` draws the boxes the overlay draws, on a screenshot of the
  page, as one self-contained file. The colours come from `@ariada-org/overlay`
  rather than a second palette, so the two renderers cannot disagree about what
  a serious finding looks like.

  A finding the page capture could not hold carries its own picture. A finding
  with no picture is listed with the reason, and the reasons are separated into
  what has nothing to show and what the report could not reach.
