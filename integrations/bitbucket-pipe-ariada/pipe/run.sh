#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
set -euo pipefail

TARGET_URL="${TARGET_URL:-}"
FAIL_ON_SEVERITY="${FAIL_ON_SEVERITY:-serious}"
OUTPUT_DIR="${OUTPUT_DIR:-ariada-output}"

if [[ -z "$TARGET_URL" ]]; then
  echo "TARGET_URL is required for the Ariada Bitbucket Pipe." >&2
  exit 2
fi

mkdir -p "$OUTPUT_DIR"
ariada scan "$TARGET_URL" --severity-threshold "$FAIL_ON_SEVERITY" --format json --output-dir "$OUTPUT_DIR"
