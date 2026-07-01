// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.junit.jupiter.api.Test;

final class StubAriadaRemediationWorkflowTest {
  @Test
  void scansFixtureAndListsFinding() throws IOException {
    String fixture = new String(
        Objects.requireNonNull(getClass().getResourceAsStream("/fixtures/missing-alt.html")).readAllBytes(),
        StandardCharsets.UTF_8);

    ScanSnapshot snapshot = new StubAriadaRemediationWorkflow().scan("missing-alt.html", fixture);

    assertFalse(snapshot.findings().isEmpty());
    assertTrue(snapshot.findings().stream().anyMatch(f -> f.ruleId().equals("wcag-22-1-1-1-image-alt")));
  }
}
