#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
set -euo pipefail

VERSION="${VERSION:-latest}"
INSTALL_PLAYWRIGHT="${INSTALLPLAYWRIGHT:-false}"

if ! command -v npm >/dev/null 2>&1; then
  echo "Ariada devcontainer feature requires npm. Install the Node feature first." >&2
  exit 1
fi

npm install --global "@ariada-org/cli@${VERSION}"

if [[ "$INSTALL_PLAYWRIGHT" == "true" ]]; then
  npx playwright install chromium
fi

ariada version
