<!-- SPDX-FileCopyrightText: 2026 Agonist Development AB -->
<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

# Ariada Dart/Flutter web package

`integrations/dart-flutter-ariada` provides a Dart pub package with the console entrypoint `dart run ariada:scan` for Flutter web teams that need Ariada evidence for a built web bundle.

The package is deliberately thin. It shells out to the shared `@ariada-org/cli`, reads `multi-domain-report.json`, prints a Dart-friendly summary, and returns a CI exit code:

- `0`: no findings at or above the threshold.
- `1`: findings at or above the threshold.
- `2`: invalid wrapper arguments.
- `3`: scanner/runtime failure.

## Install

```bash
dart pub add --dev ariada
npm install -g @ariada-org/cli
```

`ariada:scan` expects the Ariada CLI to be available as `ariada`. Override it with `ARIADA_BIN` or `--ariada-bin`.

## Usage

Run against a served Flutter web app:

```bash
dart run ariada:scan \
  --url http://127.0.0.1:8080/ \
  --allow-private \
  --domains accessibility,privacy,security \
  --severity-threshold moderate \
  --output-dir ariada-output
```

Run against built Flutter web output:

```bash
flutter build web --web-renderer html
dart run ariada:scan \
  --static-dir build/web \
  --domains accessibility \
  --output-dir ariada-output
```

The static-dir mode starts a loopback static server and still delegates all scanning to `@ariada-org/cli`; it does not implement WCAG, EAA, privacy, security, or other scanner rules.
For `--static-dir`, the wrapper automatically passes `--allow-private` to the shared CLI because the target is a loopback URL. For an already served local URL, pass `--allow-private` explicitly.

## Flutter web renderer caveat

This adapter is useful when the built output exposes a semantic DOM or Flutter's semantics layer. CanvasKit/Skwasm-heavy output can be visually correct while exposing too little conventional DOM for DOM-oriented scanners. Treat this package as an MVP evidence bridge for Flutter web, not as a native Flutter accessibility oracle.

## Distribution blocker

Publishing to pub.dev requires a Google account, final package-name approval, and a verified publisher setup for the Ariada domain. The current local package name is `ariada` to match the requested `dart run ariada:scan` command; the release coordinator must confirm that the public pub.dev package name is available or rename before publication.

## Scope

This package is a Dart channel adapter only. It does not contain Ariada scanner rules, browser automation, WCAG logic, or domain-specific compliance checks.
