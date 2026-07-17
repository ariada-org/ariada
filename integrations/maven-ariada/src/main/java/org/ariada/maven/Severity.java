// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import java.util.Locale;

public enum Severity {
  MINOR("minor", 0),
  MODERATE("moderate", 1),
  SERIOUS("serious", 2),
  CRITICAL("critical", 3);

  private final String cliName;
  private final int rank;

  Severity(String cliName, int rank) {
    this.cliName = cliName;
    this.rank = rank;
  }

  public String cliName() {
    return cliName;
  }

  public boolean isAtLeast(Severity threshold) {
    return rank >= threshold.rank;
  }

  public static Severity parse(String value) {
    String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    for (Severity severity : values()) {
      if (severity.cliName.equals(normalized)) {
        return severity;
      }
    }
    throw new IllegalArgumentException("Unsupported Ariada severity threshold: " + value);
  }
}
