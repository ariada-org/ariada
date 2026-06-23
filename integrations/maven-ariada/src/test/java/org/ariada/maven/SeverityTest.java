// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

final class SeverityTest {
 @Test
 void countsViolationsAtOrAboveThreshold() {
 AriadaScanResult result = new AriadaScanResult(
 "https://example.test",
 "SCAN",
 4,
 Map.of(Severity.MINOR, 1, Severity.MODERATE, 1, Severity.SERIOUS, 2),
 1);

 assertEquals(3, result.countAtOrAbove(Severity.MODERATE));
 assertEquals(2, result.countAtOrAbove(Severity.SERIOUS));
 assertEquals(0, result.countAtOrAbove(Severity.CRITICAL));
 }

 @Test
 void parsesCliSeverityNames() {
 assertEquals(Severity.MODERATE, Severity.parse(" moderate "));
 assertTrue(Severity.CRITICAL.isAtLeast(Severity.SERIOUS));
 }

 @Test
 void rejectsUnknownSeverity() {
 assertThrows(IllegalArgumentException.class, () -> Severity.parse("high"));
 }
}
