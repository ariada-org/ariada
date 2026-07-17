# Ariada Microsoft Teams App

Teams app scaffold for surfacing Ariada accessibility scan results in a channel.
It does not run a scanner inside Teams. CI or a user command provides Ariada CLI
JSON, and this app renders that result as an Adaptive Card.

## What It Does

- Parses `/ariada scan <url>`-style text into a scan request.
- Renders Ariada CLI JSON as an Adaptive Card with pass/fail status, totals, top
  findings, and a report link.
- Provides a mock command handler that can be wired to Bot Framework activity
  handlers after Azure Bot registration exists.

## Local Gates

```sh
npm test
npm run typecheck
```

## Live-Host Blocker

Blocked: a real Teams app requires Azure Bot registration, a public HTTPS bot
endpoint, Teams app manifest upload, and Teams Admin/AppSource approval.

Owner: founder. Next action: create the Azure Bot + Teams app registration and
provide the app id, bot id, tenant policy, and HTTPS endpoint.
