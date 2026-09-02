#!/usr/bin/env bash
# SPDX-License-Identifier: EUPL-1.2
#
# Glue script invoked by the composite GitHub Action. Wraps the
# `ariada diff` CLI subcommand and propagates outputs back to the
# Action runner via $GITHUB_OUTPUT.

set -euo pipefail

HEAD_SCAN="${INPUT_HEAD_SCAN:-}"
BASE_SCAN="${INPUT_BASE_SCAN:-}"
POLICY_FILE="${INPUT_POLICY_FILE:-.ariada/policy.yaml}"
ENGINE="${INPUT_ENGINE:-canonical}"
REPORT_FORMAT="${INPUT_REPORT_FORMAT:-markdown}"
FAIL_ON_WARN="${INPUT_FAIL_ON_WARN:-false}"
PR_COMMENT="${INPUT_PR_COMMENT:-true}"

OUTPUT_FILE="${GITHUB_OUTPUT:-/dev/stdout}"

emit_output() {
  local key="$1"
  local val="$2"
  echo "${key}=${val}" >> "$OUTPUT_FILE"
}

echo "ariada-diff: engine=${ENGINE} report-format=${REPORT_FORMAT} fail-on-warn=${FAIL_ON_WARN}"

if [[ "$ENGINE" == "canonical" && -z "${INPUT_ARIADA_API_TOKEN:-}" ]]; then
  echo "::error::engine=canonical requires ariada-api-token input"
  emit_output "gate-result" "fail"
  exit 4
fi

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "::warning::policy file not found at ${POLICY_FILE} — using built-in defaults"
fi

if ! command -v ariada >/dev/null 2>&1; then
  echo "::warning::ariada CLI not on PATH — composite action assumes a prior step has installed @ariada-org/cli"
  emit_output "gate-result" "warn"
  emit_output "new-count" "0"
  emit_output "pre-existing-count" "0"
  emit_output "resolved-count" "0"
  emit_output "decision-id" ""
  exit 0
fi

# Defensive: head + base may be unset when the consumer wires a different
# upstream scan-fetch step. In that case we exit warn (exit 0 to not block).
if [[ -z "$HEAD_SCAN" || -z "$BASE_SCAN" ]]; then
  echo "::warning::head-scan or base-scan input empty; skipping diff"
  emit_output "gate-result" "warn"
  exit 0
fi

set +e
ariada diff classify \
  --head "$HEAD_SCAN" \
  --base "$BASE_SCAN" \
  --engine "$ENGINE" \
  --out diff.json
CLASSIFY_RC=$?
set -e

if [[ $CLASSIFY_RC -ne 0 ]]; then
  echo "::error::ariada diff classify failed with rc=${CLASSIFY_RC}"
  emit_output "gate-result" "fail"
  exit "$CLASSIFY_RC"
fi

set +e
ariada diff gate --diff diff.json --policy "$POLICY_FILE" --out decision.json
GATE_RC=$?
set -e

# A gate that could not reach a verdict has not permitted anything.
#
# This return code used to be captured and never read again — the only
# occurrence of GATE_RC in the file was the line above. A gate run that ended
# non-zero while leaving a decision file behind fell through to the comparison
# below, where anything that is not the string "fail" is a pass. The step above
# gets this right for the classifier; this one did not.
if [[ $GATE_RC -ne 0 ]]; then
  echo "::error::ariada diff gate failed with rc=${GATE_RC}"
  emit_output "gate-result" "fail"
  exit "$GATE_RC"
fi

# Parse outputs from decision.json without jq (keep portability).
GATE_RESULT=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('decision.json','utf8')).result || '')")
DECISION_ID=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('decision.json','utf8')).decision_id || '')")
NEW_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('decision.json','utf8')).counts.new))")
PE_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('decision.json','utf8')).counts.pre_existing))")
RES_COUNT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('decision.json','utf8')).counts.resolved))")
REPORT_URL=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('decision.json','utf8')).report_url || '')")

emit_output "gate-result" "$GATE_RESULT"
emit_output "new-count" "$NEW_COUNT"
emit_output "pre-existing-count" "$PE_COUNT"
emit_output "resolved-count" "$RES_COUNT"
emit_output "decision-id" "$DECISION_ID"
emit_output "report-url" "$REPORT_URL"

# The verdict is read as a closed set, not as "anything that is not the word
# fail". An empty or unrecognised answer is an answer nobody can act on, and a
# gate exists to stop things: not understanding what it was told is a reason to
# stop, not a reason to let through.
case "$GATE_RESULT" in
  fail)
    exit 1
    ;;
  warn)
    if [[ "$FAIL_ON_WARN" == "true" ]]; then
      exit 1
    fi
    ;;
  pass)
    ;;
  "")
    echo "::error::decision.json carried no verdict — refusing to pass a merge on an answer that is not there"
    emit_output "gate-result" "fail"
    exit 1
    ;;
  *)
    echo "::error::decision.json carried an unrecognised verdict '${GATE_RESULT}' — refusing to pass a merge on an answer this action cannot read"
    emit_output "gate-result" "fail"
    exit 1
    ;;
esac
exit 0
