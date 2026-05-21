#!/usr/bin/env bash
# npm-publish-order.sh — topologically sorted npm publish order for @ariada-org/* packages.
#
# ============================================================================
# DEPRECATED (2026-05-17 — YUKAWA, monorepo consolidation).
#
# The canonical publish path is now `pnpm changeset publish` (alias
# `pnpm release` per root package.json). Changesets implements the same
# Kahn's-algorithm topological sort that this script provides, but
# combines it with version-bumping, CHANGELOG generation, and
# workspace-dep rewriting in a single command.
#
# This script is kept for:
#   - debugging unexpected changesets behaviour (compare both topo-sorts)
#   - emergency manual publish if changesets is broken
#   - reference documentation of the publish ordering algorithm
#
# See:
#   - grants/PUBLIC_PUSH_PLAN_v0.2.md §9 — changesets-driven publish flow
#   - .changeset/config.json + .changeset/README.md — monorepo release config
# ============================================================================
#
# WHY THIS EXISTS (legacy rationale)
# ---------------
# Pedro critique #7 (2026-05-16): npm publish order matters because of
# `workspace:*` workspace deps. When `pnpm publish` (or `pnpm pack`) runs in a
# package whose `dependencies` include `"@ariada-org/X": "workspace:*"`, pnpm
# rewrites the value to the concrete published version of X (e.g. "0.1.0").
# If X has not yet been published to npm at that version, the resulting tarball
# manifest references a version that does not exist → installers see
# `npm ERR! 404 Not Found - @ariada-org/X@0.1.0`.
#
# This script walks every `packages/*/package.json`, identifies the publish-
# eligible @ariada-org/* packages (name starts with `@ariada-org/` AND `private != true`),
# extracts their internal workspace:* dependencies (`dependencies` only — devDeps
# and peerDeps do not enter the published tarball), builds the dependency DAG,
# and prints a topological order with leaves (no internal deps) first.
#
# Publish in the printed order to guarantee every workspace:* rewrite resolves
# against an already-published version on the npm registry.
#
# USAGE
# -----
#   bash scripts/npm-publish-order.sh                  # print order, one per line
#   bash scripts/npm-publish-order.sh --dry-run        # same (alias; no side effects)
#   bash scripts/npm-publish-order.sh --check          # verify dist/ exists per pkg
#
# Optional env: PKG_ROOT (default: <repo>/packages)
#
# DEPENDENCIES
# ------------
# bash 3.2+ + jq + coreutils. Pure POSIX. Compatible with macOS default bash.
# No associative arrays used (bash 3.2 compatibility).
#
# EXIT CODES
# ----------
# 0  success — order printed (and, with --check, all dist/ present)
# 1  cycle detected in dependency graph (real bug — workspace deps cannot cycle)
# 2  --check failed — at least one package missing dist/
# 3  argument / environment error (e.g. jq missing, PKG_ROOT missing)

set -euo pipefail

# Deprecation notice — non-blocking, so existing CI / docs invocations still work.
if [[ "${SUPPRESS_DEPRECATION:-0}" != "1" ]]; then
  cat >&2 <<'DEPRECATION_NOTICE'
WARNING: scripts/npm-publish-order.sh is DEPRECATED.
         Canonical publish path: `pnpm changeset publish` (alias `pnpm release`).
         See grants/PUBLIC_PUSH_PLAN_v0.2.md §9 for the changesets workflow.
         Set SUPPRESS_DEPRECATION=1 to silence this warning.
DEPRECATION_NOTICE
fi

# --- arg parsing ---
MODE="print"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) MODE="print"; shift ;;
    --check)   MODE="check"; shift ;;
    -h|--help)
      sed -n '2,33p' "$0"
      exit 0
      ;;
    *) echo "ERROR: unknown arg: $1" >&2; exit 3 ;;
  esac
done

# --- environment ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG_ROOT="${PKG_ROOT:-$REPO_ROOT/packages}"

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required but not installed" >&2
  exit 3
fi
if [[ ! -d "$PKG_ROOT" ]]; then
  echo "ERROR: PKG_ROOT not found: $PKG_ROOT" >&2
  exit 3
fi

# --- parallel-array storage (bash 3.2 compatible: no associative arrays) ---
# NAMES[i]    — package name
# DIRS[i]     — abs path to package dir
# DEPS[i]     — space-separated internal workspace:* deps (filtered later)
NAMES=()
DIRS=()
DEPS=()

