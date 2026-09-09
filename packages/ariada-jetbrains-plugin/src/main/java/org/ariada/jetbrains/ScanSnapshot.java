// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import java.util.List;

/**
 * The result of one scan, whichever scan produced it.
 *
 * <p>{@code detail} is the line under the summary: where the report was written
 * and how the process ended for a command-line scan, the reason for a failed
 * one, empty for an in-editor scan that has nothing further to say. It exists so
 * an empty finding list can explain itself — a scan that could not run and a
 * page with nothing wrong both produce no findings, and the difference is the
 * whole point.
 */
public record ScanSnapshot(String target, List<AriadaFinding> findings, String detail) {

  public ScanSnapshot {
    findings = List.copyOf(findings);
    detail = detail == null ? "" : detail;
  }

  public static ScanSnapshot of(String target, List<AriadaFinding> findings) {
    return new ScanSnapshot(target, findings, "");
  }

  public static ScanSnapshot empty() {
    return new ScanSnapshot("No scan has run", List.of(), "");
  }

  /** A scan that did not get far enough to have findings, and says why. */
  public static ScanSnapshot failed(String target, String reason) {
    return new ScanSnapshot(target, List.of(), "Scan failed: " + reason);
  }

  public String summaryLine() {
    return target + " — " + findings.size() + " finding(s)";
  }
}
