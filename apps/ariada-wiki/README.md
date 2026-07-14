# Ariada Wiki

Standalone static Wiki for https://wiki.ariada.org.

The release worker commits the sanitized public module catalog to
data/channel-matrix.json. The build reads only that app-local snapshot and the
public locale and message exports from @agonist/localization 0.1.0. It does not
read sibling applications or substitute local package files.

After @agonist/localization 0.1.0 is publicly available:

    pnpm install
    pnpm build
    pnpm check
    pnpm deploy

Generated output is written only to dist/ and deployed independently to the
ariada-wiki Cloudflare Pages project.
