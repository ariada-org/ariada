#!/usr/bin/env bash
# audit-patent-coverage.sh — Pre-deploy false-marking coverage audit.
#
# Replaces (deferred) Patentanwalt review for the routine pre-deploy
# gate by mechanically asserting that EVERY user-facing file under
# apps/*/src/**/*.{astro,mdx,html} that mentions "patent" / "USPTO" /
# "provisional" / a USPTO application number is wrapped in a
# `data-patent-disclosure` block (with sibling `data-patent-fallback`)
# OR explicitly allow-listed via an inline annotation.
#
# Rules implemented (BLOCKING per .claude/skills/content-audit-legal/
# SKILL.md v0.4 §4 Group A):
#
#   A-11  Coverage  — any leak file must use wrapper OR annotation.
#   A-12  Middleware — every site shipping HTML w/ patent text must
#                       have apps/<site>/functions/_middleware.ts that
#                       references data-patent-disclosure handler.
#   A-13  Fallback  — every data-patent-disclosure element MUST have
#                       a sibling data-patent-fallback attribute (empty
#                       fallback is OK, missing is fail).
#   A-14  Elevated  — bare USPTO app numbers (64/0XX,XXX) outside the
#                       wrapper trigger ELEVATED severity even on
#                       Tier-1 pages. Falls back to A-11 fail.
#
# Allowlist annotation forms (file is exempted from A-11 if it contains
# any of):
#   1. HTML comment:  <!-- patent-audit-skip: <reason> -->
#   2. JS/Astro frontmatter export: `export const patentAuditSkip = true`
#   3. Astro frontmatter prop in JSON-like form: `patentAuditSkip: true`
#
# Exit codes:
#   0 — pass (no leaks, all wrapped sites have middleware)
#   1 — fail (BLOCK violations found; report printed to stdout)
#   2 — script invocation error (bad cwd, missing tools)
#
# Usage:
#   bash scripts/audit-patent-coverage.sh                        # all apps
#   bash scripts/audit-patent-coverage.sh apps/ariada-web        # one app
#   bash scripts/audit-patent-coverage.sh --json                 # JSON out
#
# Source-of-truth: .claude/skills/content-audit-legal/SKILL.md §4 Group A
# (rules A-11..A-14), §5 (regex), §6 (per-site matrix). Tested under
# bash 5 on macOS + Linux CI (ubuntu-22.04 runner).
#
# Author: human-authored maintenance script (Agonist Development AB).

set -euo pipefail

# ------- knobs -----------------------------------------------------

# The "patent text" regex — files matching this anywhere in their body
# are subject to A-11/A-13 coverage rules. Word-boundaries used so the
# phrase "no patent ties" (a SAFE phrase) does NOT trigger the leak
# detector on its own — but the regex is OR'd so the file fails if
# ANY of the four sub-patterns hit.
PATENT_REGEX='\bpatent\b|\bUSPTO\b|\bprovisional\b|\b64/0[0-9]{2},[0-9]{3}\b'

# A-15: commercial-domain leak detection. Public OSS surface must not
# reference commercial / closed-axis domains (ariada.ai / blamer.ai /
# clamper.ai / reverter.ai / draculascan.com / *.ariada.ai subdomains).
# Per `.claude/rules/no-commercial-crosspromo-in-oss` BLOCKING rule.
# Operational emails like security@ariada.ai are EXEMPT (per
# HUMAN_AUTHORSHIP_POLICY noreply alias). The regex deliberately
# matches the domain WITHOUT a preceding `@` so emails pass through.
COMMERCIAL_DOMAIN_REGEX='(^|[^@a-zA-Z0-9])(ariada\.ai|blamer\.ai|clamper\.ai|reverter\.ai|draculascan\.com|backend\.ariada\.ai|docs\.ariada\.ai|app\.ariada\.ai|wcag\.ariada\.ai)([^a-zA-Z0-9]|$)'

# The "bare USPTO app number" regex for A-14 elevated severity.
BARE_APP_NUMBER_REGEX='\b64/0[0-9]{2},[0-9]{3}\b'

# Wrapper / allow-list marker regex — file is "covered" if it contains
# the disclosure wrapper attribute OR an allow-list annotation.
COVERED_REGEX='data-patent-disclosure|patent-audit-skip|patentAuditSkip'

# Site directory pattern under apps/ (relative paths). We only audit
# .astro / .mdx / .html source under */src/ — never under */dist/,
# */node_modules/, */functions/ (functions hold middleware, not copy).
SITES_GLOB='apps/*/src'

# ------- runtime ---------------------------------------------------

# Resolve repo root from script location.
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." &>/dev/null && pwd)
cd "$REPO_ROOT"

