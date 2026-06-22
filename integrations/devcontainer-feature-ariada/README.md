# Ariada Devcontainer Feature

This is a GitHub Codespaces / Dev Containers Feature that installs `@ariada-org/cli` in a development container. It is packaging only; scanning remains in the published CLI.

Official source checked: https://devcontainers.github.io/implementors/features/ and https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/configuring-dev-containers/adding-features-to-a-devcontainer-file

## Consumer snippet

```json
{
  "features": {
    "ghcr.io/ariada-org/devcontainer-features/ariada:0.1.0": {
      "installPlaywright": true
    }
  },
  "postCreateCommand": "ariada version"
}
```

## Local validation

```bash
shellcheck src/ariada/install.sh
node scripts/validate-feature.mjs
devcontainer features test -f ariada .
```

## Publication blocker

Publishing to `ghcr.io` and running `devcontainer features test` requires Docker plus registry authentication. That is a founder/listing step in this workspace.
