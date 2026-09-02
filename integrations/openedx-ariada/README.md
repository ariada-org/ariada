# Ariada for Open edX

`openedx-ariada` is an Open edX XBlock for course authors and staff. It runs the
real `@ariada-org/cli@0.1.0` scanner against a rendered course or unit URL and
shows impact counts, WCAG criteria, EN 301 549 references, top findings, and a
staff-only full report.

The Python wheel contains a pre-packed npm runtime artifact. Tutor does not run
`npm install`, lifecycle scripts, or a browser installer. Node 22 and a
compatible installed Chrome/Chromium executable are host prerequisites.

## Architecture

- `xblock.v1`: `ariada = openedx_ariada.xblock:AriadaXBlock`
- `tutor.plugin.v1`: registers the `openedx-ariada` source mount with Tutor 21
- Python scanner: validates an administrator-owned host allowlist, starts a
  bounded child process without a shell, and strictly parses `cli-scan.v1`
- Runtime: exact-version bundled `@ariada-org/cli`, core, core Playwright
  adapter, `@ariada-org/rules-axe`, Playwright, axe-core, and transitive runtime
  closure
- Report storage: per-staff-user XBlock state; no report is shown to learners

The wrapper does not implement accessibility rules. It presents the existing
Ariada scanner output.

## Open edX installation

Build and install the wheel in the same Python environment as `edx-platform`:

```sh
python -m build
pip install dist/openedx_ariada-0.1.0-py3-none-any.whl
```

Add `ariada` to the course's Advanced Module List, add the component to a unit,
and open the unit as course staff. Learners receive an empty fragment.

Configure the scanner process in both LMS and CMS containers:

```sh
export OPENEDX_ARIADA_ALLOWED_HOSTS="courses.example.edu"
export OPENEDX_ARIADA_BROWSER_CHANNEL="chrome"
export OPENEDX_ARIADA_NODE="/usr/bin/node"
```

`OPENEDX_ARIADA_ALLOWED_HOSTS` is mandatory unless Tutor already exports
`LMS_HOST`. Targets must match exactly. URL credentials are rejected. The
Ariada core guard independently rejects loopback, private, link-local, and
reserved destinations.

Private courses require an externally provisioned Playwright storage-state JSON
file for a least-privileged Open edX staff account:

```sh
export OPENEDX_ARIADA_STORAGE_STATE="/run/secrets/openedx-ariada-storage-state.json"
```

The file is not part of this package and its contents are never logged. Rotate
it as an authentication secret. Do not place usernames, passwords, session
cookies, or tokens in package configuration.

For a private-address Tutor sandbox only, set an exact allowlist and explicitly
enable private routing:

```sh
export OPENEDX_ARIADA_ALLOWED_HOSTS="local.openedx.io"
export OPENEDX_ARIADA_ALLOW_PRIVATE="1"
```

The private-routing switch is refused when the allowlist is empty.

## Tutor 21 sandbox path

Tutor's documented mounted-directory flow can install the local package into
the Open edX image:

```sh
python -m pip install -e '.[tutor]'
tutor plugins enable openedx-ariada
tutor mounts add "$PWD"
tutor images build openedx
tutor local launch
```

For a non-editable image, copy this source tree into
`$(tutor config printroot)/env/build/openedx/requirements/openedx-ariada`, add
`-e ./openedx-ariada` to `requirements/private.txt`, and rebuild `openedx`.
This follows Tutor's official XBlock/package development path.

The image must separately provide Node 22 and Chrome/Chromium. This repository
does not run `playwright install` or download a browser. See
[`docs/tutor-sandbox.md`](docs/tutor-sandbox.md) for the live checklist.

## Quality gates

```sh
python -m pip install -e '.[dev]'
ruff check src tests
mypy src
pytest -q
node scripts/build-runtime-artifact.mjs --check
node scripts/packed-runtime-gate.mjs
python -m build
scripts/wheel-actual-gate.sh
```

The packed-runtime gate:

- inspects every packed `package.json` for `file:` and `workspace:`
- requires exact semver for all declared runtime roots
- rejects `postinstall`, scanner substitutes, and browser binaries
- installs only the tarball outside the repository with a physically empty npm
  cache, `--offline`, and `--ignore-scripts`
- runs `npm ls --all`, imports the installed real CLI/core/rules/Playwright
  modules, and performs a real scan using the already-installed Chrome channel

The wheel actual gate installs the built wheel with `--no-index --no-deps` and
runs its embedded packed runtime against a local fixture. Neither gate downloads
a browser.

## Live and listing blocker

Automated local gates do not prove installation in Open edX. The remaining
gate is:

> Blocked: in-platform installation, staff authorization, authenticated
> rendered-unit scanning, and the Open edX Extensions Directory listing require
> a running Tutor sandbox, a staff account/course URL, an externally mounted
> storage-state secret for a private course, and founder-owned listing access.
> Owner: founder. Next action: provide those resources and ensure Node 22 plus a
> compatible browser are installed in the LMS/CMS image.

No sandbox credentials or secrets are embedded.

## Official platform references

- https://docs.openedx.org/projects/xblock/en/latest/xblock.html
- https://docs.openedx.org/projects/xblock/en/latest/xblock-tutorial/edx_platform/edx_studio.html
- https://docs.tutor.edly.io/dev.html
- https://docs.tutor.edly.io/tutorials/plugin.html
- https://docs.tutor.edly.io/reference/api/hooks/catalog.html

## Patent binding

`@patentBinding`: none. The integration surfaces existing scanner output and
adds no scan algorithm or claim element.

