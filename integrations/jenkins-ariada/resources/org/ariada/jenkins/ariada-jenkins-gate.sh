#!/usr/bin/env sh
set -eu

cli="${ARIADA_CLI:-ariada}"
target_url="${ARIADA_TARGET_URL:-}"
output_dir="${ARIADA_OUTPUT_DIR:-ariada-output}"
format="${ARIADA_FORMAT:-both}"
threshold="${ARIADA_SEVERITY_THRESHOLD:-moderate}"
timeout_ms="${ARIADA_TIMEOUT_MS:-30000}"

if [ -z "$target_url" ]; then
  echo "ARIADA_TARGET_URL is required" >&2
  exit 2
fi

mkdir -p "$output_dir"

"$cli" scan "$target_url" \
  --output-dir "$output_dir" \
  --format "$format" \
  --severity-threshold "$threshold" \
  --timeout-ms "$timeout_ms"
