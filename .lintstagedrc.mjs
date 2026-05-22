// lint-staged configuration
//
// CONCURRENCY ASSUMPTION (BLOCKING)
// ---------------------------------
// lint-staged 15.x reads the staged set via `git diff --cached --raw -z`
// at startup; there is NO supported flag to scope it to "only the paths
// this commit's caller passed to `git add`". The git index is shared
// global state across all processes in the repo.
//
// When N parallel background agents each `git add <paths> && git commit`,
// the index becomes the UNION of every agent's staged paths by the time
// any one agent's pre-commit fires. lint-staged then runs eslint on the
// union and re-stages it; the parent `git commit` (with no path arg)
// commits the entire index. Result: cross-agent file bleed-through.
//
// (Observed 2026-05-06: commit c3d438ec — feat(modules): C/H/K extended
// pages — bundled 9 files instead of 3, capturing 6 sibling-agent files.)
//
// MITIGATION (two layers; both required for full protection)
//   Layer 1 — `.husky/pre-commit` wraps `pnpm exec lint-staged` in a
//             mkdir-based mutex so concurrent pre-commits serialize.
//   Layer 2 — Concurrent agents MUST bracket their entire
//             `git add → git commit -- <paths>` sequence with
//             `scripts/git-commit-mutex.sh` (single-process critical
//             section spanning add+commit). Layer 1 alone cannot prevent
//             interleaved `git add` calls polluting the index.
//
// LINT RULES — DO NOT CHANGE without separate review.
//   - eslint --fix --max-warnings=0 --no-warn-ignored : enforce zero
//     warnings policy and silence "ignored file" noise (eslint 9 flat
//     config emits a warning when given an ignored path; lint-staged
//     can pass paths that match patterns inside ignores, hence the flag).
//   - prettier --write : format the docs/data files per repo style.
//
// To inspect what lint-staged sees at any moment:
//   pnpm exec lint-staged --debug --dry-run

export default {
  '*.{ts,tsx,mjs,cjs,js,astro}': ['eslint --fix --max-warnings=0 --no-warn-ignored'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
}
