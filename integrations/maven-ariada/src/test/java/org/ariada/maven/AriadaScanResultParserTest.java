// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;

final class AriadaScanResultParserTest {
  @Test
  void parsesCliScanEnvelope() throws Exception {
    AriadaScanResult result = new AriadaScanResultParser()
        .parse(Path.of("src/test/resources/scan-with-violations.json"));

    assertEquals("https://maven.example.test", result.url());
    assertEquals("MAVEN-SCAN-001", result.scanId());
    assertEquals(2, result.total());
    assertEquals(1, result.bySeverity().get(Severity.SERIOUS));
    assertEquals(1, result.bySeverity().get(Severity.MODERATE));
    assertEquals(1, result.exitCode());
  }

  @Test
  void parsesCurrentMultiDomainReport() throws Exception {
    AriadaScanResult result = new AriadaScanResultParser()
        .parse(Path.of("src/test/resources/multi-domain-report.json"));

    assertEquals("https://maven.example.test", result.url());
    assertEquals("MAVEN-MULTI-001", result.scanId());
    assertEquals(2, result.total());
    assertEquals(1, result.bySeverity().get(Severity.CRITICAL));
    assertEquals(1, result.bySeverity().get(Severity.SERIOUS));
    assertEquals(2, result.countAtOrAbove(Severity.SERIOUS));
    assertEquals(1, result.exitCode());
  }
}
