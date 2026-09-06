// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.gradle;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * The address the scan is given has to be an address.
 *
 * <p>No shell is involved — the command is assembled as a list and each element
 * is passed through as one argument — so nothing given here can start a second
 * command. What a bare value can do is stop being an address: anything beginning
 * with a dash is read by the command as one of its own flags, and a target of
 * {@code --output-dir=/somewhere} would write the report to a place the caller
 * never chose.
 *
 * <p>An analyser flagged three calls of this shape across the repository. One
 * already checked its input and was a false report; this was one of the two that
 * did not, and the difference between them was visible only by reading each.
 */
final class ProcessCliRunnerUrlTest {

  private static CliInvocation invocationFor(String url) {
    return new CliInvocation("ariada", url, Path.of("build", "ariada"), "accessibility", "minor");
  }

  @Test
  void refusesAValueThatWouldBeReadAsAFlag() {
    IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> new ProcessCliRunner().run(invocationFor("--output-dir=/tmp/elsewhere")));
    assertTrue(
        thrown.getMessage().contains("http"),
        "the refusal should say what was expected, not merely that something was wrong");
  }

  @Test
  void refusesAValueThatIsNotAnAddressAtAll() {
    assertThrows(
        IllegalArgumentException.class,
        () -> new ProcessCliRunner().run(invocationFor("example.com")));
  }

  @Test
  void refusesNothing() {
    assertThrows(
        IllegalArgumentException.class, () -> new ProcessCliRunner().run(invocationFor(null)));
  }

  @Test
  void doesNotRefuseAnOrdinaryAddress() {
    // Expected to get past the check and fail later, trying to run a command that
    // is not installed here. Failing for that reason is what proves the check let
    // it through — a check that refused everything would pass the three tests
    // above and be worth nothing.
    Exception thrown =
        assertThrows(
            Exception.class,
            () -> new ProcessCliRunner().run(invocationFor("https://example.com/")));
    assertTrue(
        !(thrown instanceof IllegalArgumentException),
        "an ordinary address must not be refused by the address check; it failed with: "
            + thrown.getClass().getSimpleName()
            + ": "
            + thrown.getMessage());
  }
}
