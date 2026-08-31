# What the public repository has and this branch does not

**Date:** 2026-08-31 · **Author:** Alexander Brichkin (Agonist Development AB)
**Follows:** the note on the plugin that exists twice, which found the first case
of it and could not say how many more there were.
**Status:** measured and explained; two decisions fall out of it.

---

## The number, and what it is made of

Four hundred and forty-seven files are on the public repository and not on the
branch this work happens on. That sounds like a tree that has drifted out of our
hands. It is not, and the split says why:

| | files |
|---|---|
| generated scan evidence and test reports | 401 |
| the scripts that generate them | 22 |
| **genuine divergence** | **23** |

The four hundred and twenty-three were untracked here on purpose, by two commits
that say so. `eff49ca87` removed the evidence artefacts — result pages, logs,
runner output — because they carried operator-local absolute paths and
base64 screenshot data that trips the secret gate, forty-five megabytes of it,
and because a scan regenerates them. `1fa75e6f5` then removed the generators
themselves as internal provenance tooling.

So most of the gap is a decision we made and kept, seen from the other side.

## The twenty-three that are not that

| area | files | shape |
|---|---|---|
| `packages/ariada-clamper` | 8 | schemas, source and tests the published copy has and this branch does not |
| `apps/ariada-org` | 8 | a channel matrix, `llms.txt`, module pages, contract tests |
| `packages/ariada-jetbrains-plugin` | 7 | a second implementation of the plugin, with its licence and notice |

All three are the same shape, and it is the shape the plugin note described: the
work exists in this repository's history but on the public-mirror line, not on
the branch we develop. Nothing arrived from outside. A package was written
twice, on two lines that are both ours, and only one line was published.

## What follows, and what does not

**Does not:** any of this being a leak, a loss, or a sign that the public
repository is out of our control. Every file is accounted for by a commit of
ours.

**Does:** two decisions, and one caution.

1. **The evidence machinery on the public repository.** Four hundred and
   twenty-three files we deliberately stopped keeping are still published —
   including the artefacts whose local paths were the reason for stopping. Their
   published copies were checked and are clean; the scrubber cleaned them on the
   way out. The question is whether the public repository should keep forty-five
   megabytes of generated evidence that no longer exists here, or whether a
   transfer should remove it. Removing is one line in a set description and is
   not reversible by cadence.

2. **The three divergent areas.** For each, which line is the package. Not a
   measurement: the published plugin has an implementation this branch never
   had, and this branch's plugin has the screenshots and the run reports the
   published one has none of.

**The caution:** a content transfer of any of those three areas from this branch
would remove what the public copy holds — a licence, in the plugin's case. It
does not, because the transfer refuses to remove a file the public tree has
unless the set says so in words. That guard was written this morning for an
unrelated reason and is the only thing standing between an ordinary-looking
operation and taking a licence off a published package.
