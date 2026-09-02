# Security and data handling

- The remote accepts scans only with a valid Atlassian-signed Forge Invocation Token whose audience/app ID matches `FORGE_APP_ID` and whose context is `confluence:contentAction`.
- The Confluence page ID comes from signed FIT context, never from caller JSON.
- The opaque `x-forge-oauth-user` token is used only as a Bearer token to the signed `app.apiBaseUrl`; it is never decoded, logged, returned, or stored.
- Commercial Cloud API routing is allowlisted to `https://api.atlassian.com`.
- The invoking user's `read:page:confluence` permission controls page access.
- Rendered page HTML is capped at 5 MiB, held in memory, served only on `127.0.0.1`, and discarded after the scan.
- The loopback exception is injected only into the real core Playwright scan for that ephemeral local URL. Arbitrary private-network targets are not accepted.
- Remote requests are capped at 16 KiB. Responses and local HTML use `no-store`; scripts in exported page HTML are disabled by CSP.
- The implementation has no database, queue, analytics endpoint, token cache, or report retention.
- The tarball has no lifecycle installer and contains no browser binary. Production operators provision a Playwright 1.60.0-compatible browser independently.

Forge Remote moves rendered page content outside Atlassian for transient compute and may affect "Runs on Atlassian" and data-residency representations. Marketplace disclosures must state that boundary accurately.
