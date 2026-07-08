// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import 'dart:async';
import 'dart:io';

import 'package:path/path.dart' as p;

import 'report.dart';

sealed class ScanTarget {
  const ScanTarget();
}

class UrlTarget extends ScanTarget {
  const UrlTarget(this.url);

  final Uri url;
}

class StaticDirTarget extends ScanTarget {
  const StaticDirTarget(this.path);

  final Directory path;
}

class AriadaOptions {
  AriadaOptions({
    required this.target,
    required this.outputDir,
    required this.ariadaBin,
    required this.severityThreshold,
    this.allowPrivate = false,
    this.domains = const [],
  });

  final ScanTarget target;
  final Directory outputDir;
  final String ariadaBin;
  final String severityThreshold;
  final bool allowPrivate;
  final List<String> domains;

  void validate() {
    if (ariadaBin.trim().isEmpty) {
      throw const FormatException('provide a non-empty Ariada CLI command');
    }
    if (!isKnownSeverity(severityThreshold)) {
      throw FormatException('unknown severity threshold $severityThreshold');
    }
    final targetValue = target;
    if (targetValue is UrlTarget) {
      if (!targetValue.url.hasScheme ||
          !['http', 'https'].contains(targetValue.url.scheme)) {
        throw const FormatException('provide an http(s) URL or --static-dir');
      }
    } else if (targetValue is StaticDirTarget && !targetValue.path.existsSync()) {
      throw FormatException(
        'static output dir does not exist: ${targetValue.path.path}',
      );
    }
  }
}

class CommandResult {
  CommandResult({
    required this.stdout,
    required this.stderr,
    required this.exitCode,
  });

  final String stdout;
  final String stderr;
  final int exitCode;
}

abstract interface class CommandRunner {
  Future<CommandResult> run(String executable, List<String> arguments);
}

class ProcessCommandRunner implements CommandRunner {
  const ProcessCommandRunner();

  @override
  Future<CommandResult> run(String executable, List<String> arguments) async {
    try {
      final result = await Process.run(executable, arguments);
      return CommandResult(
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        exitCode: result.exitCode,
      );
    } on Object catch (error) {
      return CommandResult(
        stdout: '',
        stderr: error.toString(),
        exitCode: exitRuntimeError,
      );
    }
  }
}

Future<int> runAriadaScan(
  AriadaOptions options,
  CommandRunner runner, {
  IOSink? stdoutSink,
  IOSink? stderrSink,
}) async {
  options.validate();
  options.outputDir.createSync(recursive: true);

  StaticServer? server;
  final targetUrl = switch (options.target) {
    UrlTarget(:final url) => url.toString(),
    StaticDirTarget(:final path) => (server = await StaticServer.start(path)).url,
  };

  try {
    final result = await runner.run(
      options.ariadaBin,
      buildAriadaArguments(options, targetUrl),
    );
    stdoutSink?.write(result.stdout);
    stderrSink?.write(result.stderr);

    final reportFile = File(p.join(options.outputDir.path, 'multi-domain-report.json'));
    if (!reportFile.existsSync()) {
      return result.exitCode == exitOk ? exitRuntimeError : _normalizeExit(result.exitCode);
    }
    final report = MultiDomainReport.fromFile(reportFile);
    final count = report.countAtOrAbove(options.severityThreshold);
    if (count > 0) {
      stdoutSink?.writeln(
        'ariada: $count finding(s) at or above ${options.severityThreshold}',
      );
      return exitViolations;
    }
    stdoutSink?.writeln('ariada: no findings at or above ${options.severityThreshold}');
    return exitOk;
  } finally {
    await server?.close();
  }
}

List<String> buildAriadaArguments(AriadaOptions options, String targetUrl) {
  final args = [
    'scan',
    targetUrl,
    '--format',
    'both',
    '--output-dir',
    options.outputDir.path,
    '--severity-threshold',
    options.severityThreshold,
  ];
  if (options.domains.isNotEmpty) {
    args.addAll(['--domains', options.domains.join(',')]);
  }
  if (options.allowPrivate || options.target is StaticDirTarget) {
    args.add('--allow-private');
  }
  return args;
}

int _normalizeExit(int exitCode) {
  if ([exitOk, exitViolations, exitInvalidArgs].contains(exitCode)) {
    return exitCode;
  }
  return exitRuntimeError;
}

class StaticServer {
  StaticServer._(this._server, this._root);

  final HttpServer _server;
  final Directory _root;

  String get url => 'http://${_server.address.host}:${_server.port}/';

  static Future<StaticServer> start(Directory root) async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final staticServer = StaticServer._(server, root);
    unawaited(staticServer._listen());
    return staticServer;
  }

  Future<void> _listen() async {
    await for (final request in _server) {
      final path = _resolvePath(request.uri.path);
      if (path == null || !File(path).existsSync()) {
        request.response.statusCode = HttpStatus.notFound;
        await request.response.close();
        continue;
      }
      request.response.headers.contentType = _contentType(path);
      await File(path).openRead().pipe(request.response);
    }
  }

  String? _resolvePath(String urlPath) {
    final normalized = p.normalize(urlPath == '/' ? 'index.html' : urlPath.substring(1));
    if (p.isAbsolute(normalized) || normalized.startsWith('..')) return null;
    return p.join(_root.path, normalized);
  }

  Future<void> close() => _server.close(force: true);
}

ContentType _contentType(String path) {
  return switch (p.extension(path)) {
    '.html' => ContentType.html,
    '.css' => ContentType('text', 'css'),
    '.js' => ContentType('application', 'javascript'),
    '.json' => ContentType.json,
    '.svg' => ContentType('image', 'svg+xml'),
    _ => ContentType.binary,
  };
}
