# Ariada GitLab CI/CD Catalog Component

This directory packages Ariada as a GitLab CI/CD Catalog component, not as the raw GitLab template from the earlier CI adapter work. Consumers include `templates/ariada.yml` as a versioned component and pass typed `spec:inputs`.

Official source checked: https://docs.gitlab.com/ci/components/ and https://docs.gitlab.com/ci/inputs/

The component is a thin wrapper over `@ariada-org/cli`. It installs the CLI, runs `ariada scan`, and publishes GitLab-rendered artifacts:

- `ariada-output/scan.json`
- `ariada-output/gl-code-quality-report.json`
- `ariada-output/junit.xml` when the downstream CLI/report step emits one

## Example

See `examples/.gitlab-ci.yml`.

## Local validation

```bash
yamllint -d relaxed templates/ariada.yml examples/.gitlab-ci.yml
node scripts/validate-component.mjs
```

## Publication blocker

Publishing to the GitLab CI/CD Catalog requires a GitLab.com or self-managed project, a release tag, and a live runner-backed pipeline. That is a founder/listing step; this package stops at validated component source and example pipeline.
