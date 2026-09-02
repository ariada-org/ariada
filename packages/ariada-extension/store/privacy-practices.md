<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: EUPL-1.2 -->

# Chrome Web Store — Privacy practices tab

Copy each block into the matching field. Every statement below was checked
against the code on 2026-08-02; nothing here is aspirational.

---

## Single purpose description

> Ariada checks the page you are looking at against published accessibility and
> compliance requirements — WCAG 2.2, EN 301 549 and the European Accessibility
> Act — and shows what fails, where it is on the page, and which requirement it
> breaks. Everything runs inside the browser: the page is read in place and no
> part of it is sent anywhere.

---

## Permission justifications

### `activeTab`

> The extension examines the page the user is looking at, and only when the user
> asks. Opening the side panel and pressing Scan is the action that grants
> access to that one tab; nothing runs on any other tab, and the extension has
> no standing access to browsing history or to tabs the user has not acted on.
> This is the narrowest permission that allows a scan of the current page, which
> is the extension's only function.

### `scripting`

> The check has to run inside the page, because what matters is the rendered
> result — the accessibility tree the browser builds, computed styles, the
> contrast a reader actually sees. None of that is visible from outside the
> page. `chrome.scripting.executeScript` injects the analysis into the tab the
> user chose to scan, at the moment they press Scan, and it is removed when the
> tab is closed. There is no static content script and no injection into tabs
> the user has not acted on.

### `storage`

> `chrome.storage.local` holds the user's own settings: which requirement
> domains they have selected, and any additional rule modules they have added
> themselves. It is a few kilobytes of preferences on the user's own machine.
> No scan results, no page content, and no identifiers are stored, and nothing
> in this storage is synchronised or transmitted.

### `sidePanel`

> The findings are shown in Chrome's side panel, next to the page they are
> about. The panel is the extension's entire interface: the list of findings,
> the controls for showing them on the page, and the conformance report. A
> pop-up would close on every click into the page, and reading a finding
> requires looking at the page it refers to.

### Host permission (`<all_urls>`, optional)

> Requested only when the user starts a scan, and only for the site being
> scanned — it is declared as an optional host permission, so Chrome asks the
> user at that moment rather than at install. It is needed because an
> accessibility check must read the page it is checking. It is not requested at
> install time, and the extension does nothing on sites the user has not asked
> it to scan.

---

## Remote code

Answer: **No, I am not using remote code.**

> All code is contained in the package. Nothing is fetched, evaluated or
> imported at runtime: the extension makes no network requests of any kind —
> there is no `fetch`, no `XMLHttpRequest`, no `WebSocket`, no `eval` and no
> dynamic import anywhere in it. The only external addresses in the package are
> links to the published W3C specifications, which open in a normal tab when the
> user clicks a requirement.

---

## Data usage

The three certifications can all be affirmed, and the data-collection section
should be left with nothing selected:

- **Not being sold to third parties** — true; nothing is collected, so there is
  nothing to sell.
- **Not being used or transferred for purposes unrelated to the single purpose**
  — true; nothing leaves the browser.
- **Not being used or transferred to determine creditworthiness or for lending**
  — true.

For "What user data do you plan to collect": select **nothing**. The extension
collects no personally identifiable information, no health information, no
financial information, no authentication information, no personal
communications, no location, no web history, and no user activity. Scan results
exist in the panel while it is open and are written to a file only when the
user chooses to save a report.

If a field requires a positive statement rather than an empty selection:

> This extension collects no user data. Page content is read in the page, in the
> browser, to produce the findings shown in the panel, and is never transmitted
> or stored. The extension makes no network requests.

---

## Privacy policy URL

<https://ariada.org/privacy>

The listing requires a reachable privacy-policy page; confirm that address
serves one before submitting.

---

## Checked against the code, 2026-08-02

| Claim | How it was checked |
|---|---|
| Four permissions, no more | `dist/manifest.json` `permissions` |
| Host access is optional | `optional_host_permissions`, requested at scan time |
| No remote code | no `fetch` / `XMLHttpRequest` / `WebSocket` / `eval` / dynamic import in `src/` or `dist/` |
| No network at all | same search; only external strings are W3C document links and the SVG namespace |
| Storage holds settings only | `src/lib/module-registry.ts` — user-added modules and domain selection |
