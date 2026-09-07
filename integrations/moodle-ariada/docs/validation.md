# Validation and release gates

## PHP and Moodle

    composer install --no-interaction --no-progress
    find . -path ./vendor -prune -o -path ./build -prune -o -path ./runtime -prune \
      -o -name '*.php' -print0 | xargs -0 -n1 php -l
    composer lint
    composer test

## Runtime and package

    scripts/build-runtime.sh
    scripts/package.sh
    scripts/provision-browser.sh          # preparation; may download Chromium
    scripts/gate-packed-runtime.sh        # offline; never downloads a browser
    scripts/gate-moodle-docker.sh         # Moodle 4.5 install + authenticated render

The decisive runtime gate installs the bundled tarball with npm --offline into
an empty consumer/cache, resolves CLI, engine, Playwright, rules-axe, and
axe-core, then runs the CLI from the extracted Moodle ZIP against localhost
using pre-provisioned Chromium. Exit 0 or 1 is accepted only when canonical JSON
contains a real accessibility finding.

## External gate

A live institution gate requires a Moodle sandbox URL, teacher/admin account, a
guest-visible or scanner-authenticated course page, cron access, Node.js 22+,
and pre-provisioned Chromium. Moodle Plugins directory publication separately
requires the maintainer account. Owner: founder/maintainer.

