// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import org.junit.jupiter.api.Test;

final class PatternSourceScannerTest {

  private static String fixture(String name) throws IOException {
    return new String(
        Objects.requireNonNull(PatternSourceScannerTest.class.getResourceAsStream("/fixtures/" + name))
            .readAllBytes(),
        StandardCharsets.UTF_8);
  }

  @Test
  void reportsAnImageWithNoAlternativeTextAndAButtonWithNoName() throws IOException {
    ScanSnapshot snapshot = new PatternSourceScanner().scan("missing-alt.html", fixture("missing-alt.html"));

    assertFalse(snapshot.findings().isEmpty());
    List<String> rules = snapshot.findings().stream().map(AriadaFinding::ruleId).toList();
    assertTrue(rules.contains("wcag-22-1-1-1-image-alt"), rules.toString());
    assertTrue(rules.contains("wcag-22-4-1-2-button-name"), rules.toString());
  }

  @Test
  void staysQuietWhenTheMarkupIsSound() throws IOException {
    ScanSnapshot snapshot = new PatternSourceScanner().scan("sound.html", fixture("sound.html"));

    assertEquals(List.of(), snapshot.findings(), "sound markup must not produce findings");
  }

  @Test
  void saysWhatItLookedAtEvenWhenItFoundNothing() throws IOException {
    // An empty list from a two-rule check is not a clean page. If the panel is
    // to avoid saying so, the snapshot has to carry the reservation.
    ScanSnapshot snapshot = new PatternSourceScanner().scan("sound.html", fixture("sound.html"));

    assertFalse(snapshot.detail().isBlank(), "an empty result must explain its own reach");
  }

  @Test
  void everySourceFindingCarriesARuleADomainAndAFix() throws IOException {
    // The identifiers here are the editor-side analyzer's, and they are checked
    // for that shape rather than against the command-line scanner's: that one
    // names its rules for the pack they belong to, and the two vocabularies do
    // not overlap. A finding with no way to fix it is a finding a person cannot
    // act on, so the remediation is required too.
    ScanSnapshot snapshot = new PatternSourceScanner().scan("missing-alt.html", fixture("missing-alt.html"));

    for (AriadaFinding finding : snapshot.findings()) {
      assertTrue(finding.ruleId().startsWith("wcag-22-"), finding.ruleId());
      assertEquals("accessibility", finding.domain());
      assertFalse(finding.remediation().isBlank(), "a source finding must say how to fix it");
    }
  }
}
