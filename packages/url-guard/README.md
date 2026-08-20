<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# @ariada-org/url-guard

Shared server-side request-forgery (SSRF) guard for every place the scanner
fetches a user-supplied URL. It rejects non-`http(s)` schemes, resolves the
hostname to all of its addresses, and refuses the request if any resolved
address is loopback, private (RFC 1918), link-local, unique-local, carrier-grade
NAT, or otherwise reserved — including the IPv4-mapped IPv6 form
(`::ffff:a.b.c.d`) that a naive prefix check misses. It returns the validated
address so the caller can pin the connection and close DNS-rebinding.

## Install

```sh
pnpm add @ariada-org/url-guard
```

## Usage

```ts
import { resolveAndGuard, guardRedirect } from '@ariada-org/url-guard';

const guarded = await resolveAndGuard(userUrl);
if (guarded.isErr()) {
  // guarded.error.kind: 'scheme_not_allowed' | 'private_literal'
  //   | 'private_resolved' | 'resolution_failed' | 'unparseable'
  throw new Error(`refused: ${guarded.error.kind}`);
}
// guarded.value.url          — the validated URL
// guarded.value.pinnedAddress — pin the socket to this IP before fetching

// On each redirect hop, re-check the Location header:
const next = await guardRedirect(locationHeader, currentUrl);
```

`assertSafeUrl` is the synchronous scheme + IP-literal check (no DNS);
`resolveAndGuard` adds hostname resolution and returns the pinned address;
`guardRedirect` resolves a relative `Location` against its base and re-guards it.

## Options

- `allowPrivate` — when `true`, private/loopback destinations are allowed (for a
  CLI `--allow-private` opt-in or local development). Defaults to `false`.

## Ranges refused by default

Loopback, private and link-local IPv4: `127.0.0.0/8`, `10/8`, `172.16/12`,
`192.168/16`, `169.254/16`, the carrier range `100.64/10`, and `0.0.0.0/8`.

Loopback, unspecified, unique-local and link-local IPv6: `::1`, `::`,
`fc00::/7`, `fe80::/10` — recognised by the address rather than by how it was
written, so an expanded or zone-suffixed spelling is the same address.

An IPv4 address carried inside an IPv6 one, in every notation that can carry
it: `::ffff:a.b.c.d` and its hexadecimal form, `::ffff:0:a.b.c.d`,
`64:ff9b::a.b.c.d`, `2002:a.b.c.d::`, and `::a.b.c.d`. The translation prefix
is the one that matters in practice — on a host with no IPv4 at all, it is how
an IPv4-only address is still reached.

Hostnames that resolve into any of the above, and any redirect target, are
checked the same way.

## License

EUPL-1.2. Copyright Agonist Development AB. See `LICENSE`.
