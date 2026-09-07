# Ariada for Bitrix

A module for Bitrix that runs an accessibility audit against a public address and
shows the result in the administrative area.

The files here are the module's source. Bitrix ships modules as source, so the
archive a site owner installs is these same files packed; it is built from this
directory rather than the other way round.

## What is where

- `install/` — the installer, its component, and the language files it reads.
- `lib/` — the module's classes: configuration, the runner that calls the
  command line, the report reader and parser, and the address check that refuses
  anything not publicly reachable.
- `lang/en/` — the administrative strings.

## Installing

Pack this directory as `bitrix.ariada` and place it under the site's `modules`
directory, or install the built archive through the module marketplace screen.
