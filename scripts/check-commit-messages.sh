#!/usr/bin/env bash
# check-commit-messages.sh — BLOCKING pre-push commit-message hygiene check.
#
# Scans every commit message (subject + body + trailers) in a git range for
# forbidden internal vocabulary per `.claude/skills/commit-message-discipline/
# SKILL.md`. The principle: commit messages describe **what code changed**,
# not internal strategies / testing automation / dev pipelines / business
# vocab / AI-orchestration patterns / release-engineering jargon.
#
# Usage:
#   bash scripts/check-commit-messages.sh                          # default: origin/main..HEAD
#   bash scripts/check-commit-messages.sh "origin/main..HEAD"      # explicit range
#   bash scripts/check-commit-messages.sh "ALL"                    # full history
#   bash scripts/check-commit-messages.sh --verbose ...            # show category per hit
#
# Exit codes:
#   0 — clean (no forbidden tokens in any commit message in range)
#   1 — hits found (BLOCKING; report on stdout)
#   2 — invocation error (bad range, not in a repo, etc.)
#
# Source-of-truth for forbidden patterns:
#   .claude/skills/commit-message-discipline/SKILL.md §2 (sub-classes 2.1..2.5)
#
# Author: Alekszandr Bricskin (Agonist Development AB, Sweden, org.nr 559452-5726)
# SPDX-License-Identifier: EUPL-1.2

set -uo pipefail

VERBOSE=0
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=1
  shift
fi

RANGE="${1:-origin/main..HEAD}"

if [[ "$RANGE" == "ALL" ]]; then
  # No range arg = whole history. Bash 3.2 chokes on empty array expansion under
  # set -u, so build the git command without an empty array.
  RANGE_FLAG=""
else
  RANGE_FLAG="$RANGE"
fi

# Validate the range resolves to commits.
if [[ -z "$RANGE_FLAG" ]]; then
  if ! git log --oneline -1 >/dev/null 2>&1; then
    echo "ERROR: not in a git repo (or empty repo)." >&2
    exit 2
  fi
else
  if ! git log "$RANGE_FLAG" --oneline -1 >/dev/null 2>&1; then
    echo "ERROR: git range '$RANGE' did not resolve. Are you in the repo? Does origin/main exist?" >&2
    exit 2
  fi
fi

# Pick a grep flavour — prefer GNU grep for -P, fall back to BSD grep -E.
# `$GREP` matches the dump (line numbers retained for human-readable hit reports);
# `$GREP_NOLINE` filters per-pattern in `filter_allowlist` (no -n — otherwise each
# pass re-prefixes survivors with a fresh `1:`, producing the `1:1:1:...:56:` cascade).
if grep -P --version >/dev/null 2>&1; then
  GREP="grep -niP"
  GREP_NOLINE="grep -iP"
else
  GREP="grep -niE"
  GREP_NOLINE="grep -iE"
fi

# Slurp all commit-message text in the range once. Format: «=== SHA SUBJECT» + BODY lines.
if [[ -z "$RANGE_FLAG" ]]; then
  COMMIT_DUMP=$(git log --pretty=format:'=== %h %s%n%b' 2>/dev/null || true)
  TOTAL_COMMITS=$(git log --oneline 2>/dev/null | wc -l | tr -d ' ')
else
  COMMIT_DUMP=$(git log "$RANGE_FLAG" --pretty=format:'=== %h %s%n%b' 2>/dev/null || true)
  TOTAL_COMMITS=$(git log "$RANGE_FLAG" --oneline 2>/dev/null | wc -l | tr -d ' ')
fi

# Track total hits across categories. Counter-style instead of an associative array
# so the script works on bash 3.2 (macOS default).
HITS_FOUND=0
REPORT=""

# Load allowlist patterns — one extended-regex per line, ignore #-comments + blanks.
ALLOWLIST_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/.commit-message-allowlist.txt"
ALLOWLIST_PATTERNS=""
if [[ -f "$ALLOWLIST_FILE" ]]; then
  ALLOWLIST_PATTERNS=$(grep -vE '^[[:space:]]*(#|$)' "$ALLOWLIST_FILE" || true)
fi
ALLOWLIST_COUNT=$(echo "$ALLOWLIST_PATTERNS" | grep -cE '.' 2>/dev/null || echo 0)

# Filter: given a multi-line hit blob, drop any line matching any allowlist pattern.
# Per-pattern loop instead of combined alternation — avoids regex composition bugs.
filter_allowlist() {
  local input="$1"
  if [[ -z "$ALLOWLIST_PATTERNS" ]]; then
    echo "$input"
    return
  fi
  local filtered="$input"
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # Drop lines matching this allowlist pattern
    filtered=$(echo "$filtered" | $GREP_NOLINE -v "$pattern" 2>/dev/null || true)
  done <<< "$ALLOWLIST_PATTERNS"
  echo "$filtered"
}

