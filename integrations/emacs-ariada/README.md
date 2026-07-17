# Ariada Emacs Package

Emacs package scaffold for running the Ariada accessibility CLI and surfacing
findings in a compilation buffer.

## What It Does

- Defines `ariada-scan`.
- Runs `ariada scan <target> --format json`.
- Parses simple Ariada JSON finding lines into compilation-style entries.
- Leaves scan logic in the Ariada CLI.

## Local Gates

```sh
node scripts/validate-emacs-package.mjs
```

`emacs --batch`, byte compilation, ERT, and `package-lint` are blocked because
Emacs is not installed on this machine.

## Live-Host Blocker

Blocked: MELPA publication requires byte-compile/package-lint evidence and a
MELPA recipe pull request.

Owner: founder. Next action: run the Emacs gates on a host with Emacs installed,
then submit the MELPA recipe PR.
