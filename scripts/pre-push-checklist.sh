#!/usr/bin/env bash
#
# Pre-push checklist — interactive runnable gate that enforces every
# audit step required by the pre-push verification policy.
#
# Designed to be run BEFORE every `git push` (canonical or public). Each
# item is either auto-checked (the script runs the command and verifies
# exit code) or human-checked (the developer must explicitly confirm).
# The script emits a verification report at the end that should be
# pasted into the next conversation message as proof of compliance.
#
# Usage:
#
#   bash scripts/pre-push-checklist.sh [<range>] [--public]
#
# - <range> defaults to the unpushed range (`@{u}..HEAD`). For first
#   pushes use `<base-branch>..HEAD`.
# - --public flag tightens the audit: requires both pre-claim and
#   pre-merge independent review markers present in the recent session.
#
# Exit codes:
#   0 — all required gates green, push approved
#   1 — at least one gate failed; do NOT push
#   2 — invocation error
#
# SPDX-FileCopyrightText: 2026 Alexander Brichkin (Agonist Development AB, Sweden, org.nr 559452-5726)
# SPDX-License-Identifier: EUPL-1.2

set -uo pipefail

# Default range = «unpushed commits on current branch» (`@{u}..HEAD`).
# The literal default is split out of the bash ${...:-default} syntax because
# the default expression contains a `}` which would otherwise close the
# substitution prematurely.
DEFAULT_RANGE='@{u}..HEAD'
RANGE=""
PUBLIC_MODE=0
CHEAP_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --public)
      PUBLIC_MODE=1
      ;;
    --cheap-only)
      # Skip the slow gates (typecheck, full test suite, ESLint sweep)
      # — used when the gate fires from a git hook on every push and
      # 30+ s of wall-time is annoying for routine canonical pushes.
      # The slow gates still RUN on every CI workflow + are the
      # default for public pushes via this script.
      CHEAP_ONLY=1
      ;;
    *)
      if [[ -z "$RANGE" ]]; then
        RANGE="$arg"
      fi
      ;;
  esac
done
if [[ -z "$RANGE" ]]; then
  RANGE="$DEFAULT_RANGE"
fi

# ────────────────────────────────────────────────────────────────────────────
# State + reporting
# ────────────────────────────────────────────────────────────────────────────

PASSED=()
FAILED=()
WARNED=()

ok()    { PASSED+=("$1"); printf '\033[32m✓\033[0m %s\n' "$1"; }
fail()  { FAILED+=("$1"); printf '\033[31m✗\033[0m %s\n' "$1"; }
warn()  { WARNED+=("$1"); printf '\033[33m⚠\033[0m %s\n' "$1"; }

run_gate() {
  local name="$1"
  shift
  local out
  local rc
  out=$("$@" 2>&1)
  rc=$?
  if [[ $rc -eq 0 ]]; then
    ok "$name"
    return 0
  else
    fail "$name (exit $rc)"
    printf '  └─ %s\n' "$(echo "$out" | tail -1)"
    return 1
  fi
}

# ────────────────────────────────────────────────────────────────────────────
# Sanity
# ────────────────────────────────────────────────────────────────────────────

[[ -d .git ]] || { echo "ERROR: must run from repo root (no .git/ here)" >&2; exit 2; }

printf '\n═══ pre-push checklist — range %s ═══\n\n' "$RANGE"

# ────────────────────────────────────────────────────────────────────────────
# Auto-checked gates
# ────────────────────────────────────────────────────────────────────────────

printf '── Auto-checked gates ──\n'

# Strict blocking gates — push must NOT proceed if any of these fail.
# Slow gates (typecheck, test) skipped in --cheap-only mode to keep the
# git pre-push hook responsive on routine canonical pushes.
if (( CHEAP_ONLY == 0 )); then
  run_gate "typecheck (pnpm typecheck)" pnpm typecheck
  run_gate "test (pnpm test)" pnpm test
else
  warn "typecheck + test SKIPPED (--cheap-only mode) — must be run separately before public push"
fi
run_gate "madge circular (pnpm madge:circular)" pnpm madge:circular
run_gate "audit-patent-coverage (A-11..A-16)" bash scripts/audit-patent-coverage.sh
if [[ -f scripts/validate-rule-helpurls.mjs ]]; then
  run_gate "validate-rule-helpurls" node scripts/validate-rule-helpurls.mjs
fi

# Range-scoped gates — skip cleanly if the range doesn't resolve (e.g.
# branch has no upstream, first push of a fresh branch).
if git rev-parse "$RANGE" >/dev/null 2>&1; then
  run_gate "commit-message discipline ($RANGE)" bash scripts/check-commit-messages.sh "$RANGE"
else
  warn "commit-message discipline: range '$RANGE' did not resolve, skipped"
fi

# Soft gates — surface but do not block. Pre-existing warnings (unicorn
# prevent-abbreviations etc.) and per-workflow shellcheck noise live here.
# Skipped in --cheap-only mode (full ESLint sweep is the slowest of the
# soft gates; the per-file lint-staged hook already caught issues at
# commit time, so the pre-push sweep is informational here).
if (( CHEAP_ONLY == 0 )); then
  ESLINT_OUT=$(pnpm exec eslint . --max-warnings 0 2>&1) && ESLINT_EXIT=0 || ESLINT_EXIT=$?
  if [[ $ESLINT_EXIT -eq 0 ]]; then
    ok "ESLint (--max-warnings 0)"
  else
    WARN_COUNT=$(echo "$ESLINT_OUT" | grep -oE '[0-9]+ problems?' | head -1)
    warn "ESLint reports residual warnings: $WARN_COUNT (review separately; not blocking)"
  fi
