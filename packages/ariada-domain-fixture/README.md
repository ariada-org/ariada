<!--
SPDX-FileCopyrightText: 2026 Agonist Development AB
SPDX-License-Identifier: EUPL-1.2
-->

# `ariada-domain-fixture`

Minimal fixture domain module for the ariada domain-contract acceptance suite.
It exists so the domain-discovery test can prove that an npm-convention domain
module is found, loaded, and validated end to end — it is a test fixture, not a
product package.

License: EUPL-1.2 (European Union Public Licence v1.2).

## Purpose

The ariada platform discovers domain modules by npm naming convention. This
package is the smallest valid such module: it exports the contract shape the
loader expects and nothing else. The acceptance suite installs it, resolves it
by convention, and asserts the loader accepts it.

## Status

`v0.0.1` — internal test fixture. Not intended for direct application use.

## Documentation

<https://github.com/ariada-org/ariada/tree/main/packages/ariada-domain-fixture>.
