# Release-hook operation

## Version hook

Run the gate before `changeset version` and require a pending Changesets markdown
file. A failure leaves the pending files, package versions, and changelogs
untouched. On success, Changesets may consume the pending files and generate the
release changelogs. Run `append` afterward so the accessibility summary is added
to generated output rather than overwritten by the version command.

```json
{
  "scripts": {
    "a11y:release": "changesets-ariada gate --severity-threshold serious",
    "version-packages": "npm run a11y:release -- --require-changeset && changeset version && changesets-ariada append --report .ariada/release-gate.json --changelog CHANGELOG.md"
  }
}
```

`--require-changeset` is intentionally opt-in. Changesets itself advises that not
every repository change needs a changeset, and publish jobs can run after pending
files were already consumed by a version pull request.

## Publish hook

Gate the deployed preview again immediately before `changeset publish`:

```json
{
  "scripts": {
    "release": "npm run a11y:release && changeset publish"
  }
}
```

The second scan detects a preview regression introduced between versioning and
publication. It does not require a pending changeset because a normal Changesets
version flow has already consumed those files.

## Changesets action

When using `changesets/action`, set its custom `version` command to
`npm run version-packages` and its custom `publish` command to `npm run release`.
Registry tokens belong only in the hosting platform's secret store. This package
does not read or persist registry credentials.

## Gate report

The default `.ariada/release-gate.json` includes the target, configured threshold,
Ariada semantic exit, severity counts, triggering rule IDs, and the pending
changeset filenames. It intentionally excludes environment variables, credentials,
browser paths, and arbitrary page content. The changelog line is idempotent.
