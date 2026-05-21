#!/usr/bin/env bash
# oss-ip-guard.sh — Pre-commit / pre-push IP boundary guard for OSS releases.
#
# Per legal/IP_AND_OSS_GOVERNANCE_FRAMEWORK.md §4.2.
#
# When committing to a public OSS repo (or to monorepo files destined for OSS),
# this script scans staged content for keywords / patterns that map to patented
# territory and BLOCKS the commit if any match.
#
# Authoritative source for negative-list keywords:
#   legal/IP_AND_OSS_GOVERNANCE_FRAMEWORK.md §4.1 + patents/draft-*/PATENT_*_*.md
#
# Usage (in adopta monorepo .husky/pre-commit):
#   if echo "$STAGED_FILES" | grep -qE "(rules-extended-public|packages/rules-axe)"; then
#     bash scripts/oss-ip-guard.sh --staged
#   fi
#
# Usage (in public OSS repo .husky/pre-commit, after copy from adopta):
#   bash scripts/oss-ip-guard.sh --staged
#
# Exit codes:
#   0 — clean (no negative-list matches)
#   1 — negative-list match found, commit blocked
#   2 — invocation error
#
# Author: MARKOWITZ — 2026-05-13

set -euo pipefail

MODE="${1:---staged}"

# ── Negative list — patent-territory tokens ──────────────────────────────────
# Per legal/IP_AND_OSS_GOVERNANCE_FRAMEWORK.md §4.1 + per-patent claim mapping.
# Keywords are case-insensitive. Whitespace inside tokens is treated literally.
# Add NEW entries here when filing new patents.

PATENT_TOKENS=(
  # Patent G — AI Attribution Audit (Application 64/009,864)
  "ai[- ]attribution"
  "human[- ]vs[- ]ai"
  "ai[- ]generated[- ]code[- ]detection"
  "llm[- ]author[- ]attribution"
  "ai[- ]commit[- ]forensics"

  # Patent A — Architect tier multi-agent compliance design (64/030,762)
  "multi[- ]agent[- ]compliance[- ]architect"
  "architect[- ]tier[- ]orchestrator"

  # Patent B — CI/CD gate semantic baseline (64/033,022)
  "ci[- ]gate[- ]baseline[- ]diff"
  "preexisting[- ]violation[- ]baseline"
  "wcag[- ]baseline[- ]diff"

  # Patent C — Specific algorithm (64/033,063)
  "canonical[- ]rule[- ]registry"
  "rule[- ]provenance[- ]graph"

  # Patent D — Canonical scoring (64/033,058)
  "canonical[- ]scoring"
  "cross[- ]rule[- ]confidence"
  "ariada[- ]canonical[- ]scoring"

  # Patent F — Autonomous PR generation (64/030,773)
  "autonomous[- ]pr[- ]generation"
  "autonomous[- ]remediation[- ]pull[- ]request"
  "source[- ]level[- ]autonomous[- ]fix"

  # Patent H — AIAS canonical registry (64/030,752)
  "aias[- ]canonical[- ]registry"
  "ai[- ]artifact[- ]inspection[- ]standard"

  # Patent J — Multi-domain scanner orchestration (64/022,466)
  "multi[- ]domain[- ]scanner[- ]orchestrator"
  "multi[- ]domain[- ]compliance[- ]fabric"

  # Patent K — Visualization / Dracula (64/030,731)
  "dracula[- ]visualization"
  "patent[- ]k[- ]renderer"

  # Internal monorepo imports — forbidden in OSS
  "@ariada-org/core"
  "@ariada-org/core-engine"
  "@ariada-org/core-browser"
  "@ariada-org/core-playwright"
  "@ariada-org/scan-backend"
  "@ariada-org/dracula-agent"
  "@ariada-org/scan-flow-ui"
  "from ['\"]@ariada-org/(core|core-engine|core-browser|core-playwright|scan-backend|dracula-agent|scan-flow-ui)"

  # Adopta monorepo absolute paths — forbidden
  "/Users/pedro/adopta/"
  "pedro@ariada\.ai"
)

