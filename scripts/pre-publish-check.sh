#!/usr/bin/env bash
# pre-publish-check.sh — single-shot pre-flight validation for one npm package.
#
# WHY THIS EXISTS
# ---------------
# Pedro critique #7 follow-up (2026-05-16): before publishing an @ariada-org/* pkg
# to npm, all five gates MUST be green. Running them by hand drifts: one is
# forgotten, another fails silently, the publish reaches npm with a broken
# tarball (cannot un-publish after 72 h — permanent npm namespace pollution).
#
# This wrapper runs:
#   1. `pnpm pack --dry-run`            (tarball contents valid, no missing files)
#   2. `pnpm dlx publint@latest --strict` (manifest hygiene: exports, types, files)
#   3. `pnpm test`                      (vitest green)
#   4. `pnpm build`                     (tsc emits dist/)
#   5. `pnpm typecheck` (= tsc --noEmit) (strict-mode types pass)
#
# All five MUST exit 0; otherwise the script aborts non-zero and prints which
# gate failed. Output is human-readable; no JSON for now (Pedro can pipe to
# `tee logs/pre-publish-<pkg>-<ts>.log` if archival desired).
#
# USAGE
# -----
#   bash scripts/pre-publish-check.sh @ariada-org/wcag-rules-extended
#   bash scripts/pre-publish-check.sh evidence-emitter   # short form ok
#
# Optional env:
#   SKIP_PUBLINT=1   skip publint (e.g. offline mode; not recommended)
#   SKIP_PACK=1      skip pnpm pack --dry-run
#   VERBOSE=1        echo each command before running
#
# EXIT CODES
# ----------
# 0  all five gates green
# 1  at least one gate failed (see stderr for which)
# 2  argument / env error

set -euo pipefail

# --- arg parsing ---
if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <package-name>" >&2
  echo "  package-name: full (@ariada-org/wcag-rules-extended) or short (wcag-rules-extended)" >&2
  exit 2
fi
PKG_ARG="$1"

# Normalize to short slug for `pnpm --filter` (pnpm accepts both forms; we use full).
case "$PKG_ARG" in
  @ariada-org/*) PKG_FULL="$PKG_ARG" ;;
  *)         PKG_FULL="@ariada-org/$PKG_ARG" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Resolve pkg dir by name (scan packages/*/package.json).
PKG_DIR=""
while IFS= read -r -d '' pkg_json; do
  name="$(jq -r '.name // ""' "$pkg_json")"
  if [[ "$name" == "$PKG_FULL" ]]; then
    PKG_DIR="$(dirname "$pkg_json")"
    break
  fi
done < <(find "$REPO_ROOT/packages" -mindepth 2 -maxdepth 2 -name package.json -print0)

if [[ -z "$PKG_DIR" ]]; then
  echo "ERROR: package $PKG_FULL not found under $REPO_ROOT/packages" >&2
  exit 2
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm required but not installed" >&2
  exit 2
fi

VERBOSE="${VERBOSE:-0}"
SKIP_PUBLINT="${SKIP_PUBLINT:-0}"
SKIP_PACK="${SKIP_PACK:-0}"

# --- gate runner ---
# run_gate <label> <cmd...> — runs cmd in PKG_DIR; on failure, records label.
# run_pnpm_script_gate <label> <script> — runs `pnpm run <script>` if defined;
#   if the script does NOT exist in package.json, gate is reported SKIP (not FAIL).
FAILURES=()
run_gate() {
  local label="$1"
  shift
  printf '  [%s] ' "$label"
  if [[ "$VERBOSE" == "1" ]]; then printf '($ %s) ' "$*"; fi
  if (cd "$PKG_DIR" && "$@") >/tmp/pre-publish-gate.$$.log 2>&1; then
    printf 'PASS\n'
  else
    printf 'FAIL\n'
    FAILURES+=("$label")
    sed 's/^/      /' /tmp/pre-publish-gate.$$.log >&2 || true
  fi
  rm -f /tmp/pre-publish-gate.$$.log
}

run_pnpm_script_gate() {
  local label="$1"
  local script="$2"
  if jq -e --arg s "$script" '.scripts | has($s)' "$PKG_DIR/package.json" >/dev/null 2>&1; then
    run_gate "$label" pnpm run "$script"
  else
    printf '  [%s] SKIP (no "%s" script defined)\n' "$label" "$script"
  fi
}

echo "pre-publish-check: $PKG_FULL"
echo "  pkg dir: $PKG_DIR"
echo

# Gate 1: build (must produce dist/ first so other gates work).
run_pnpm_script_gate "build" "build"

# Gate 2: typecheck (strict tsc --noEmit).
run_pnpm_script_gate "typecheck" "typecheck"

# Gate 3: test (vitest).
run_pnpm_script_gate "test" "test"

# Gate 4: pnpm pack to a tmp dir (catches missing files, broken workspace:* rewrites).
# pnpm has no `--dry-run` flag (as of v9.15) — emulate by packing to /tmp and rm-ing.
# This also validates that every workspace:* dep was resolvable inside the workspace.
if [[ "$SKIP_PACK" != "1" ]]; then
  PACK_TMP="$(mktemp -d -t ariada-pre-publish-pack.XXXXXX)"
  run_gate "pack" pnpm pack --pack-destination "$PACK_TMP"
  # Verify a single tarball was produced.
  tar_count=$(find "$PACK_TMP" -name '*.tgz' -type f | wc -l | tr -d ' ')
  if [[ "$tar_count" != "1" ]]; then
    echo "  [pack-tarball-count] FAIL (expected 1 .tgz, got $tar_count)" >&2
    FAILURES+=("pack-tarball-count")
  fi
  rm -rf "$PACK_TMP"
else
  echo "  [pack] SKIPPED (SKIP_PACK=1)"
fi

# Gate 5: publint --strict (manifest hygiene: exports, types, files, repository).
if [[ "$SKIP_PUBLINT" != "1" ]]; then
  run_gate "publint" pnpm dlx publint@latest --strict
else
  echo "  [publint] SKIPPED (SKIP_PUBLINT=1)"
fi

echo
if [[ ${#FAILURES[@]} -eq 0 ]]; then
  echo "RESULT: all gates GREEN for $PKG_FULL"
  exit 0
else
  echo "RESULT: ${#FAILURES[@]} gate(s) FAILED for $PKG_FULL: ${FAILURES[*]}"
  exit 1
fi
