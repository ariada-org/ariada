# Ariada Bitbucket Pipe

This is the standalone, listing-grade Bitbucket Pipe. It is distinct from the earlier raw CI adapter: this directory contains the marketplace pipe layout (`Dockerfile`, `pipe.yml`, runner, and example pipeline).

Official source checked: https://support.atlassian.com/bitbucket-cloud/docs/write-a-pipe-for-bitbucket-pipelines/

The Pipe installs and runs `@ariada-org/cli`; it does not implement scan logic.

## Local validation

```bash
yamllint -d relaxed pipe.yml bitbucket-pipelines.yml
shellcheck pipe/run.sh
node scripts/validate-pipe.mjs
docker build -t ariada-bitbucket-pipe:test .
```

## Publication blocker

Docker build requires a working Docker daemon. Publishing to the Bitbucket Pipes marketplace is a founder/listing step.
