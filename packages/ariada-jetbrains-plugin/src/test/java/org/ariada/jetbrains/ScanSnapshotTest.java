// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

final class ScanSnapshotTest {

  @Test
  void aFailedScanIsToldApartFromAScanThatFoundNothing() {
    ScanSnapshot nothingFound = ScanSnapshot.of("http://localhost:4321/", List.of());
    ScanSnapshot failed = ScanSnapshot.failed("http://localhost:4321/", "command not found: ariada");

    // Both carry no findings. Only the detail line separates "checked, clean" from
    // "never ran" — and a conformance claim made from the second would be a lie.
    assertTrue(nothingFound.findings().isEmpty());
    assertTrue(failed.findings().isEmpty());
    assertTrue(failed.detail().contains("command not found"));
    assertEquals("", nothingFound.detail());
  }

  @Test
  void findingsCannotBeChangedAfterTheFactByTheCaller() {
    List<AriadaFinding> mutable = new ArrayList<>();
    mutable.add(AriadaFinding.fromReport("accessibility", "image-alt", "critical", "No alt", "img"));
    ScanSnapshot snapshot = ScanSnapshot.of("page", mutable);

    mutable.clear();

    assertEquals(1, snapshot.findings().size(), "a snapshot is a snapshot");
    assertThrows(UnsupportedOperationException.class, () -> snapshot.findings().clear());
  }

  @Test
  void aFindingReadsAsOneLineWhateverFieldsItHas() {
    AriadaFinding fromReport =
        AriadaFinding.fromReport("accessibility", "color-contrast", "serious", "Low contrast", "a.link");
    AriadaFinding fromSource = new AriadaFinding(
        "accessibility", "wcag-22-1-1-1-image-alt", "critical", "Image is missing alternative text",
        "index.html", "Add an alt attribute.");

    assertEquals(
        "SERIOUS accessibility/color-contrast — Low contrast (a.link)", fromReport.label());
    assertTrue(fromSource.label().endsWith("· fix: Add an alt attribute."), fromSource.label());
  }
}
