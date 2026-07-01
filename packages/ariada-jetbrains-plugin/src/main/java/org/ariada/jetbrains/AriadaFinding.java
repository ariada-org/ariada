// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

public record AriadaFinding(
    String ruleId,
    String severity,
    String message,
    String sourcePath,
    String remediation
) {
  String renderLine() {
    return severity.toUpperCase() + " " + ruleId + " - " + message + " (" + sourcePath + ")";
  }
}
