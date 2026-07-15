// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import 'package:ariada/ariada.dart';
import 'package:test/test.dart';

void main() {
  test('parses multi-domain findings and applies severity threshold', () {
    final report = MultiDomainReport.fromJsonString('''
{
  "grid": {
    "http://127.0.0.1:8080/": {
      "accessibility": [
        {"ruleId": "ariada/statement/page-link-from-footer", "severity": "moderate", "message": "Missing accessibility statement."},
        {"ruleId": "ariada/forms/label", "severity": "serious", "message": "Missing label."}
      ],
      "privacy": [
        {"ruleId": "ariada/privacy/cookie-notice", "severity": "minor", "message": "No cookie notice."}
      ]
    }
  }
}
''');

    expect(report.findings, hasLength(3));
    expect(report.countAtOrAbove('moderate'), 2);
    expect(report.countAtOrAbove('critical'), 0);
  });

  test('rejects malformed reports', () {
    expect(
      () => MultiDomainReport.fromJsonString('{"sites": []}'),
      throwsFormatException,
    );
  });
}
