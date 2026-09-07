# Architecture

## Liferay module

The module follows Liferay's documented MVC pattern: a minimal `MVCPortlet`,
an `MVCActionCommand` for scanning, and an `MVCResourceCommand` for report
download. The portlet component and commands share the exact portlet name.

Official references:

- https://learn.liferay.com/w/dxp/development/traditional-java-based-development/developing-a-web-application/using-mvc
- https://learn.liferay.com/w/dxp/development/traditional-java-based-development/developing-a-web-application/using-mvc/mvc-action-command
- https://learn.liferay.com/w/dxp/development/traditional-java-based-development/fundamentals/module-projects
- https://learn.liferay.com/w/dxp/development/tooling/liferay-workspace/configuring-liferay-workspace

The target `portal-7.4-ga132` and Java 17 match Liferay's documented GA132
workspace example and GA129+ supported JDK baseline. `release.portal.api` is
versioned by Workspace, as Liferay recommends.

## Scan flow

1. The JSP records the browser's current page URL in a namespaced hidden field.
2. Liferay validates the action token and dispatches `/ariada/run_scan`.
3. `PortalUrlPolicy` requires HTTP(S), no userinfo, and exact portal origin.
4. `AriadaRuntimeInstaller` verifies and extracts the embedded npm tarball into
   the OSGi bundle data directory. A checksum marker makes later scans reuse it.
5. `AriadaScanRunner` starts Node directly with an argument list, never a shell.
6. The real CLI scans only the accessibility domain and writes JSON to a private
   temporary directory.
7. Exit 0 and exit 1 are valid CLI results. Timeouts, larger exit codes, missing
   Node/browser, malformed JSON, and oversized reports are explicit failures.
8. The parser creates an immutable model and stores it in portlet session scope.
9. The JSP renders status and top findings. The resource command returns the
   complete raw report with `no-store` and attachment headers.

## Runtime boundary

The OSGi JAR includes `META-INF/ariada/runtime.tgz` and its SHA-256 file. The
tarball contains bundled npm dependencies, so Liferay never runs npm. Node and
the Chromium executable remain host prerequisites because embedding platform
binaries would make the OSGi package architecture-specific and would violate
the no-browser-download deployment contract.

The maintainer assembly may pack canonical source packages from the monorepo,
but it rejects any `file:`, `workspace:`, or `link:` protocol in every packed
package manifest. The final artifact is consumed and tested without the
monorepo.

## Security and privacy

- Same-origin validation prevents arbitrary SSRF while allowing intranet hosts.
- The scanner command uses `ProcessBuilder` arguments and no shell expansion.
- Runtime extraction rejects absolute paths and parent traversal.
- Expanded runtime size, report size, stderr size, and scan time are bounded.
- Reports are scoped to the current portlet session and returned with no-cache
  headers. The server temporary report directory is deleted after parsing.
- Configuration includes paths and limits only. Credentials are not accepted.
- Sandbox passwords exist only in gate process environment variables and are
  never printed.

