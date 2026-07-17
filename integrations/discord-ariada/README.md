# Ariada Discord Bot

Discord bot scaffold for posting Ariada accessibility gate results. It does not
host scan logic. A slash command or CI webhook provides an Ariada CLI result and
the bot renders that result as a Discord embed.

## What It Does

- Defines `/ariada scan` command registration JSON.
- Renders Ariada CLI JSON as a Discord embed.
- Handles a CI webhook payload in a pure function for local testing.

## Local Gates

```sh
npm test
npm run typecheck
```

## Live-Host Blocker

Blocked: live Discord delivery requires a Discord application, bot token,
gateway connection, and installation into a guild.

Owner: founder. Next action: create the Discord application, provide bot token
via deployment secrets, and install the bot in the review guild.
