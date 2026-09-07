# Ariada Slack App

Slack app scaffold for Ariada accessibility scan requests and CI gate failure
notifications. The local package is a thin adapter over Ariada hosted scan or
CLI semantics; it does not fork scanner rules or run a separate scanner inside
Slack.

## What is Slack?

Slack is a team messaging and workflow platform. Slack apps can expose slash
commands and post structured messages into channels using Slack platform APIs.

## Why this is a separate Ariada channel

Slack reaches compliance, product, and engineering owners where release
discussion already happens. It is separate from CLI, CI, CMS, browser, and IDE
channels because the value is shared triage, notification, and audit visibility
instead of authoring-time scanning.

## Roles: who pays / what value they buy

| Role                | Value bought                                         | Likely budget                    |
|---------------------|------------------------------------------------------|----------------------------------|
| Compliance lead     | Evidence that failed releases were routed to owners. | Accessibility or legal ops.      |
| Product manager     | Fast visibility into accessibility release blockers. | Product operations.              |
| Engineering manager | Lower triage latency and a shared failure trail.     | Engineering productivity.        |

## Implemented vs not implemented

| Area                                  | Status              | Notes |
|---------------------------------------|---------------------|-------|
| `/ariada scan <url>` parsing          | Implemented locally | Returns Slack-compatible ephemeral JSON. |
| CI gate failure notification fixture  | Implemented locally | Renders Block Kit JSON from fixture data. |
| Bolt adapter scaffold                 | Implemented locally | `createAriadaSlackApp()` registers `/ariada`. |
| Slack app manifest                    | Implemented draft   | Includes slash command, bot user, and webhook scope. |
| Hosted scan API call                  | Not implemented     | Blocked until Ariada exposes hosted scan endpoint and auth. |
| Slack OAuth install / App Directory   | Not implemented     | Requires founder-owned Slack workspace, app, HTTPS handler, and review submission. |

## Competitors

Relevant competitors and substitutes include Deque axe platform and axe
Assistant, Evinced developer testing, A11y Pulse Slack/Teams alerting,
Siteimprove-style monitoring, and Pa11y CI with custom webhook notifications.

## Domains

Production should use an Ariada-controlled HTTPS endpoint such as
`https://ariada.org/slack/command` or `https://api.ariada.org/slack/command`.
The local fixture binds only to `127.0.0.1` during tests.

## Technical connectors

- Slash command: `POST /slack/command`, body text `scan https://example.com`.
- CI gate fixture: `POST /ci/gate-failure`, returns Slack Block Kit JSON.
- Bolt entrypoint: `createAriadaSlackApp({ signingSecret, botToken })`.
- Production scan execution: hosted Ariada scan API or queued CLI-backed scan job.

## Evidence

Run:

```sh
npm install --no-package-lock
npm test
npm run fixture
npm run screenshot
```

Evidence artifacts:

- `test-report/result.html`
- `scan-evidence/result.html`
- `test-report/slack-ariada-screenshot.png`

## Screenshot

The screenshot is generated from `test-report/result.html` with local headless
Chrome. Validation checks the generated PNG exists and is larger than 10 KB.

## Blockers

- Live Slack testing requires a Slack dev workspace and installed app.
- OAuth install requires Slack client credentials, signing secret, and bot token.
- Slack must call a public HTTPS handler; this local fixture is not deployable.
- Real scan execution requires the Ariada hosted scan API contract and auth model.

## Distribution

Sequence: local fixture package, private Slack workspace install, hosted beta,
then Slack App Directory submission after privacy, support, billing, and
observability are ready.

## Monetization

Slack should be part of paid hosted Ariada team plans: workspace alerts,
retained scan evidence, CI gate history, and compliance audit trails.

## Sources

- Slack Developer Docs: Implementing slash commands,
  `https://docs.slack.dev/interactivity/implementing-slash-commands/`
  (accessed 2026-07-01, primary, high reliability).
- Slack Developer Docs: Incoming webhooks,
  `https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/`
  (accessed 2026-07-01, primary, high reliability).
- Slack Developer Docs: Bolt for JavaScript quickstart,
  `https://docs.slack.dev/tools/bolt-js/getting-started/`
  (accessed 2026-07-01, primary, high reliability).
- Deque axe platform and axe Assistant,
  `https://www.deque.com/axe/` and `https://www.deque.com/axe/assistant/`
  (accessed 2026-07-01, vendor source, medium reliability).
- Evinced developer integration, `https://www.evinced.com/easy-integration`
  (accessed 2026-07-01, vendor source, medium reliability).
- A11y Pulse alerting, `https://www.a11ypulse.com/features/alerting/`
  (accessed 2026-07-01, vendor source, medium reliability).

## Update

- Author: Alexander Brichkin (Agonist Development AB)
- Date: 2026-07-01