# Whitelist contexts where mentions are OK (e.g. README mentions, doc references)
# Each entry is a regex applied to the FULL LINE. If a match line satisfies a
# whitelist regex AND a negative-list token, the match is suppressed.

WHITELIST_LINES=(
  # README and docs sections that explicitly reference patents (allowed)
  "(README|TRADEMARK|LICENSE|NOTICE|patent peace|patent pending)"
  # Markdown link references (allowed)
  "^\s*\["
  # Test fixtures (TODO — narrow as needed)
)

# ── Collect target file set ──────────────────────────────────────────────────

TARGET_FILES=""
if [[ "$MODE" == "--staged" ]]; then
  TARGET_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
elif [[ "$MODE" == "--all" ]]; then
  TARGET_FILES=$(git ls-files 2>/dev/null || true)
elif [[ "$MODE" == "--head" ]]; then
  TARGET_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
else
  echo "Usage: $0 [--staged | --all | --head]" >&2
  exit 2
fi

if [[ -z "$TARGET_FILES" ]]; then
  echo "ip-guard: no target files (mode=$MODE)"
  exit 0
fi

# Skip binary files and non-source files
TARGET_FILES=$(echo "$TARGET_FILES" | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|astro|json|md|mdx|yml|yaml|html|css|svg|astro|rs|py)$' || true)

if [[ -z "$TARGET_FILES" ]]; then
  echo "ip-guard: no source-file targets"
  exit 0
fi

# ── Build regex pattern ──────────────────────────────────────────────────────

# Build single regex alternation for grep -E -i
PATTERN=$(printf '%s|' "${PATENT_TOKENS[@]}")
PATTERN="${PATTERN%|}"

# ── Scan ──────────────────────────────────────────────────────────────────────

VIOLATIONS=0
echo "ip-guard: scanning $(echo "$TARGET_FILES" | wc -l | tr -d ' ') files for patent-territory tokens..."

while IFS= read -r FILE; do
  [[ -z "$FILE" ]] && continue
  [[ ! -f "$FILE" ]] && continue

  # Find matching lines
  MATCHES=$(grep -niE "$PATTERN" "$FILE" 2>/dev/null || true)
  [[ -z "$MATCHES" ]] && continue

  # Filter through whitelist
  while IFS= read -r MATCH_LINE; do
    [[ -z "$MATCH_LINE" ]] && continue

    SUPPRESSED=0
    for WL in "${WHITELIST_LINES[@]}"; do
      if echo "$MATCH_LINE" | grep -qE "$WL"; then
        SUPPRESSED=1
        break
      fi
    done

    if [[ $SUPPRESSED -eq 0 ]]; then
      VIOLATIONS=$((VIOLATIONS + 1))
      echo "  ❌ $FILE: $MATCH_LINE" >&2
    fi
  done <<< "$MATCHES"
done <<< "$TARGET_FILES"

# ── Report ───────────────────────────────────────────────────────────────────

if [[ $VIOLATIONS -gt 0 ]]; then
  echo "" >&2
  echo "ip-guard: ❌ $VIOLATIONS violation(s) found — commit BLOCKED" >&2
  echo "" >&2
  echo "These tokens map to patent-territory algorithms (per" >&2
  echo "legal/IP_AND_OSS_GOVERNANCE_FRAMEWORK.md §4.1) and may not appear" >&2
  echo "in OSS-bound code. Either:" >&2
  echo "  (a) remove the offending token (preferred)," >&2
  echo "  (b) move the affected file out of OSS scope, or" >&2
  echo "  (c) if the token is genuinely a non-patented usage, add a whitelist" >&2
  echo "      regex to WHITELIST_LINES in scripts/oss-ip-guard.sh." >&2
  echo "" >&2
  echo "If unsure, escalate to founder + IP attorney review." >&2
  exit 1
fi

echo "ip-guard: ✅ all clean"
exit 0
