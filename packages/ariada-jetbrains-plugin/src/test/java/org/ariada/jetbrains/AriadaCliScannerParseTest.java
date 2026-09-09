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
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/**
 * The report reader, against a report the scanner actually wrote.
 *
 * <p>The fixture is a trimmed copy of a real one, with the per-finding shape
 * left exactly as it comes out: the element sits in a nested object between the
 * severity and the message. The reader this replaced could not cross that nested
 * object and returned nothing for the whole file, so the tool window reported a
 * clean page from a scan that had found several defects. These tests exist to
 * make that silence impossible to reintroduce quietly.
 */
final class AriadaCliScannerParseTest {

  private static String fixture(String name) throws IOException {
    return new String(
        Objects.requireNonNull(AriadaCliScannerParseTest.class.getResourceAsStream("/fixtures/" + name))
            .readAllBytes(),
        StandardCharsets.UTF_8);
  }

  @Test
  void readsEveryFindingOutOfARealReport() throws IOException {
    List<AriadaFinding> findings = AriadaCliScanner.parseFindings(fixture("multi-domain-report.json"));

    assertEquals(4, findings.size(), "the fixture holds four findings");
  }

  @Test
  void keepsEachFindingsOwnDomainRatherThanTheFirstKeyInTheFile() throws IOException {
    // The previous reader took the first key it saw that had a list under it and
    // called that the domain for everything. In a report the first such key is
    // "sites", so every finding was labelled "sites".
    Set<String> domains = AriadaCliScanner.parseFindings(fixture("multi-domain-report.json")).stream()
        .map(AriadaFinding::domain)
        .collect(Collectors.toSet());

    assertEquals(Set.of("accessibility", "privacy"), domains);
  }

  @Test
  void keepsTheRuleSeverityAndMessageOfEachFinding() throws IOException {
    List<AriadaFinding> findings = AriadaCliScanner.parseFindings(fixture("multi-domain-report.json"));

    // Asserted before the loop on purpose: a reader that returns nothing would
    // otherwise satisfy every check below by never running them, which is the
    // shape of a guard that reports "clean" when it means "could not look".
    assertFalse(findings.isEmpty(), "no findings read from a report that has them");
    for (AriadaFinding finding : findings) {
      assertFalse(finding.ruleId().isBlank(), "a finding without a rule is not usable");
      assertFalse(finding.severity().isBlank(), finding.ruleId());
      assertFalse(finding.message().isBlank(), finding.ruleId());
    }
  }

  @Test
  void saysWhereEachFindingIs() throws IOException {
    List<AriadaFinding> findings = AriadaCliScanner.parseFindings(fixture("multi-domain-report.json"));

    assertFalse(findings.isEmpty(), "no findings read from a report that has them");
    for (AriadaFinding finding : findings) {
      assertFalse(finding.sourcePath().isBlank(), "a finding must say where it is: " + finding.ruleId());
    }
  }

  @Test
  void doesNotCountTheReportsOwnSummariesAsFindings() throws IOException {
    // A report lists, near the end, which rules were tripped across which sites.
    // Those entries carry a rule and a domain and nothing else. Read as findings
    // they overstate the page: this fixture holds two of them, and neither has a
    // severity or a message to show.
    List<AriadaFinding> findings = AriadaCliScanner.parseFindings(fixture("multi-domain-report.json"));

    assertEquals(4, findings.size(), "the fixture's two summary entries are not findings");
    for (AriadaFinding finding : findings) {
      assertFalse(finding.message().isBlank(), "a row with nothing to say is not a finding");
    }
  }

  @Test
  void readsAFlatListOfFindingsToo() {
    // The bridge script writes findings as a plain array. Both shapes are ours,
    // and a reader that only understands one of them is a reader that will one
    // day report nothing without saying why.
    String flat = """
        [
          {"site":"fixtures/bad-site/index.html","domain":"accessibility",
           "ruleId":"wcag-22-1-1-1-image-alt","severity":"critical",
           "message":"Image missing alt attribute.",
           "range":{"startOffset":179,"endOffset":210}}
        ]
        """;

    List<AriadaFinding> findings = AriadaCliScanner.parseFindings(flat);

    assertEquals(1, findings.size());
    assertEquals("wcag-22-1-1-1-image-alt", findings.get(0).ruleId());
    assertEquals("accessibility", findings.get(0).domain());
  }

  @Test
  void returnsNothingForAFileThatIsNotAReport() {
    assertTrue(AriadaCliScanner.parseFindings("not json at all {{{").isEmpty());
    assertTrue(AriadaCliScanner.parseFindings("{}").isEmpty());
  }
}
