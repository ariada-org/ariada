// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

public final class AriadaScanResult {
  private final String url;
  private final String scanId;
  private final int total;
  private final EnumMap<Severity, Integer> bySeverity;
  private final int exitCode;

  public AriadaScanResult(
      String url,
      String scanId,
      int total,
      Map<Severity, Integer> bySeverity,
      int exitCode) {
    this.url = Objects.requireNonNullElse(url, "");
    this.scanId = Objects.requireNonNullElse(scanId, "");
    this.total = Math.max(0, total);
    this.bySeverity = new EnumMap<>(Severity.class);
    this.bySeverity.putAll(bySeverity);
    this.exitCode = exitCode;
  }

  public String url() {
    return url;
  }

  public String scanId() {
    return scanId;
  }

  public int total() {
    return total;
  }

  public int exitCode() {
    return exitCode;
  }

  public int countAtOrAbove(Severity threshold) {
    int count = 0;
    for (Map.Entry<Severity, Integer> entry : bySeverity.entrySet()) {
      if (entry.getKey().isAtLeast(threshold)) {
        count += entry.getValue();
      }
    }
    return count;
  }

  public Map<Severity, Integer> bySeverity() {
    return Collections.unmodifiableMap(bySeverity);
  }
}