scan_category() {
  local name="$1"
  local regex="$2"
  local raw_hits
  raw_hits=$(echo "$COMMIT_DUMP" | $GREP "$regex" 2>/dev/null || true)
  # Empty result short-circuit: skip allowlist filter when there's nothing to filter
  # — `echo "$empty"` emits a stray newline, which grep -v on per-pattern loop turns
  # into a `1:` cascade if any allowlist regex matches the empty-line case.
  [[ -z "$raw_hits" ]] && return
  # Apply allowlist filter
  local hits
  hits=$(filter_allowlist "$raw_hits")
  if [[ -n "$hits" && "$hits" != $'\n' ]]; then
    HITS_FOUND=$((HITS_FOUND + 1))
    local body
    if [[ $VERBOSE -eq 1 ]]; then
      body="$hits"
    else
      body=$(echo "$hits" | head -5)
      local hit_count
      hit_count=$(echo "$hits" | wc -l | tr -d ' ')
      if [[ $hit_count -gt 5 ]]; then
        body="$body"$'\n'"  ... ($((hit_count - 5)) more lines — re-run with --verbose to see all)"
      fi
    fi
    REPORT="${REPORT}─── $name ───"$'\n'"$body"$'\n\n'
  fi
}

# ----- Forbidden-token regex per SKILL.md §2 -----

# §2.1 — Release-eng / CI / pipeline / testing-automation jargon
# Refined v0.2 — narrowed `canary`, `replay`, `orchestrator` etc. to specific contexts;
# legitimate technical uses now allowed via .commit-message-allowlist.txt
REL_ENG_REGEX='\b(soft[-]?fail|v0\.x|pre-release|runbook|playbook|hotfix|coldfix|hotpath|hotpatch|smoke[-\s]test|sanity[-\s]check|spot[-\s]check|monkey[-\s]?patch|duct[-\s]tape|band[-\s]aid|quick[-\s]?fix|blocker|unblock|WIP|wip|in\s+progress|hot\s+(fix|path)|cold\s+(fix|path)|P[0-3]|critical[-\s]path|canary\s+(deploy|release|rollout)|staging\s+deploy|prod\s+deploy|blue[-\s]green|rolling[-\s]?back|oncall|pagerduty|paging|monitoring|observability|SLO|SLI|build\s+(green|red|broken|fixed)|CI\s+(broken|red|failing|green|passing)|green\s+CI|gated\s+on\s+(sprint|PR|release\s+train|review)|QA\s+sign[-\s]?off|sprint|velocity|burn[-\s]?down|story\s+point|coverage\s+threshold|branch\s+coverage|flaky|flake)\b'

# §2.2 — Agent codenames
AGENT_REGEX='\b(GAUSS|NOETHER|ARCHIMEDES|EULER|RIEMANN|GALOIS|LEIBNIZ|PASCAL|CURIE|HUYGENS|LAGRANGE|FERMAT|WEIERSTRASS|RAMANUJAN|DIRAC|FEYNMAN|EINSTEIN|NEWTON|TURING|HILBERT|PLATO|LAPLACE|YUKAWA|BOHR|STOKES|NASH|HUBBLE|POINCARE|POYNTING|HYPATIA|DIRICHLET)\b'

# §2.2 — AI co-author / disclosure
AI_TRAILER_REGEX='Co-Authored-By:\s*(Claude|Anthropic|AI|GPT|Copilot)|Drafted with AI|Generated (with|by)[^.]*Claude|AI-assisted (drafting|review|generation)'

# §2.2 — Patent codenames + USPTO numbers + commercial domains
PATENT_REGEX='\b(Patent [A-K](?![A-Za-z])|provisional\s+(application|patent)|USPTO\s+(application|filing)|64/0[0-9]{2},?[0-9]{3})\b'
COMMERCIAL_DOMAIN_REGEX='\b(ariada\.ai|blamer\.ai|clamper\.ai|reverter\.ai|draculascan\.com|backend\.ariada\.ai|docs\.ariada\.ai|app\.ariada\.ai)\b'

# §2.2 — Internal coord paths + state files + module codes
PATH_LEAK_REGEX='\b(product/plans/|grants/|legal/|docs/internal/|docs/session-logs/|strategy/|patentomania/|\.claude/|/Users/pedro/|HANDOFF\.md|OPEN_QUESTIONS\.md|MEMORY\.md|PRD §[0-9]+|prd-[a-z][a-z0-9-]*\.md|OQ-[A-Z0-9-]+|stage_from_snapshot|commit_step|replay-public-oss-repo)\b'

# §2.2 — TODO/FIXME markers
TODO_REGEX='(TODO PEDRO|TODO Bricskin|FIXME|XXX)\b'

# §2.3 — Activity-feed-specific
# `replay` only flagged when used as «replay-script» or «replay stage» — not «replay determinism» (legitimate technical property)
ACTIVITY_FEED_REGEX='\b(force[-\s]push|force-with-lease)\b|\b(replay[-\s](script|stage)|c-stage|gate-[0-9]+|Gate\s+#[0-9]+|pre-push-replay-verify|audit-patent-coverage|skill\s+invocation)\b|\b(Aftermarked|alexander-brichkin|agonist-org|agonist-admin|bricha2121|alex-bricskin|alekszandr-bricskin)\b'

