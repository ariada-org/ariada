# Ariada Zola Integration

`integrations/zola-ariada` is a thin post-build bridge for Zola sites. It does
not parse HTML, implement WCAG rules, or replace `@ariada-org/cli`; it only
serves Zola's built `public/` output and invokes the shared Ariada scanner.

## Intended workflow

```sh
zola build
npx zola-ariada --target-dir public --output-dir ariada-output
```

The wrapper calls:

```sh
npx -y @ariada-org/cli scan <local-preview-url> --format both --output-dir ariada-output
```

and maps the shared CLI result to a release-gate exit code.

## CI snippet

```yaml
- name: Build Zola site
  run: zola build

- name: Scan rendered output with Ariada
  run: npx zola-ariada --target-dir public --output-dir ariada-output

- name: Upload Ariada evidence
  uses: actions/upload-artifact@v4
  with:
    name: ariada-zola-evidence
    path: ariada-output
```

## Local validation

This runner does not have the `zola` binary installed, so the true host build
gate is blocked locally. The channel still includes a minimal Zola source
fixture under `examples/site`, a rendered `public/`-style fixture under
`examples/rendered-public`, unit/e2e tests for wrapper behavior, and a generated
scan-evidence report.

Run the locally available gates:

```sh
cd integrations/zola-ariada
pnpm lint
pnpm typecheck
pnpm test
node scripts/build-evidence.mjs
node scripts/capture-screenshot.mjs
```

When Zola is installed, add:

```sh
zola --root examples/site build --output-dir ../../scan-evidence/public
node src/index.mjs --target-dir scan-evidence/public --output-dir scan-evidence/ariada-output
```

Evidence artifacts are stored under `scan-evidence/`, including
`scan-evidence/result.html`.
