#!/usr/bin/env bash
# check-action-pinning.sh — fail if any GitHub Actions `uses:` reference in
# .github/workflows/*.yml points at a mutable ref (a branch like @main/@master
# or a tag like @v4) instead of a full 40-char commit SHA.
#
# A mutable ref can be silently re-pointed by whoever controls the upstream
# repo, so a compromised or repointed tag/branch would run attacker code in CI.
# Pinning to a commit SHA (with a `# vX.Y.Z` comment for readability) closes
# that supply-chain vector. Local composite actions (`uses: ./path`) and
# reusable-workflow calls (`uses: owner/repo/.github/workflows/x.yml@ref`) are
# out of scope: local actions cannot be SHA-pinned, and reusable-workflow refs
# are handled by the same convention but excluded here to keep the check focused
# on third-party/step actions.
#
# WHERE IT LIVES. Under `.github/` rather than beside the other scripts, because
# that is the only tree a transfer can carry to the published repository. The
# workflow that runs it is published; a check whose script is not would fail on
# the first line, and a guard that cannot run is worse than one that does not
# exist — the workflow reports red for a reason that has nothing to do with what
# it guards.
#
# Usage:
#   bash .github/scripts/check-action-pinning.sh
# Exit 0 = every remote step action is SHA-pinned; exit 1 = at least one is not.

set -euo pipefail

WF_DIR="${1:-.github/workflows}"
fail=0

# Пустой каталог и отсутствующий каталог — разные ответы. Без этого проверка на
# пропавшем пути печатала «всё закреплено»: обойти было нечего, находок не
# нашлось, и невозможность искать прочиталась как чистота. Ровно та ошибка,
# ради которой проверка и существует, только этажом выше.
if [ ! -d "$WF_DIR" ]; then
  echo "cannot check: $WF_DIR is not a directory" >&2
  exit 1
fi

for f in "$WF_DIR"/*.yml "$WF_DIR"/*.yaml; do
  [ -e "$f" ] || continue
  # Read line-by-line so we can report file:line on a violation.
  lineno=0
  while IFS= read -r line; do
    lineno=$((lineno + 1))
    # Strip leading whitespace for prefix tests.
    trimmed="${line#"${line%%[![:space:]]*}"}"
    # Skip comment lines.
    case "$trimmed" in
      \#*) continue ;;
    esac
    # Only consider `uses:` lines — in either form. A step with no `name:` is
    # written `- uses: …`, and requiring the key at the start of the line made
    # every one of those invisible: 46 of the 87 `uses:` lines in this directory,
    # including the deployment workflow whose four actions were on tags. The
    # check reported "all pinned" while looking straight at them.
    case "$trimmed" in
      uses:*) : ;;
      -[[:space:]]uses:*) trimmed="${trimmed#-[[:space:]]}" ;;
      *) continue ;;
    esac
    # Skip local composite actions (uses: ./something) — cannot be SHA-pinned.
    case "$trimmed" in
      *"uses: ./"* | *"uses: '../"* | *'uses: "../'*) continue ;;
    esac
    # Skip reusable-workflow calls (path contains .github/workflows/).
    case "$trimmed" in
      *".github/workflows/"*) continue ;;
    esac
    # A pinned ref contains @ followed by a 40-hex SHA.
    if printf '%s' "$trimmed" | grep -Eq '@[0-9a-f]{40}([[:space:]]|$|#)'; then
      continue
    fi
    printf 'UNPINNED ACTION  %s:%s  %s\n' "$f" "$lineno" "$trimmed" >&2
    fail=1
  done <"$f"
done

if [ "$fail" -ne 0 ]; then
  echo "" >&2
  echo "Pin every remote action to a full commit SHA (add '# vX.Y.Z' for readability)." >&2
  exit 1
fi

echo "All remote workflow actions are SHA-pinned."
