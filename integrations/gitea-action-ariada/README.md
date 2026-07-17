# Ariada Gitea/Forgejo Action

This stream packages Ariada as a Gitea/Forgejo Actions-compatible action. Gitea Actions are mostly compatible with GitHub Actions, so this action uses the composite `action.yml` shape and calls `@ariada-org/cli`.

Official source checked: https://docs.gitea.com/usage/actions/overview and https://docs.gitea.com/usage/actions/quickstart

This is a full-scan action, not a differential `@ariada-org/diff-action` execution, so no patent-binding update is made here.

## Local validation

```bash
actionlint action.yml examples/.gitea/workflows/ariada.yml
shellcheck scripts/run-ariada.sh
node scripts/validate-action.mjs
```

## Host blocker

A live run requires a Gitea or Forgejo instance with an Actions runner. That is a founder/listing step.
