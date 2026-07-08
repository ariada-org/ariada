# Ariada mdBook Integration

This integration keeps mdBook scanning as a thin adapter over `@ariada-org/cli`.
mdBook preprocessors run before HTML is rendered, so accessibility scanning happens
after `mdbook build` against the generated `book/` HTML.

Protocol reference: https://rust-lang.github.io/mdBook/for_developers/preprocessors.html

The `mdbook-ariada` binary has two roles:

- `mdbook-ariada scan --book-dir book --output-dir ariada-output` finds rendered
  HTML files and invokes `@ariada-org/cli scan` on their `file://` URLs.
- When configured as `[preprocessor.ariada]`, it implements the mdBook
  `supports <renderer>` handshake and otherwise passes the book JSON through
  unchanged.

## CI Usage

```bash
mdbook build
npx --yes mdbook-ariada scan \
  --book-dir book \
  --output-dir ariada-output \
  --output-file ariada-output/result.html \
  --severity-threshold serious \
  --format html \
  --domains accessibility
```

Environment variables mirror those flags:

- `ARIADA_MDBOOK_BOOK_DIR` defaults to `book`
- `ARIADA_REPORT_DIR` defaults to `ariada-output`
- `ARIADA_REPORT_FILE` sets the HTML output path
- `ARIADA_FAIL_ON_SEVERITY` defaults to `serious`
- `ARIADA_DOMAINS` can narrow scanning, for example `accessibility`
- `ARIADA_CLI_BIN` overrides the scanner executable, otherwise `npx --yes @ariada-org/cli` is used

## Optional Preprocessor Stub

```toml
[preprocessor.ariada]
command = "npx --yes mdbook-ariada"
```

The preprocessor does not scan or parse HTML. It only confirms support for the
`html` renderer and returns mdBook's book payload unchanged.

## Local Validation

```bash
npm run lint
npm test
npm run test:integration
```

If `mdbook` is not installed, `npm run test:integration` reports a blocked host
tool instead of claiming end-to-end coverage.
