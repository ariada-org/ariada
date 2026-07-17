#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
set -euo pipefail

HTML_DIR="${READTHEDOCS_OUTPUT:-_readthedocs/html}"
REPORT_DIR="${ARIADA_REPORT_DIR:-_readthedocs/ariada}"
TARGET_URL="${ARIADA_TARGET_URL:-}"
SEVERITY="${ARIADA_FAIL_ON_SEVERITY:-serious}"

mkdir -p "$REPORT_DIR"

if [[ -n "$TARGET_URL" ]]; then
  npx @ariada-org/cli scan "$TARGET_URL" --severity-threshold "$SEVERITY" --format json --output-dir "$REPORT_DIR"
  exit $?
fi

if [[ ! -d "$HTML_DIR" ]]; then
  echo "Read the Docs Ariada: HTML output not found: $HTML_DIR" >&2
  exit 2
fi

find "$HTML_DIR" -name '*.html' -print > "$REPORT_DIR/html-files.txt"
cat > "$REPORT_DIR/readthedocs-summary.json" <<JSON
{
  "tool": "ariada-readthedocs-post-build",
  "htmlDir": "$HTML_DIR",
  "message": "Set ARIADA_TARGET_URL to run @ariada-org/cli against a published documentation URL."
}
JSON

echo "Read the Docs Ariada: wrote report files to $REPORT_DIR"
