# Local Action E2E fixture

This directory holds a fixture workflow for invoking
`@ariada-org/diff-action` locally via [nektos/act](https://github.com/nektos/act).

```bash
act pull_request -W packages/ariada-diff-action/tests/act/workflow.yml
```

The workflow is intentionally minimal — `head-scan` and `base-scan`
point at fixture JSON files under `tests/fixtures/`; the `engine: stub`
input avoids requiring a remote API token.
