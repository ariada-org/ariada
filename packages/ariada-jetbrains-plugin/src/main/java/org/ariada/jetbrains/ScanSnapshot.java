// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import java.util.List;

public record ScanSnapshot(String target, List<AriadaFinding> findings) {
  public ScanSnapshot {
    findings = List.copyOf(findings);
  }

  static ScanSnapshot empty() {
    return new ScanSnapshot("No scan has run", List.of());
  }
}