# Helper: return index of name in NAMES[], or -1 if absent.
index_of() {
  local needle="$1"
  local i=0
  while [[ $i -lt ${#NAMES[@]} ]]; do
    if [[ "${NAMES[$i]}" == "$needle" ]]; then
      printf '%s' "$i"
      return 0
    fi
    i=$((i + 1))
  done
  printf '%s' "-1"
}

# --- discover publish-eligible packages ---
# Eligibility (ALL must hold):
#   1. name starts with `@ariada-org/`
#   2. `private` is not true
#   3. `publishConfig.access` is set (canonical marker for npm-publish targets;
#      packages without it are workspace-internal or future publish candidates)
while IFS= read -r -d '' pkg_json; do
  pkg_dir="$(dirname "$pkg_json")"
  meta="$(jq -r '[(.name // ""), (.private // false | tostring), (.publishConfig.access // "")] | @tsv' "$pkg_json")"
  name="$(printf '%s\n' "$meta" | cut -f1)"
  is_private="$(printf '%s\n' "$meta" | cut -f2)"
  pub_access="$(printf '%s\n' "$meta" | cut -f3)"

  [[ "$name" == @ariada-org/* ]] || continue
  [[ "$is_private" == "true" ]] && continue
  [[ -z "$pub_access" ]] && continue

  # Extract internal (workspace:*) deps from `dependencies` only.
  # devDependencies / peerDependencies do NOT enter the published tarball.
  internal_deps="$(jq -r '
    (.dependencies // {})
    | to_entries
    | map(select(.value | tostring | startswith("workspace:")))
    | map(.key)
    | .[]
  ' "$pkg_json" | tr '\n' ' ' | sed 's/ *$//')"

  NAMES+=("$name")
  DIRS+=("$pkg_dir")
  DEPS+=("$internal_deps")
done < <(find "$PKG_ROOT" -mindepth 2 -maxdepth 2 -name package.json -print0 | sort -z)

if [[ ${#NAMES[@]} -eq 0 ]]; then
  echo "ERROR: no @ariada-org/* publish-eligible packages found under $PKG_ROOT" >&2
  exit 3
fi

# --- filter deps to only those that are themselves publish-eligible ---
# If a publish-eligible pkg depends (via `dependencies`) on a workspace pkg
# that is NOT publish-eligible (e.g. a private app), that IS a bug — flag it.
i=0
while [[ $i -lt ${#NAMES[@]} ]]; do
  filtered=""
  for d in ${DEPS[$i]}; do
    if [[ "$(index_of "$d")" != "-1" ]]; then
      filtered+="$d "
    else
      echo "WARN: ${NAMES[$i]} depends on non-publishable workspace pkg $d (will 404 on install)" >&2
    fi
  done
  DEPS[i]="$(printf '%s' "$filtered" | sed 's/ *$//')"
  i=$((i + 1))
done

# --- Kahn's algorithm: topological sort, leaves (no deps) first ---
# INDEG[i] mirrors NAMES[i].
INDEG=()
i=0
while [[ $i -lt ${#NAMES[@]} ]]; do
  INDEG+=("0")
  i=$((i + 1))
done

i=0
while [[ $i -lt ${#NAMES[@]} ]]; do
  for d in ${DEPS[$i]}; do
    # edge: d → NAMES[i]  (d must be published before NAMES[i])
    INDEG[i]=$((INDEG[i] + 1))
  done
  i=$((i + 1))
done

# Initial queue: indices with indegree 0, sorted alphabetically for determinism.
QUEUE=()
i=0
while [[ $i -lt ${#NAMES[@]} ]]; do
  if [[ "${INDEG[$i]}" -eq 0 ]]; then
    QUEUE+=("${NAMES[$i]}")
  fi
  i=$((i + 1))
done
# Sort the initial queue alphabetically (deterministic output).
SORTED_QUEUE=()
while IFS= read -r line; do
  SORTED_QUEUE+=("$line")
done < <(printf '%s\n' "${QUEUE[@]}" | sort)
QUEUE=("${SORTED_QUEUE[@]}")

ORDER=()
while [[ ${#QUEUE[@]} -gt 0 ]]; do
  current="${QUEUE[0]}"
  QUEUE=("${QUEUE[@]:1}")
  ORDER+=("$current")
  # Decrement indegree of every node that depends on `current`.
  NEW_ZEROS=()
  i=0
  while [[ $i -lt ${#NAMES[@]} ]]; do
    for d in ${DEPS[$i]}; do
      if [[ "$d" == "$current" ]]; then
        INDEG[i]=$((INDEG[i] - 1))
        if [[ "${INDEG[$i]}" -eq 0 ]]; then
          NEW_ZEROS+=("${NAMES[$i]}")
        fi
      fi
    done
    i=$((i + 1))
  done
  if [[ ${#NEW_ZEROS[@]} -gt 0 ]]; then
    SORTED_ZEROS=()
    while IFS= read -r line; do
      SORTED_ZEROS+=("$line")
    done < <(printf '%s\n' "${NEW_ZEROS[@]}" | sort)
    QUEUE+=("${SORTED_ZEROS[@]}")
  fi
done

if [[ ${#ORDER[@]} -ne ${#NAMES[@]} ]]; then
  echo "ERROR: cycle detected in workspace dependency graph" >&2
  echo "       sorted ${#ORDER[@]}/${#NAMES[@]} pkgs; unresolved:" >&2
  i=0
  while [[ $i -lt ${#NAMES[@]} ]]; do
    found=0
    for o in "${ORDER[@]}"; do
      if [[ "$o" == "${NAMES[$i]}" ]]; then found=1; break; fi
    done
    if [[ $found -eq 0 ]]; then
      echo "         - ${NAMES[$i]} (deps: ${DEPS[$i]:-<none>})" >&2
    fi
    i=$((i + 1))
  done
  exit 1
fi

# --- output ---
RC=0
for n in "${ORDER[@]}"; do
  if [[ "$MODE" == "check" ]]; then
    idx="$(index_of "$n")"
    if [[ -d "${DIRS[$idx]}/dist" ]]; then
      printf '%s\tdist=OK\n' "$n"
    else
      printf '%s\tdist=MISSING\n' "$n"
      RC=2
    fi
  else
    printf '%s\n' "$n"
  fi
done

exit "$RC"
