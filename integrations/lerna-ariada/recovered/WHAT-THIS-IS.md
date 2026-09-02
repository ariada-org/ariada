# Recovered from the package archive, not a working package

Everything in this directory was read out of the packed archive that sat in
`integrations/lerna-ariada`, because none of it was in the repository's history and the
directory it lived in is covered by the ignore rules. One routine
`git clean -xdf` would have taken it with no trace left to notice by.

It is under `recovered/` rather than at the directory root on purpose. A
`package.json` at a root is a claim to every tool that reads this repository
that a package lives there, and that claim would be false: the archive ships
`dist`, the source it was built from was never committed, and the manifest's
own scripts name a build tree — `src`, `test`, `scripts`, the TypeScript and
lint configuration — that does not exist here. Left at the root, those scripts
would be gates nobody can run, which is the failure this repository has already
been bitten by once.

So what is here is evidence, kept verbatim: the manifest as a record of what the
published package declared, and the authored files that are not build output —
templates, examples, schemas, static assets, documentation.

Recovering the source itself means reading it back out of the compiled modules
in `dist`. That route is proven but it is a separate piece of work. When it is
done, this directory's contents move up to the root and become a package again.
