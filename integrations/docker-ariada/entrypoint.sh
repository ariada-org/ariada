#!/usr/bin/env sh
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2

set -eu

if [ "$#" -eq 0 ]; then
  set -- --help
fi

if [ "${1#-}" != "$1" ]; then
  set -- ariada "$@"
fi

exec "$@"
