// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import 'dart:convert';
import 'dart:io';

const exitOk = 0;
const exitViolations = 1;
const exitInvalidArgs = 2;
const exitRuntimeError = 3;

const _severityRank = {
  'minor': 1,
  'moderate': 2,
  'serious': 3,
  'critical': 4,
};

bool isKnownSeverity(String severity) => _severityRank.containsKey(severity);

int severityRank(String severity) => _severityRank[severity] ?? 2;

class AriadaFinding {
  AriadaFinding({
    required this.ruleId,
    required this.severity,
    required this.message,
  });

  factory AriadaFinding.fromJson(Map<String, Object?> json) {
    return AriadaFinding(
      ruleId: json['ruleId']?.toString() ?? 'unknown',
      severity: json['severity']?.toString() ?? 'moderate',
      message: json['message']?.toString() ?? '',
    );
  }

  final String ruleId;
  final String severity;
  final String message;
}

class MultiDomainReport {
  MultiDomainReport(this.findings);

  factory MultiDomainReport.fromJsonString(String raw) {
    final decoded = jsonDecode(raw);
    if (decoded is! Map<String, Object?>) {
      throw const FormatException('Ariada report root must be an object');
    }
    final grid = decoded['grid'];
    if (grid is! Map) {
      throw const FormatException('Ariada report is missing grid');
    }

    final findings = <AriadaFinding>[];
    for (final byDomain in grid.values) {
      if (byDomain is! Map) continue;
      for (final domainFindings in byDomain.values) {
        if (domainFindings is! List) continue;
        for (final finding in domainFindings) {
          if (finding is Map) {
            findings.add(
              AriadaFinding.fromJson(Map<String, Object?>.from(finding)),
            );
          }
        }
      }
    }
    return MultiDomainReport(findings);
  }

  factory MultiDomainReport.fromFile(File file) {
    return MultiDomainReport.fromJsonString(file.readAsStringSync());
  }

  final List<AriadaFinding> findings;

  int countAtOrAbove(String threshold) {
    final minimum = severityRank(threshold);
    return findings
        .where((finding) => severityRank(finding.severity) >= minimum)
        .length;
  }
}
