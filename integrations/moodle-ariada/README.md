# Ariada for Moodle

A Moodle 4.5+ local plugin that queues Ariada accessibility scans for rendered
course-page URLs and presents WCAG 2.2 and EN 301 549 findings to teachers and
administrators. All capture and analysis is delegated to the OSS
@ariada-org/cli; this plugin does not reimplement scan rules.

Public universities and schools in the EU are commonly within the scope of the
Web Accessibility Directive. EN 301 549 is the European ICT accessibility
standard. Automated evidence is not a legal compliance determination; manual
review remains necessary.

## Production install

    scripts/build-runtime.sh
    scripts/package.sh

Install dist/local_ariada-1.0.0.zip through **Site administration > Plugins >
Install plugins**. Do not install the source directory: the production ZIP
contains the runtime under runtime/node_modules.

The runtime has exact top-level versions, no file:/workspace: protocols, no
postinstall script, and includes @ariada-org/rules-axe@0.1.0 despite that
package not currently existing in the public npm registry.

Host prerequisites:

- Moodle 4.5+ with working cron.
- PHP 8.1+ with proc_open.
- Node.js 22+.
- Playwright Chromium provisioned outside Moodle and outside the scan gate.

Configure Node and PLAYWRIGHT_BROWSERS_PATH under **Site administration >
Plugins > Local plugins > Ariada settings**. Enable private targets only when
Moodle itself uses a private address.

## Use

Open a course and select **Ariada accessibility reports**. Teachers can submit a
same-origin page, follow queued/running/completed state, review severity counts,
and open full findings. Managers can review all course reports. Cron performs
the scan, so browser work never blocks the request thread.

Ariada CLI 0.1.0 does not accept Moodle login state. A production target must
therefore be guest-visible or use a separately supported scanner-authentication
arrangement. The plugin never copies a teacher session into the browser.

## Verification

See docs/validation.md. The decisive gate uses an offline empty consumer and the
extracted Moodle ZIP, not a hoisted source tree.

Official references:

- https://moodledev.io/docs/5.0/apis/plugintypes/local
- https://moodledev.io/docs/5.2/apis/subsystems/admin#external-pages
- https://moodledev.io/docs/5.3/apis/subsystems/task/adhoc
- https://moodledev.io/docs/4.5/apis/subsystems/privacy

## External blocker

Blocked: live in-platform validation requires a real Moodle sandbox, authorised
teacher/admin credentials, a scanable course page, and cron access. Moodle
Plugins directory submission requires the maintainer account. Owner:
founder/maintainer. Next action: provide sandbox and submission access; no
credentials belong in this package.

