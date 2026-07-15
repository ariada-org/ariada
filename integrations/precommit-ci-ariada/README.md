# Ariada pre-commit.ci Hook

This stream packages Ariada for `pre-commit` and the hosted `pre-commit.ci` runner. It is separate from the earlier `packages/ariada-precommit` library: this directory is the hook-repository/listing surface that pre-commit.ci can execute.

Official source checked: https://pre-commit.com/

## Local validation

```bash
yamllint -d relaxed .pre-commit-hooks.yaml examples/.pre-commit-config.yaml
shellcheck scripts/ariada-precommit.sh
node scripts/validate-hooks.mjs
pre-commit validate-manifest
```

## Host blocker

pre-commit.ci activation requires installing the GitHub App on a repository. That is a founder/listing step.
