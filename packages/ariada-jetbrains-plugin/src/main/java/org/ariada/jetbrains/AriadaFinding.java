// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

/**
 * One thing a scan found, in the form both scans can fill.
 *
 * <p>The two scans this plugin runs used to carry two different shapes of
 * finding: the command-line scan knew a domain and nothing about where in the
 * source it was, the in-editor scan knew a source path and a remediation and
 * nothing about a domain. Keeping both shapes meant keeping two lists, two
 * panels and two ways of writing a line, so the fields are unified here and the
 * ones a given scan cannot fill are left blank rather than invented.
 */
public record AriadaFinding(
    String domain,
    String ruleId,
    String severity,
    String message,
    String sourcePath,
    String remediation) {

  public AriadaFinding {
    domain = blankToEmpty(domain);
    ruleId = blankToEmpty(ruleId);
    severity = blankToEmpty(severity);
    message = blankToEmpty(message);
    sourcePath = blankToEmpty(sourcePath);
    remediation = blankToEmpty(remediation);
  }

  /** A finding from the command-line scan, which reports no remediation text. */
  public static AriadaFinding fromReport(
      String domain, String ruleId, String severity, String message, String sourcePath) {
    return new AriadaFinding(domain, ruleId, severity, message, sourcePath, "");
  }

  /** The one line the tool window shows for this finding. */
  public String label() {
    StringBuilder line = new StringBuilder();
    if (!severity.isEmpty()) {
      line.append(severity.toUpperCase(java.util.Locale.ROOT)).append(' ');
    }
    if (!domain.isEmpty()) {
      line.append(domain).append('/');
    }
    line.append(ruleId.isEmpty() ? "unnamed rule" : ruleId);
    if (!message.isEmpty()) {
      line.append(" — ").append(message);
    }
    if (!sourcePath.isEmpty()) {
      line.append(" (").append(sourcePath).append(')');
    }
    if (!remediation.isEmpty()) {
      line.append(" · fix: ").append(remediation);
    }
    return line.toString();
  }

  private static String blankToEmpty(String value) {
    return value == null ? "" : value;
  }
}
