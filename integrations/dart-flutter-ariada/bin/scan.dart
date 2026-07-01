// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import 'dart:io';

import 'package:args/args.dart';
import 'package:ariada/ariada.dart';

Future<void> main(List<String> arguments) async {
  final parser = ArgParser()
    ..addOption('url', help: 'Served Flutter web URL to scan.')
    ..addOption('static-dir', help: 'Built Flutter web output directory, usually build/web.')
    ..addOption('output-dir', defaultsTo: 'ariada-output')
    ..addOption('domains', defaultsTo: 'accessibility')
    ..addOption('severity-threshold', defaultsTo: 'moderate')
    ..addOption(
      'ariada-bin',
      defaultsTo: Platform.environment['ARIADA_BIN'] ?? 'ariada',
      help: 'Shared @ariada-org/cli executable.',
    )
    ..addFlag('help', abbr: 'h', negatable: false);

  late final ArgResults parsed;
  try {
    parsed = parser.parse(arguments);
  } on FormatException catch (error) {
    stderr.writeln(error.message);
    stderr.writeln(parser.usage);
    exitCode = exitInvalidArgs;
    return;
  }

  if (parsed.flag('help')) {
    stdout.writeln('Usage: dart run ariada:scan [--url URL | --static-dir build/web]');
    stdout.writeln(parser.usage);
    return;
  }

  final url = parsed.option('url');
  final staticDir = parsed.option('static-dir');
  if ((url == null) == (staticDir == null)) {
    stderr.writeln('Provide exactly one of --url or --static-dir.');
    exitCode = exitInvalidArgs;
    return;
  }

  final target = url != null
      ? UrlTarget(Uri.parse(url))
      : StaticDirTarget(Directory(staticDir!));
  final options = AriadaOptions(
    target: target,
    outputDir: Directory(parsed.option('output-dir')!),
    ariadaBin: parsed.option('ariada-bin')!,
    severityThreshold: parsed.option('severity-threshold')!,
    domains: parsed
        .option('domains')!
        .split(',')
        .map((domain) => domain.trim())
        .where((domain) => domain.isNotEmpty)
        .toList(growable: false),
  );

  try {
    exitCode = await runAriadaScan(
      options,
      const ProcessCommandRunner(),
      stdoutSink: stdout,
      stderrSink: stderr,
    );
  } on FormatException catch (error) {
    stderr.writeln(error.message);
    exitCode = exitInvalidArgs;
  } on Object catch (error) {
    stderr.writeln(error);
    exitCode = exitRuntimeError;
  }
}
