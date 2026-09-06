# Recovered from the package archive, not a working package

Everything here was read out of the packed archive that sat in this directory,
because none of it was in the repository's history and the directory it lived in
is covered by the ignore rules. One routine `git clean -xdf` would have taken it
with no trace left to notice it by. The entry scripts are the package — there is
no build output at all — so the archive held the only copy of the source.

It is under `recovered/` rather than at the directory root on purpose. A
`package.json` at a root is a claim to every tool that reads this repository that
a package lives there: that it is a workspace member whose dependencies get
installed, whose gates run, and which can be published. None of that is true
here. It was never a member, so its eleven dependencies were never installed and
its checks were never run; and it depends on a compatibility shim that is not
part of this repository, so published as it stands its manifest would name
something nothing here can resolve.

Both of those are real findings about the package rather than clerical details,
and both were reported by this repository's own guards while this was being
written. Moving the files up to the root would silence the guards without
changing anything they were right about.

So what is here is evidence, kept verbatim. Adopting it — into the workspace,
onto the published packages instead of the shim, with its gates actually
running — is the next piece of work, and a separate one.
