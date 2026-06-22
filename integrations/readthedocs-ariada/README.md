# Ariada Read the Docs Build Integration

This stream adds a Read the Docs `build.jobs.post_build` wrapper that runs Ariada after documentation HTML is generated. The wrapper is a thin `@ariada-org/cli` launcher and does not implement scan logic.

Official source checked: https://docs.readthedocs.com/platform/stable/config-file/v2.html and https://docs.readthedocs.com/platform/stable/build-customization.html

## Local validation

```bash
yamllint -d relaxed examples/.readthedocs.yaml
shellcheck scripts/post-build.sh
node scripts/validate-readthedocs.mjs
READTHEDOCS_OUTPUT=fixtures/_readthedocs/html ARIADA_REPORT_DIR=ariada-output ./scripts/post-build.sh
```

## Host blocker

A live Read the Docs build requires an RTD project and a connected repository. That is a founder/listing step.
