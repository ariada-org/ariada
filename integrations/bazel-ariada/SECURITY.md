# Security model

## Action boundary

`ariada_scan` reads only Bazel-declared site, CLI, runtime, and browser inputs. It
writes only its two declared outputs plus temporary files under the action temporary
directory. The runner invokes Node with an argument vector and `shell: false`.

The static server binds to IPv4 loopback on an ephemeral port. It accepts only GET
and HEAD, rejects traversal and symlink escape, and does not list directories. The
fixture has no remote subresources. Consumers remain responsible for ensuring that
their own built page does not make unintended remote requests.

## Browser runtime

The release archive contains Playwright JavaScript packages but no browser binary.
Browser files must be declared through `browser_files`, with
`browser_cache_marker` identifying their cache root. Browser downloads are disabled
for the action and all package gates.

## Credentials and event transport

The rule does not accept credentials. Event-bus URL, token, log, and tenant variables
are removed from the CLI child environment so a build action cannot publish events.
Do not place secrets in source files, Bazel attributes, browser fixtures, or action
arguments. Use the CI platform's secret store for unrelated release operations.

## Reporting

Report suspected vulnerabilities privately to `security@ariada.org`. Include the
module version, Bazel version, operating system, minimal reproduction, and impact.
Do not attach credentials or production data.
