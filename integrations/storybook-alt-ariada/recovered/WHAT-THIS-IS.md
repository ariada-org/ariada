# Recovered from the package archive, not a working package

Everything here was read out of the packed archive that sat in this directory.
None of it was in the repository history, and the directory it lived in is
covered by the ignore rules — one routine `git clean -xdf` would have taken it
with nothing left to notice by.

It is under `recovered/` rather than at the directory root on purpose. A
`package.json` at a root is a claim to every tool that reads this repository
that a package lives there: a workspace member whose dependencies get installed,
whose gates run, and which can be published. None of that is true here. The
archive ships what `files` names — which is the built output — so the source it
was built from was never committed, and the manifest names scripts and
directories that do not exist in this tree.

So what is kept is evidence, verbatim: the manifest as a record of what the
published package declared, and the authored files that are not build output —
schemas, templates, examples, configuration, documentation.

Recovering the source itself means reading it back out of the compiled modules.
That route is proven but it is separate work. When it is done, this directory's
contents move up to the root and become a package again.