JSON_MODE=0
STAGED_MODE=0
SCOPE=()
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=1 ;;
    --staged)
      # Pre-commit mode: scan only files currently in git index (staged for
      # commit) instead of the full A15_PUBLIC_SCOPE. This catches new
      # forbidden tokens at commit time without paying the cost of a full
      # workspace scan + without tripping on legacy leaks the current
      # commit did not introduce.
      STAGED_MODE=1
      ;;
    -h|--help)
      sed -n '2,50p' "$0"
      exit 0
      ;;
    *) SCOPE+=("$arg") ;;
  esac
done

if (( STAGED_MODE == 1 )); then
  # --staged: scan only files in git index (staged for commit). Override both
  # SCOPE (used by A-11..A-14) and A15_PUBLIC_SCOPE (used by A-15..A-16) with
  # the staged file list. Filters A/C/M/R to skip deletes.
  #
  # Internal-only file filter — files that describe the discipline (CLAUDE.md,
  # .claude/rules/*, docs/internal/, etc.) MUST NOT be vocab-scanned. They
  # legitimately contain the forbidden tokens as the very vocabulary the
  # public-OSS gates exclude. Mirror the dir list from the daily-piecemeal-push
  # rule §5 internal/public filter plus root state files.
  #
  # `mapfile` is bash 4+; macOS still ships bash 3.2 in /bin/bash. Use a
  # 3.2-compatible read loop instead.
  STAGED_INTERNAL_ONLY_REGEX='^(product/|grants/|legal/|docs/internal/|docs/session-logs/|docs/audits/|docs/research/|strategy/|brand/|research/|patents/|patentomania/|\.claude/|\.factory/|\.agents/|CLAUDE\.md$|HANDOFF\.md$|OPEN_QUESTIONS\.md$|MEMORY\.md$)'
  _STAGED_FILES=()
  while IFS= read -r _staged_line; do
    [[ -z "$_staged_line" ]] && continue
    if [[ "$_staged_line" =~ $STAGED_INTERNAL_ONLY_REGEX ]]; then
      continue  # internal-only file — describes the discipline, not subject to it
    fi
    _STAGED_FILES+=("$_staged_line")
  done < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
  if (( ${#_STAGED_FILES[@]} == 0 )); then
    echo "[audit] --staged: no public-eligible files in staged set (internal-only files filtered out). PASS."
    exit 0
  fi
  SCOPE=("${_STAGED_FILES[@]}")
  A15_PUBLIC_SCOPE=("${_STAGED_FILES[@]}")
fi

if [[ ${#SCOPE[@]} -eq 0 ]]; then
  # Default: every apps/*/src and apps/*/functions present.
  while IFS= read -r dir; do
    SCOPE+=("$dir")
  done < <(find apps -mindepth 2 -maxdepth 2 -type d -name src -not -path '*/node_modules/*' 2>/dev/null | sort)
fi

# ------- collect leak files ----------------------------------------

# Find every .astro / .mdx / .html file under scope that mentions
# patent text. Exclude .wrangler, dist, node_modules.
LEAK_CANDIDATES=()
if (( ${#SCOPE[@]} > 0 )); then
  while IFS= read -r f; do
    LEAK_CANDIDATES+=("$f")
  done < <(
    grep -rlE "$PATENT_REGEX" "${SCOPE[@]}" \
      --include='*.astro' --include='*.mdx' --include='*.html' \
      2>/dev/null \
      | grep -v '/node_modules/' \
      | grep -v '/dist/' \
      | grep -v '/.wrangler/' \
      || true
  )
fi

# ------- classify --------------------------------------------------

COVERED=()
UNCOVERED=()
ALLOWLISTED=()
FALLBACK_MISSING=()
BARE_APP_NUMBER=()
COMMERCIAL_LEAK=()

# Allowlist marker — file is allow-listed (not requiring wrapper) if it
# carries one of these annotations. A-11 still passes; A-12 (site
# middleware) is also relaxed for sites where ALL leak files are
# allow-listed (no rendered patent text → no middleware required for
# false-marking protection, though sites may still ship middleware
# for future-proofing).
ALLOWLIST_REGEX='patent-audit-skip|patentAuditSkip[[:space:]]*[:=]'
# Wrapper marker — file uses data-patent-disclosure as an HTML attribute
# (NOT merely the word in a JSDoc/HTML comment). Pre-filter: lines
# starting with `*` (JSDoc/JSX comment continuation), `//` (line
# comment), or `<!--` (HTML comment opener) are stripped before counting.
WRAPPER_REGEX='data-patent-disclosure[[:space:]]*='
FALLBACK_REGEX='data-patent-fallback[[:space:]]*='
# Lines to exclude from wrapper/fallback counting (comment context).
COMMENT_LINE_REGEX='^[[:space:]]*(\*|//|<!--|#)'

for f in "${LEAK_CANDIDATES[@]:-}"; do
  [[ -z "$f" ]] && continue
  has_wrapper=0
  has_allowlist=0
  # Strip comment lines before testing wrapper presence so JSDoc / HTML
  # comments mentioning `data-patent-disclosure` (as documentation prose)
  # don't false-positive into "covered".
  if grep -vE "$COMMENT_LINE_REGEX" "$f" | grep -qE "$WRAPPER_REGEX"; then
    has_wrapper=1
  fi
  if grep -qE "$ALLOWLIST_REGEX" "$f"; then
    has_allowlist=1
  fi

  if [[ "$has_wrapper" -eq 1 ]]; then
    COVERED+=("$f")
    # A-13: every data-patent-disclosure attribute must have a sibling
    # data-patent-fallback attribute. Count from the comment-stripped
    # view to avoid JSDoc inflation.
    STRIPPED=$(grep -vE "$COMMENT_LINE_REGEX" "$f")
    DISC=$(echo "$STRIPPED" | grep -cE "$WRAPPER_REGEX" || true)
    FALL=$(echo "$STRIPPED" | grep -cE "$FALLBACK_REGEX" || true)
    if [[ "$DISC" -gt 0 && "$FALL" -lt "$DISC" ]]; then
      FALLBACK_MISSING+=("$f")
    fi
  elif [[ "$has_allowlist" -eq 1 ]]; then
    ALLOWLISTED+=("$f")
  else
    UNCOVERED+=("$f")
  fi
  # A-14: bare app number anywhere outside a wrapper. Allowlisted files
  # are exempt by definition (operator-asserted-safe). Files that have
  # a wrapper are also exempt — the wrapper covers the bare number.
  # Strip comment lines before checking so JSDoc references like
  # "* Patent: USPTO provisional application No. 64/030,752" don't
  # false-positive (these are maintainer notes, not rendered HTML).
  if grep -vE "$COMMENT_LINE_REGEX" "$f" | grep -qE "$BARE_APP_NUMBER_REGEX"; then
    if [[ "$has_wrapper" -eq 0 && "$has_allowlist" -eq 0 ]]; then
      BARE_APP_NUMBER+=("$f")
    fi
  fi
done

# ------- A-12: middleware presence per site with patent text -------
#
# A site requires middleware IFF it has at least one wrapper-using or
# uncovered file (rendered patent text exists). Sites whose ONLY leak
# files are allow-listed (operator-asserted-safe via patent-audit-skip)
# are exempt — the audit operator has certified those mentions are not
# rendered or otherwise unreachable by DE/JP/FR/CN visitors.

declare -a SITES_WITH_PATENT=()
declare -a SITES_MISSING_MIDDLEWARE=()
declare -a SITES_MIDDLEWARE_BROKEN=()

# Combine COVERED + UNCOVERED (i.e., everything except ALLOWLISTED).
for f in "${COVERED[@]:-}" "${UNCOVERED[@]:-}"; do
  [[ -z "$f" ]] && continue
  # Path looks like apps/<site>/src/...
  site=$(echo "$f" | awk -F/ '{print $2}')
  [[ -z "$site" ]] && continue
  if [[ ! " ${SITES_WITH_PATENT[*]:-} " =~ " ${site} " ]]; then
    SITES_WITH_PATENT+=("$site")
  fi
done

for site in "${SITES_WITH_PATENT[@]:-}"; do
  # Empty-string iteration sneaks in when SITES_WITH_PATENT is empty and
  # `${arr[@]:-}` expands to a single empty token under set -u. Guard
  # against it so we don't synthesise an `apps//functions/_middleware.ts`
  # false positive.
  [[ -z "$site" ]] && continue
  mw="apps/$site/functions/_middleware.ts"
  if [[ ! -f "$mw" ]]; then
    SITES_MISSING_MIDDLEWARE+=("$site")
    continue
  fi
  if ! grep -q 'data-patent-disclosure' "$mw"; then
    SITES_MIDDLEWARE_BROKEN+=("$site")
  fi
done

# ------- A-15: commercial-domain leak detection ---------------------
#
# Public OSS surface (.astro / .mdx / .md / .html) MUST NOT reference
# commercial / closed-axis domains. Operational email aliases like
# security@ariada.ai are EXEMPT (preceding `@` excluded from regex).
# Per `.claude/rules/no-commercial-crosspromo-in-oss` BLOCKING rule
# (`memory/feedback_no_commercial_crosspromo_in_oss.md`).

# A-15 PUBLIC-OSS ALLOWLIST: apps + dirs that DO push to public ariada-org/ariada
# repo and therefore MUST NOT reference commercial domains. Commercial apps
# (ariada-web, marketing-*, scanner-agonist) are intentionally EXCLUDED from
# the public-push filter per .claude/rules/daily-piecemeal-push.md §5 and may
# legitimately reference commercial domains in their internal copy.
A15_PUBLIC_SCOPE=(
  "packages/ariada-ai-authorship"
  "packages/ariada-anti-overlay"
  "packages/ariada-brand-tokens"
  "packages/ariada-evidence-emitter"
  "packages/ariada-multi-domain"
  "packages/ariada-penalty-estimator"
  "packages/ariada-statement-generator"
  "packages/ariada-test-fixtures"
  "packages/eaa-pipeline"
  "packages/wcag-rules-extended"
  "packages/core-engine"
  "packages/core-browser"
  "packages/core-playwright"
  "packages/scan-report-html"
  "packages/ariada-vpat-html-renderer"
  "packages/ariada-cli"
  "packages/ariada-mcp-server"
  "packages/ariada-test-adapters"
  "packages/ariada-diff-schema"
  "packages/ariada-diff-stub"
  "packages/ariada-diff-action"
  "README.md"
  "CONTRIBUTING.md"
  "SECURITY.md"
  "CODE_OF_CONDUCT.md"
  "MAINTAINERS.md"
  "TRADEMARK.md"
  "ROADMAP.md"
)

# --staged override: replace the public-OSS scope with the staged file list
# so A-15 + A-16 scan only the index. The earlier override (right after arg
# parse) sets SCOPE for A-11..A-14; this second override is needed because
# the array literal above unconditionally re-initialises A15_PUBLIC_SCOPE.
if (( STAGED_MODE == 1 )); then
  A15_PUBLIC_SCOPE=("${_STAGED_FILES[@]}")
fi

# A-15 exempt-files regex: files that legitimately mention the «Ariada» mark
# (trademark declarations, copyright notices, brand-policy docs). Pattern is
# anchored to basename. Listed once so reviewers can easily expand the list.
A15_EXEMPT_BASENAME='^(TRADEMARK|NOTICE|LICENSE|CHANGELOG)\.md$'

# A-15 proprietary-package exclusion: package paths inside packages/ that are
# NOT pushed to the public ariada-org/ariada repo per Scenario C
# (architecture pivot 2026-04-27) + filter discipline §5
# of the daily-piecemeal-push project rule. They legitimately reference
# commercial domains in their internal copy.
A15_INTERNAL_PATH_REGEX='^packages/(scan-backend|scan-flow-ui|embed-badge|extension-chrome|dracula-agent|ariada-vpat-html-renderer|ariada-cli|scan-report-html|core-engine|core-browser|core-playwright)(/|$)'

# Source-of-truth scripts exempt — used by BOTH A-15 and A-16. These files
# contain forbidden tokens or commercial-domain references INSIDE regex
# literals because they define the gates. Each entry has a documented
# rationale:
#
#   audit-patent-coverage.sh — defines forbidden regex literals (this script)
#   check-commit-messages.sh — defines forbidden regex literals
#   oss-ip-guard.sh × 2     — IP-guard scripts that intentionally enumerate
#                               every filed patent code by purpose
#   sync-canonical-to-public.sh — sync filter that enumerates internal-path
#                                 prefixes to strip
#   replay-public-oss-repo.sh   — replay filter that enumerates state files
#                                 (HANDOFF.md / OPEN_QUESTIONS.md / etc.)
#                                 to exclude
#   plan-prd-batch.sh       — dispatch tool whose prompt-template body
#                               literally enumerates the forbidden tokens
#                               as instructions for sub-tasks
#
# Exempt files are completely skipped for ALL A-15 / A-16 token classes.
# Audit every exempt addition for whether the file truly cannot be scrubbed.
A16_EXEMPT_FULLPATH_REGEX='^(scripts/audit-patent-coverage\.sh|scripts/check-commit-messages\.sh|scripts/oss-ip-guard\.sh|scripts/sync-canonical-to-public\.sh|scripts/replay-public-oss-repo\.sh|scripts/plan-prd-batch\.sh|packages/wcag-rules-extended/scripts/oss-ip-guard\.sh)$'

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  # Skip exempt basename files
  if [[ "$(basename "$f")" =~ $A15_EXEMPT_BASENAME ]]; then continue; fi
  # Skip proprietary-package paths (not in public push)
  if [[ "$f" =~ $A15_INTERNAL_PATH_REGEX ]]; then continue; fi
  # Skip source-of-truth scripts whose body contains forbidden-token regex
  # literals (audit + commit-message scanners, IP-guard enumerators, sync
  # filters). Same list used by A-16. Defined later in the script — guard
  # the lookup so we don't trip on an unset variable here.
  if [[ -n "${A16_EXEMPT_FULLPATH_REGEX:-}" && "$f" =~ ${A16_EXEMPT_FULLPATH_REGEX} ]]; then continue; fi
  # Strip comment lines + accept ONLY @ariada.org / @blamer.org / @clamper.org /
  # @reverter.org / @draculascan.org emails as exempt operational aliases.
  # @ariada.ai / @blamer.ai / @clamper.ai / @reverter.ai / @draculascan.com
  # variants ARE the leak we want to catch (per oss-docs-discipline §2.4).
  matched=$(grep -nE "$COMMERCIAL_DOMAIN_REGEX" "$f" 2>/dev/null \
    | grep -vE "$COMMENT_LINE_REGEX" \
    | grep -vE '[a-zA-Z0-9._%-]+@(ariada\.org|blamer\.org|clamper\.org|reverter\.org|draculascan\.org)' \
    || true)
  if [[ -n "$matched" ]]; then
    COMMERCIAL_LEAK+=("$f")
  fi
done < <(
  for p in "${A15_PUBLIC_SCOPE[@]}"; do
    if [[ -d "$p" ]]; then
      find "$p" \( \
          -name '*.astro' -o -name '*.mdx' -o -name '*.md' -o -name '*.html' \
          -o -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' \
          -o -name '*.mjs' -o -name '*.cjs' -o -name '*.css' \
        \) \
        -not -path '*/node_modules/*' \
        -not -path '*/dist/*' \
        -not -path '*/.wrangler/*' \
        -not -path '*/.astro/*' \
        -not -path '*/.turbo/*' \
        -not -path '*/coverage/*' \
        -not -path '*/reports/mutation/*' \
        -not -path '*/test-results/*' \
        -not -path '*/playwright-report/*' \
        -not -path '*/.stryker-tmp/*' \
        -not -path '*/.output/*' \
        -not -path '*/.next/*' \
        -not -path '*/.vercel/*' \
        -not -path '*/tests/fixtures/*' \
        -not -path '*/tests/integration/test-results/*' \
        2>/dev/null
    elif [[ -f "$p" ]]; then
      echo "$p"
    fi
  done
)

# ------- A-16: forbidden-tokens scan -------------------------------
#
# Per `.claude/rules/oss-docs-discipline.md` §2: any of the listed forbidden
# tokens in a file that lands in the public replay output is a hard fail.
# This gate scans the SAME public-OSS scope used by A-15.
#
# Token classes (mapped to severity by which array catches the match):
#   CRITICAL  — PRD path leak / GAP_AUDIT path / internal-monorepo refs
#   HIGH      — patent letter codenames / agent codenames / patent-binding JSDoc
#   MEDIUM    — OQ-* / M[0-9]+-[0-9]+ module codes / Wave-N planning
#   LOW       — TODO PEDRO / TODO Bricskin authoring leaks
#
# Each is reported file:line:matched-pattern.

declare -a A16_CRITICAL=()
declare -a A16_HIGH=()
declare -a A16_MEDIUM=()
declare -a A16_LOW=()

# Path leaks (CRITICAL) — bare path prefixes that indicate internal artefacts
# escaped into the public surface. Must NOT match URL paths to legitimate OSS
# docs (e.g. https://example.com/research/foo). Anchor by word-boundary +
# start-of-line / non-URL context.
A16_PATH_LEAKS='(^|[^a-zA-Z0-9/])(product/plans/|grants/|legal/IP_AND_OSS_GOVERNANCE|docs/internal/|docs/session-logs/|strategy/|patentomania/|\.claude/|/Users/[a-zA-Z]+/)'

# Internal coordination terms (MEDIUM)
A16_INTERNAL_COORD='(\bHANDOFF\.md\b|\bOPEN_QUESTIONS\.md\b|\bMEMORY\.md\b|\bOQ-[A-Z0-9-]+\b|\bWave-[0-9]+ (polish|deferred|hot|cold)\b|\bagent-[a-f0-9]{8,}\b|\bworktree-agent-[a-f0-9]+\b)'

# Patent letter codenames (HIGH) — only when used as portfolio refs like
# «Patent G», «Patent K v0.5», «Patents A-K», «Patent J+H bound». Word-bounded.
A16_PATENT_CODENAMES='\bPatent[s]?[[:space:]]+[A-K]\b|\bPatent[s]?[[:space:]]+[A-K][[:space:]]*[-/+][[:space:]]*[A-K]\b|\bPatent[s]?[[:space:]]+[A-K][[:space:]]+v[0-9]'

# Patent-binding JSDoc (HIGH)
A16_PATENT_BINDING='@patentBinding\('

# Agent scientist-name codenames in [NAME] commit prefix or standalone (HIGH).
# Anchor on the `[NAME]` form to avoid false-positives on legitimate proper
# nouns appearing in prose. Single agent name as bracket prefix only.
A16_AGENT_CODENAMES='\[(GAUSS|NOETHER|ARCHIMEDES|EULER|RIEMANN|GALOIS|LEIBNIZ|PASCAL|CURIE|HUYGENS|LAGRANGE|FERMAT|WEIERSTRASS|RAMANUJAN|DIRAC|FEYNMAN|EINSTEIN|NEWTON|TURING|HILBERT|PLATO|LAPLACE|YUKAWA|BOHR|STOKES|NASH|HUBBLE|POINCARE|POYNTING|HYPATIA|DIRICHLET)\]'

# AI co-author and AI-disclosure leaks (HIGH)
A16_AI_DISCLOSURE='Co-Authored-By:[[:space:]]+Claude|Drafted with AI assistance|Generated with .*Claude|AI-assisted (drafting|review|generation)'

# Authoring TODO leaks (LOW)
A16_TODO_LEAKS='TODO[[:space:]]+(PEDRO|Bricskin|Pedro Pomerantsev):'

# Internal milestone codes M[0-9]+-[0-9]+ (MEDIUM) — module-numbering scheme.
# Anchor on standalone tokens to avoid false positives on M1 in URLs etc.
# We only catch the form like «M5-2» / «β-2» as inline annotations.
A16_MILESTONE_CODES='\bM[0-9]+-[0-9]+\b|\bβ-[0-9]+\b'

# Internal-review vocabulary (HIGH) — specific phrasings that read as
# internal AI-orchestration jargon to an outside reader. «subagent» is the
# strong giveaway and triggers on its own. «Stage 1/2» is only flagged in
# combination with unambiguously-internal companion words (peer-review /
# dispatch / re-dispatch / re-audit / subagent), not with words that are
# common in legitimate OSS prose (review / reviewer / audit / finding /
# verdict). Reason: README.md and other public docs legitimately
# reference NLnet's Stage 1 / Stage 2 grant-review process — those uses
# must pass.
#
# Pattern handles known orthographic variants:
#   [Ss]ub-?agent       — subagent / Subagent / sub-agent / Sub-agent
#   [Ss]tage[[:space:]-]+[12]  — Stage 1 / stage 1 / Stage-1 / stage-1
A16_REVIEW_VOCAB='\b[Ss]ub-?agent[s]?\b|\b[Ss]tage[[:space:]-]+[12][[:space:]-]+(peer-review|dispatch|re-dispatch|re-audit|subagent|sub-agent)'

# Internal-memory file references (CRITICAL) — bare references to
# ~/.claude/projects/.../memory/feedback_*.md files. These paths do not
# exist in public clones, and the file basenames give away the internal
# coordination layer. Public-facing files should reference policy docs
# under .claude/rules/ or docs/policies/ instead.
A16_INTERNAL_MEMORY='\bfeedback_[a-z_]+\.md\b|~/\.claude/projects/|(^|[^a-zA-Z0-9/])memory/feedback_'

# A16 exempt files — same as A-15 (TRADEMARK / NOTICE / LICENSE / CHANGELOG).
# AND additionally exempt: IP_NEGATIVE_LIST.md may legitimately list
# patent-territory tokens (group headings). Apply only to A-16 patent regex.
A16_EXEMPT_BASENAME='^(TRADEMARK|NOTICE|LICENSE|CHANGELOG|IP_NEGATIVE_LIST)\.md$'

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  basename_f=$(basename "$f")
  is_exempt=0
  if [[ "$basename_f" =~ $A16_EXEMPT_BASENAME ]]; then is_exempt=1; fi
  # Full-path exempt: files with documented legitimate reason to contain
  # forbidden vocab (source-of-truth regex definitions, IP-guard enumerations,
  # sync-filter path lists, prompt-template emitters). Skip ALL token classes.
  if [[ "$f" =~ $A16_EXEMPT_FULLPATH_REGEX ]]; then continue; fi
  # Proprietary-package paths are exempted from A-15 already; carry same exemption
  if [[ "$f" =~ $A15_INTERNAL_PATH_REGEX ]]; then continue; fi

  # Each token class — record file:line:pattern on hit
  # CRITICAL — path leaks + internal-memory references
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_CRITICAL+=("$f:$match")
  done < <(grep -nE "$A16_PATH_LEAKS" "$f" 2>/dev/null \
    | grep -vE "$COMMENT_LINE_REGEX" || true)
  # Internal-memory references — intentionally DO NOT filter comment lines.
  # The leak vector here is exactly header doc-block comments like
  # «# per feedback_always_audit_before_merge.md», so excluding comments
  # would defeat the purpose.
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_CRITICAL+=("$f:$match")
  done < <(grep -nE "$A16_INTERNAL_MEMORY" "$f" 2>/dev/null || true)

  # HIGH — patent codenames + binding + agent codenames + AI disclosure +
  # internal-review vocabulary
  # Patent codenames are exempt in TRADEMARK/NOTICE/LICENSE/CHANGELOG/IP_NEGATIVE_LIST
  if [[ "$is_exempt" -eq 0 ]]; then
    while IFS= read -r match; do
      [[ -n "$match" ]] && A16_HIGH+=("$f:$match")
    done < <(grep -nE "$A16_PATENT_CODENAMES" "$f" 2>/dev/null \
      | grep -vE "$COMMENT_LINE_REGEX" || true)
  fi
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_HIGH+=("$f:$match")
  done < <(grep -nE "$A16_PATENT_BINDING|$A16_AGENT_CODENAMES|$A16_AI_DISCLOSURE" "$f" 2>/dev/null \
    | grep -vE "$COMMENT_LINE_REGEX" || true)
  # Review vocabulary — same comment-line reasoning as internal-memory:
  # «# Stage 1 peer-review subagent» in script headers IS the leak.
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_HIGH+=("$f:$match")
  done < <(grep -nE "$A16_REVIEW_VOCAB" "$f" 2>/dev/null || true)

  # MEDIUM — internal coordination + module codes
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_MEDIUM+=("$f:$match")
  done < <(grep -nE "$A16_INTERNAL_COORD|$A16_MILESTONE_CODES" "$f" 2>/dev/null \
    | grep -vE "$COMMENT_LINE_REGEX" || true)

  # LOW — TODO leaks
  while IFS= read -r match; do
    [[ -n "$match" ]] && A16_LOW+=("$f:$match")
  done < <(grep -nE "$A16_TODO_LEAKS" "$f" 2>/dev/null || true)
done < <(
  for p in "${A15_PUBLIC_SCOPE[@]}"; do
    if [[ -d "$p" ]]; then
      find "$p" \( \
          -name '*.astro' -o -name '*.mdx' -o -name '*.md' -o -name '*.html' \
          -o -name '*.tsx' -o -name '*.ts' -o -name '*.jsx' -o -name '*.js' \
          -o -name '*.mjs' -o -name '*.cjs' -o -name '*.yml' -o -name '*.yaml' \
          -o -name '*.sh' -o -name 'pre-push' -o -name 'pre-commit' \
          -o -name 'commit-msg' -o -name 'post-checkout' -o -name 'post-commit' \
          -o -name 'post-merge' \
        \) \
        -not -path '*/node_modules/*' \
        -not -path '*/dist/*' \
        -not -path '*/.wrangler/*' \
        -not -path '*/.astro/*' \
        -not -path '*/.turbo/*' \
        -not -path '*/coverage/*' \
        -not -path '*/reports/mutation/*' \
        -not -path '*/test-results/*' \
        -not -path '*/playwright-report/*' \
        -not -path '*/.stryker-tmp/*' \
        -not -path '*/.output/*' \
        -not -path '*/.next/*' \
        -not -path '*/.vercel/*' \
        -not -path '*/tests/fixtures/*' \
        -not -path '*/tests/integration/test-results/*' \
        2>/dev/null
    elif [[ -f "$p" ]]; then
      echo "$p"
    fi
  done
)

# ------- report ----------------------------------------------------

fail=0
total_leak=${#LEAK_CANDIDATES[@]}
total_uncovered=${#UNCOVERED[@]}
total_covered=${#COVERED[@]}
total_allowlisted=${#ALLOWLISTED[@]}
total_fallback_missing=${#FALLBACK_MISSING[@]}
total_missing_mw=${#SITES_MISSING_MIDDLEWARE[@]}
total_broken_mw=${#SITES_MIDDLEWARE_BROKEN[@]}
total_bare=${#BARE_APP_NUMBER[@]}
total_commercial=${#COMMERCIAL_LEAK[@]}
total_a16_critical=${#A16_CRITICAL[@]}
total_a16_high=${#A16_HIGH[@]}
total_a16_medium=${#A16_MEDIUM[@]}
total_a16_low=${#A16_LOW[@]}

if [[ "$JSON_MODE" -eq 1 ]]; then
  printf '{\n'
  printf '  "total_files_scanned": %d,\n' "$total_leak"
  printf '  "files_uncovered": [\n'
  for ((i = 0; i < ${#UNCOVERED[@]}; i++)); do
    sep=$([ "$i" -lt $((total_uncovered - 1)) ] && echo "," || echo "")
    printf '    "%s"%s\n' "${UNCOVERED[i]}" "$sep"
  done
  printf '  ],\n'
  printf '  "files_fallback_missing": [\n'
  for ((i = 0; i < ${#FALLBACK_MISSING[@]}; i++)); do
    sep=$([ "$i" -lt $((total_fallback_missing - 1)) ] && echo "," || echo "")
    printf '    "%s"%s\n' "${FALLBACK_MISSING[i]}" "$sep"
  done
  printf '  ],\n'
  printf '  "sites_missing_middleware": [\n'
  for ((i = 0; i < ${#SITES_MISSING_MIDDLEWARE[@]}; i++)); do
    sep=$([ "$i" -lt $((total_missing_mw - 1)) ] && echo "," || echo "")
    printf '    "%s"%s\n' "${SITES_MISSING_MIDDLEWARE[i]}" "$sep"
  done
  printf '  ],\n'
  printf '  "verdict": "%s"\n' "$([[ "$total_uncovered" -gt 0 || "$total_fallback_missing" -gt 0 || "$total_missing_mw" -gt 0 || "$total_broken_mw" -gt 0 ]] && echo FAIL || echo PASS)"
  printf '}\n'
else
  echo "================================================================"
  echo "  Patent-Coverage + OSS-Docs Audit (A-11..A-16)"
  echo "================================================================"
  echo "Scope: ${SCOPE[*]:-<empty>}"
  echo "Files scanned with patent text: $total_leak"
  echo "  - covered (wrapper):          $total_covered"
  echo "  - allow-listed (annotation):  $total_allowlisted"
  echo "  - uncovered (BLOCK):          $total_uncovered"
  echo "Sites requiring middleware:     ${#SITES_WITH_PATENT[@]} (${SITES_WITH_PATENT[*]:-none})"
  echo ""
  if [[ "$total_uncovered" -gt 0 ]]; then
    echo "[A-11] FAIL — files with patent text but no wrapper/allowlist:"
    for f in "${UNCOVERED[@]}"; do echo "  $f"; done
    fail=1
  else
    echo "[A-11] PASS — every leak file is wrapped or allow-listed."
  fi
  echo ""
  if [[ "$total_missing_mw" -gt 0 ]]; then
    echo "[A-12] FAIL — sites missing functions/_middleware.ts:"
    for s in "${SITES_MISSING_MIDDLEWARE[@]}"; do echo "  apps/$s/functions/_middleware.ts"; done
    fail=1
  elif [[ "$total_broken_mw" -gt 0 ]]; then
    echo "[A-12] FAIL — middleware does not handle data-patent-disclosure:"
    for s in "${SITES_MIDDLEWARE_BROKEN[@]}"; do echo "  apps/$s/functions/_middleware.ts"; done
    fail=1
  else
    echo "[A-12] PASS — every site with patent text has wired middleware."
  fi
  echo ""
  if [[ "$total_fallback_missing" -gt 0 ]]; then
    echo "[A-13] FAIL — data-patent-disclosure without matching data-patent-fallback:"
    for f in "${FALLBACK_MISSING[@]}"; do echo "  $f"; done
    fail=1
  else
    echo "[A-13] PASS — every wrapped element has fallback sibling."
  fi
  echo ""
  if [[ "$total_bare" -gt 0 ]]; then
    echo "[A-14] WARN — bare USPTO app numbers outside wrapper (elevated severity):"
    for f in "${BARE_APP_NUMBER[@]}"; do echo "  $f"; done
    # A-14 is folded into A-11 fail; printed as WARN for visibility.
  else
    echo "[A-14] PASS — no bare USPTO app numbers outside wrapper."
  fi
  echo ""
  if [[ "$total_commercial" -gt 0 ]]; then
    echo "[A-15] FAIL — commercial-domain references in public OSS surface:"
    for f in "${COMMERCIAL_LEAK[@]}"; do echo "  $f"; done
    fail=1
  else
    echo "[A-15] PASS — no commercial-domain leak (ariada.ai/blamer.ai/clamper.ai/reverter.ai/draculascan.com etc.) in public surface."
  fi
  echo ""
  # ----- A-16: forbidden tokens -----
  a16_fail=0
  if [[ "$total_a16_critical" -gt 0 ]]; then
    echo "[A-16] FAIL (CRITICAL) — internal path / framework leaks in public OSS surface:"
    for m in "${A16_CRITICAL[@]}"; do echo "  $m"; done
    a16_fail=1
  fi
  if [[ "$total_a16_high" -gt 0 ]]; then
    echo "[A-16] FAIL (HIGH) — patent codenames / agent codenames / AI co-author / patent-binding:"
    for m in "${A16_HIGH[@]}"; do echo "  $m"; done
    a16_fail=1
  fi
  if [[ "$total_a16_medium" -gt 0 ]]; then
    echo "[A-16] FAIL (MEDIUM) — internal coordination (OQ-* / HANDOFF / Wave-N / module codes):"
    for m in "${A16_MEDIUM[@]}"; do echo "  $m"; done
    a16_fail=1
  fi
  if [[ "$total_a16_low" -gt 0 ]]; then
    echo "[A-16] FAIL (LOW) — authoring TODO leaks (TODO PEDRO etc.):"
    for m in "${A16_LOW[@]}"; do echo "  $m"; done
    a16_fail=1
  fi
  if [[ "$a16_fail" -eq 0 ]]; then
    echo "[A-16] PASS — no forbidden tokens in public OSS surface."
  else
    fail=1
  fi
  echo ""
  if [[ "$fail" -eq 0 ]]; then
    echo "VERDICT: PASS — pre-deploy patent-coverage gate green."
  else
    echo "VERDICT: FAIL — block deploy until findings resolved."
    echo "Reference: .claude/skills/content-audit-legal/SKILL.md §4-§5 + .claude/rules/oss-docs-discipline.md §2"
  fi
  echo "================================================================"
fi

exit "$fail"
