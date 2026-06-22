#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Agonist Development AB
# SPDX-License-Identifier: EUPL-1.2
set -euo pipefail

OUTPUT_DIR="${ARIADA_OUTPUT_DIR:-dist}"
TARGET_URL="${ARIADA_TARGET_URL:-}"
REPORT_DIR="${ARIADA_REPORT_DIR:-ariada-output}"
SEVERITY="${ARIADA_FAIL_ON_SEVERITY:-serious}"

mkdir -p "$REPORT_DIR"

if [[ -n "$TARGET_URL" ]]; then
  npx @ariada-org/cli scan "$TARGET_URL" --severity-threshold "$SEVERITY" --format json --output-dir "$REPORT_DIR"
  exit $?
fi

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "Cloudflare Ariada: output directory not found: $OUTPUT_DIR" >&2
  exit 2
fi

cat > "$REPORT_DIR/cloudflare-build-summary.json" <<JSON
{
  "tool": "ariada-cloudflare-build-step",
  "mode": "static-output-placeholder",
  "outputDir": "$OUTPUT_DIR",
  "message": "Set ARIADA_TARGET_URL to run @ariada-org/cli against a deployed Pages/Workers URL."
}
JSON

echo "Cloudflare Ariada: static output present at $OUTPUT_DIR; set ARIADA_TARGET_URL for live CLI scan."