# §2.4 — Strategy / business / planning vocab
STRATEGY_REGEX='\b(strategy|strategic|positioning|GTM|go[-\s]to[-\s]market|competitive\s+advantage|moat|defensibility|competitor|Evinced|Siteimprove|AudioEye|accessiBe|Deque|Tenon|UserWay|EqualWeb|pricing\s+tier|paid\s+tier|Pro\s+tier|Enterprise\s+tier|freemium|revenue|ARR|MRR|TAM|SAM|SOM|MVP|launch\s+candidate|Scenario\s+[ABC]|v2\.1\s+lock|stakeholder|co-?founder|founding\s+team|grantee|grant-aligned|commit\s+plan|daily-piecemeal-push|commit\s+cadence)\b'

# §2.4-b — Grant / submission / deadline vocab (the actual gap that let
# «pre-NLnet-submission audit pass» through both the pre-commit hook and the
# gh-safe wrapper on 2026-05-20). SKILL.md §2.3 listed these tokens; the
# executable regex never enforced them. Now does.
GRANT_REGEX='\b(NLnet|NGI0|NGI[[:space:]]?Zero|Stichting|EU\s+AI\s+Act|Article\s+50|Article\s+7|EAA\s+2025|grant[[:space:]]submission|grant[[:space:]]deadline|grant[[:space:]]review|pre-NLnet|pre-submission|pre-submit|pre-launch|submission[[:space:]]window|review[[:space:]]window|Stage[[:space:]]?[12]|evaluator|reviewer\s+ask|Horizon\s+Europe|EUIPO\s+SME|EIC\s+Accelerator)\b'

# §2.5 — Internal automation / orchestration / dispatch vocab
# `orchestrator` only flagged when followed by «agent» / «dispatch» — architectural use allowed via allowlist
# `self-audit` only flagged when standalone — test names allowed via allowlist
AUTOMATION_REGEX='\b(subagent|orchestrator\s+(agent|dispatch|loop|sub-agent)|AI\s+orchestrator|dispatched|dispatching|batching|parallel\s+(agent|dispatch|task)|wave\s+[0-9]+|Wave-[0-9]+|build[-\s]from[-\s]scratch|self[-\s]audit\s+(loop|pattern|agent)|self[-\s]check|self[-\s]fix|autonomous\s+loop|autonomous\s+dispatch|Conventional\s+Commits\b|lint[-]staged|husky\s+(hook|pre-commit|commit-msg)|commitlint|turbo\s+cache|workspace[-\s]protocol|Skill\s+tool|skill\s+invocation|Claude\s+Code|Anthropic\s+(SDK|API)|sibling\s+agent|parent[-\s]session|sub[-\s]session|canonical\s+(branch|main|source)|internal\s+(repo|repository|monorepo|workspace|toolchain)|handoff)\b'

# ----- Run scans -----

echo "scanning range: $RANGE"
echo "total commits in range: $TOTAL_COMMITS"
echo

scan_category "Release-eng / CI / pipeline / testing-automation"  "$REL_ENG_REGEX"
scan_category "Agent codenames"                                    "$AGENT_REGEX"
scan_category "AI co-author / disclosure trailer"                  "$AI_TRAILER_REGEX"
scan_category "Patent codenames / USPTO numbers"                   "$PATENT_REGEX"
scan_category "Commercial domains"                                 "$COMMERCIAL_DOMAIN_REGEX"
scan_category "Internal coord paths / state files / module codes"  "$PATH_LEAK_REGEX"
scan_category "TODO / FIXME markers"                               "$TODO_REGEX"
scan_category "Activity-feed-specific"                             "$ACTIVITY_FEED_REGEX"
scan_category "Strategy / business / planning vocab"               "$STRATEGY_REGEX"
scan_category "Grant / submission / deadline vocab"                "$GRANT_REGEX"
scan_category "Internal automation / orchestration / dispatch"     "$AUTOMATION_REGEX"

# ----- Report -----

if [[ $HITS_FOUND -eq 0 ]]; then
  echo "✅ commit-message-discipline PASS — $RANGE is clean."
  exit 0
fi

echo "❌ commit-message-discipline FAIL — forbidden tokens in $HITS_FOUND category(ies):"
echo
echo "$REPORT"
echo "═══"
echo "Remediation per .claude/skills/commit-message-discipline/SKILL.md §4:"
echo "  - Single commit at HEAD: git commit --amend"
echo "  - Mid-range commit: git rebase -i <commit-before-bad>^ (change 'pick' to 'reword')"
echo "  - Replay-generated: edit scripts/replay-public-oss-repo.sh and full re-replay"
echo "  - Already pushed: amend + git push --force-with-lease + document in"
echo "    docs/internal/activity-feed-leaks-known.md as historical-leak record"

exit 1