fi

ACTIONLINT_OUT=$(find .github/workflows -name '*.yml' -print0 2>/dev/null | xargs -0 actionlint 2>&1) && ACTIONLINT_EXIT=0 || ACTIONLINT_EXIT=$?
if [[ $ACTIONLINT_EXIT -eq 0 ]]; then
  ok "actionlint"
else
  warn "actionlint reports issues (review separately; not blocking): $(echo "$ACTIONLINT_OUT" | head -1)"
fi

# Commit-attribution gates
# Match the actual AI co-author trailer form: «Co-Authored-By: <Name>» at
# line start (typical trailer position). Substring match elsewhere in the
# body (e.g. in a commit message that DESCRIBES the gate) is intentional.
# Equivalent regex used by check-commit-messages.sh AI_TRAILER_REGEX.
AI_TRAILER_PATTERN='^Co-Authored-By:[[:space:]]*(Claude|Anthropic|AI|GPT|Copilot)'
if git log "$RANGE" --format='%B' 2>/dev/null | grep -qE "$AI_TRAILER_PATTERN"; then
  fail "AI co-author trailer found (matches /$AI_TRAILER_PATTERN/)"
else
  ok "no AI co-author trailer in commit bodies"
fi

# Canonical author check
declare -a NON_CANON_AUTHORS
while IFS= read -r line; do
  if [[ "$line" != "Alekszandr Bricskin (Agonist Development AB) <git@ariada.org>" ]]; then
    NON_CANON_AUTHORS+=("$line")
  fi
done < <(git log "$RANGE" --format='%an <%ae>' 2>/dev/null || true)
if (( ${#NON_CANON_AUTHORS[@]} == 0 )); then
  ok "canonical author on all commits in range"
else
  warn "non-canonical authors: ${NON_CANON_AUTHORS[*]}"
fi

# A-15 commercial-email regression check
# Only the actual commercial-mailbox shapes — narrower than the bare
# `@ariada.ai` substring (which would fire on a commit that DESCRIBES
# the gate itself, e.g. this one). Matches the set documented in the
# project oss-docs-discipline rule §2.4.
A15_LEAK_PATTERN='\b(hello|security|conduct|trademark|legal|contact|sales|info|support)@ariada\.ai\b'
LEAK_HITS=$(git log "$RANGE" --format='%B' 2>/dev/null | grep -E "$A15_LEAK_PATTERN" | head -1)
if [[ -z "$LEAK_HITS" ]]; then
  ok "no A-15 commercial-email regression in commit messages"
else
  fail "A-15 commercial-email regression: $LEAK_HITS"
fi

# ────────────────────────────────────────────────────────────────────────────
# Human-checked items — developer MUST acknowledge
# ────────────────────────────────────────────────────────────────────────────

printf '\n── Orchestrator-confirmed items ──\n'
printf '\nThe developer running this script MUST be able to answer YES to\n'
printf 'every item below. Pasting this output without YES answers = lying.\n\n'

cat <<'EOF'
  [ ] Pre-claim independent review run on the diff (an external reviewer
      flow such as agent-skills:code-review-and-quality, or equivalent
      independent run that did not author the changes)?
  [ ] Pre-merge independent review run on the EXACT post-fix state that
      is about to be pushed (no fixes applied AFTER the last review verdict)?
  [ ] If any pre-merge review finding triggered a fix → the pre-merge
      review was re-run on the post-fix state and returned GO before this
      push? (Re-audit clause from pre-push-verification-discipline rule.)
  [ ] All changes in the range are intended for the push target (no stray
      internal-only paths if --public; no half-finished WIP edits)?
  [ ] The diff has been visually reviewed at least once (git diff --stat
      + spot-check of unusual changes)?
EOF

# ────────────────────────────────────────────────────────────────────────────
# Public-mode additional gates
# ────────────────────────────────────────────────────────────────────────────

if (( PUBLIC_MODE == 1 )); then
  printf '\n── Public-mode additional gates ──\n'
  cat <<'EOF'
  [ ] Branch protection respected (no force-push, no merge-while-CI-pending)?
  [ ] PR body explicitly framed (commit shape, audit references, etc.)?
  [ ] CodeRabbit + Sonar comments addressed (or explicitly waived with reason)?
  [ ] sync-canonical-to-public.sh additive workflow used (no replay-mode)?
EOF
fi

# ────────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────────

printf '\n═══ summary ═══\n'
printf '  passed: %d\n' "${#PASSED[@]}"
printf '  failed: %d\n' "${#FAILED[@]}"
printf '  warned: %d\n' "${#WARNED[@]}"

if (( ${#FAILED[@]} > 0 )); then
  printf '\n\033[31mDO NOT PUSH\033[0m — fix the failed gates first.\n\n'
  printf 'Failed gates:\n'
  for f in "${FAILED[@]}"; do printf '  - %s\n' "$f"; done
  exit 1
fi

printf '\n\033[32mAuto-gates green.\033[0m Orchestrator MUST also confirm the\n'
printf 'human-checked items above before push. Paste the full output of this\n'
printf 'script into the next conversation message as proof.\n\n'
exit 0
