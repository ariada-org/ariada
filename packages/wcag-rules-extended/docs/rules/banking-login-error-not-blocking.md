<!--
SPDX-FileCopyrightText: 2026 Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
SPDX-License-Identifier: EUPL-1.2
-->

# banking-login-error-not-blocking

**Rule ID:** `ariada/banking/login-error-not-blocking`
**Pack:** banking
**WCAG SC:** 3.3.1 Error Identification (Level A), 2.1.2 No Keyboard Trap (Level A)
**EN 301 549 v3.2.1:** §9.3.3.1, §9.2.1.2
**EAA Annex I §:** I.4 (Banking services)
**Impact:** serious

## What this rule checks

The rule examines the login page and verifies two things at once. First, any error message produced by a failed login attempt must be announceable: it must carry `role="alert"`, `aria-live="assertive"`, or be inside a region with such an attribute, so that screen readers vocalise the message immediately. Second, no input field may become `disabled` or `readonly` after a single failed attempt — disabling inputs without a clear "unlock" path traps the user in a keyboard-unreachable state.

## Why this matters under EAA 2025

EAA Annex I §I.4 banking services must allow customers with disabilities to complete authentication without barriers. Silent error messages (visible only to sighted users) leave screen-reader users guessing why authentication failed; preemptively disabled inputs (a common pattern to "protect" against rapid-fire attacks) block keyboard-only users entirely. The WCAG hooks are 3.3.1 (errors must be identified programmatically) and 2.1.2 (focus must not be trapped).

## Pass example

```html
<form>
  <label for="user">Username <input id="user" type="text"></label>
  <label for="pw">Password <input id="pw" type="password"></label>
  <button>Sign in</button>
  <div role="alert" id="error">Incorrect password. Please try again.</div>
</form>
```

## Fail example

```html
<form>
  <label for="user">Username <input id="user" type="text" disabled></label>
  <label for="pw">Password <input id="pw" type="password" disabled></label>
  <button>Sign in</button>
  <div class="error-text">Incorrect password.</div>
</form>
```

## Implementation notes

The check scans for elements with text content matching common error patterns (`/(error|incorrect|invalid|fel|felaktig|virhe|forkert)/i`) and verifies they are inside a live region. Separately it scans login-form inputs for `disabled` or `readonly` attributes when an error region is also present on the page.

## Related

- [Rule pack INDEX](./INDEX.md)
- WCAG Understanding 3.3.1: <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
- WCAG Understanding 2.1.2: <https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html>
- EN 301 549 v3.2.1: <https://www.etsi.org/deliver/etsi_en/301500_301599/301549/03.02.01_60/en_301549v030201p.pdf>
