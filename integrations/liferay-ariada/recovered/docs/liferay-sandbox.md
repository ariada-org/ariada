# Liferay sandbox actual gate

## External inputs

Supply these only through the process environment:

- `LIFERAY_BASE_URL`: portal origin, for example `https://portal.example.test`.
- `LIFERAY_PAGE_URL`: live widget page already containing Ariada Accessibility.
- `LIFERAY_EMAIL`: signed-in test user.
- `LIFERAY_PASSWORD`: test-user password.
- `PLAYWRIGHT_BROWSERS_PATH`: existing browser cache for the gate client.

Select exactly one deployment mode:

- `LIFERAY_DOCKER_CONTAINER`: copy the JAR into `/opt/liferay/deploy`.
- `LIFERAY_DEPLOY_DIR`: copy the JAR into a host deployment directory.
- `LIFERAY_PREDEPLOYED=1`: assert that the exact JAR is already deployed.

The Liferay application host itself must also provide Node.js 22 and a
Playwright Chromium path configured through
`org.ariada.liferay.configuration.AriadaConfiguration`.

## Execution

`./scripts/gate-liferay-sandbox.sh`

The gate does not download a browser. It deploys or reuses the JAR, signs in
through Liferay, opens the supplied live page, runs the portlet scan, verifies
the result panel, downloads valid report JSON, and records a screenshot.

## Current external blocker

Status: **BLOCKED outside the repository** until a running Liferay portal,
test credentials, and a live page containing the portlet are supplied.

Owner: founder or Liferay sandbox administrator.

Next action: provision/sign into the sandbox, install the JAR, add the portlet
to a widget page, configure host Node/browser paths, and run the command above
with environment values. No credentials or live URLs belong in source control.

