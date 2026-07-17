# Ariada for Sublime Text

Sublime Text package that runs the `ariada` accessibility CLI from the editor and
shows the result in an output panel.

## What It Does

- Adds an `Ariada: Scan Current File or URL` command.
- Runs `ariada scan` through Python `subprocess`.
- Shows the human CLI output in a Sublime output panel.
- Reads `scan.json` when available and lists findings with severity, rule, and
  message.
- For a local HTML file, starts a short-lived localhost static server because the
  current `ariada scan` command accepts `http` and `https` targets.

## Install For Local Review

Copy this directory into Sublime Text's `Packages` directory as `Ariada`, or
symlink it during development.

Configure `Preferences: Ariada Settings`:

```json
{
  "ariada_cli_path": "ariada",
  "severity_threshold": "moderate",
  "scan_on_save": false
}
```

## Review Fixture

Open `fixtures/bad-button.html` and run `Ariada: Scan Current File or URL`.
The package serves the file on localhost, invokes the CLI, and writes the result
to a temporary output directory.

## Validation

Syntax-only validation without Sublime:

```bash
python3 -m py_compile ariada_sublime.py
```

Full acceptance still needs Sublime Text installed locally so the command can be
loaded from the Command Palette and the output panel can be inspected.
