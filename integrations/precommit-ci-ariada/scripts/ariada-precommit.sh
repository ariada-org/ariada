#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
set -euo pipefail

SEVERITY="serious"
FILES=()

for arg in "$@"; do
  case "$arg" in
    --severity-threshold=*)
      SEVERITY="${arg#*=}"
      ;;
    *)
      FILES+=("$arg")
      ;;
  esac
done

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Ariada pre-commit.ci: no matching files."
  exit 0
fi

if ! command -v ariada >/dev/null 2>&1; then
  echo "Ariada pre-commit.ci: install @ariada-org/cli or use the package hook wrapper." >&2
  exit 2
fi

echo "Ariada pre-commit.ci: severity threshold ${SEVERITY}; files: ${#FILES[@]}"
ariada version
