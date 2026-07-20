// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import 'dart:io';

import 'package:ariada/ariada.dart';
import 'package:test/test.dart';

void main() {
  test('builds shared Ariada CLI arguments without scanner logic', () {
    final args = buildAriadaArguments(
      AriadaOptions(
        target: UrlTarget(Uri.parse('https://example.test/')),
        outputDir: Directory('ariada-output'),
        ariadaBin: 'ariada',
        severityThreshold: 'moderate',
        domains: ['accessibility', 'privacy'],
      ),
      'https://example.test/',
    );

    expect(args, [
      'scan',
      'https://example.test/',
      '--format',
      'both',
      '--output-dir',
      'ariada-output',
      '--severity-threshold',
      'moderate',
      '--domains',
      'accessibility,privacy',
    ]);
  });

  test('returns violation exit when stub CLI writes a failing report', () async {
    final temp = await Directory.systemTemp.createTemp('ariada-dart-test-');
    addTearDown(() => temp.delete(recursive: true));
    final output = Directory('${temp.path}/out');
    final runner = StubRunner(output);

    final status = await runAriadaScan(
      AriadaOptions(
        target: UrlTarget(Uri.parse('http://127.0.0.1:8080/')),
        outputDir: output,
        ariadaBin: 'ariada-stub',
        severityThreshold: 'moderate',
        domains: ['accessibility'],
      ),
      runner,
    );

    expect(status, exitViolations);
    expect(runner.lastExecutable, 'ariada-stub');
    expect(runner.lastArguments, contains('--output-dir'));
  });

  test('static Flutter web output is served through an allowed loopback URL', () async {
    final temp = await Directory.systemTemp.createTemp('ariada-dart-static-test-');
    addTearDown(() => temp.delete(recursive: true));
    final output = Directory('${temp.path}/out');
    final runner = StubRunner(output);

    final status = await runAriadaScan(
      AriadaOptions(
        target: StaticDirTarget(
          Directory('fixtures/flutter-web-html-renderer/build/web'),
        ),
        outputDir: output,
        ariadaBin: 'ariada-stub',
        severityThreshold: 'moderate',
        domains: ['accessibility'],
      ),
      runner,
    );

    expect(status, exitViolations);
    expect(runner.lastArguments[1], startsWith('http://127.0.0.1:'));
    expect(runner.lastArguments, contains('--allow-private'));
  });
}

class StubRunner implements CommandRunner {
  StubRunner(this.outputDir);

  final Directory outputDir;
  String? lastExecutable;
  List<String> lastArguments = [];

  @override
  Future<CommandResult> run(String executable, List<String> arguments) async {
    lastExecutable = executable;
    lastArguments = arguments;
    outputDir.createSync(recursive: true);
    File('${outputDir.path}/multi-domain-report.json').writeAsStringSync('''
{
  "grid": {
    "http://127.0.0.1:8080/": {
      "accessibility": [
        {"ruleId": "ariada/statement/page-link-from-footer", "severity": "moderate", "message": "Missing accessibility statement."}
      ]
    }
  }
}
''');
    return CommandResult(stdout: 'stub scan\\n', stderr: '', exitCode: 0);
  }
}
