// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

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
 * <p>An analyser flagged this call and two others like it. One of the three
 * already checked its input and was a false report; these two did not, and the
 * difference was only visible by looking. This is the check that makes the
 * difference, and the test that says so.
 */
final class CliInvokerUrlTest {

  private static CliInvoker.CliRequest requestFor(String url) {
    return new CliInvoker.CliRequest(
        "ariada",
        "@ariada-org/cli",
        url,
        Path.of("target", "ariada"),
        Path.of("."),
        "chromium",
        Severity.MINOR,
        60_000);
  }

  @Test
  void refusesAValueThatWouldBeReadAsAFlag() {
    IllegalArgumentException thrown =
        assertThrows(
            IllegalArgumentException.class,
            () -> new CliInvoker().scan(requestFor("--output-dir=/tmp/elsewhere")));
    assertTrue(
        thrown.getMessage().contains("http"),
        "the refusal should say what was expected, not merely that something was wrong");
  }

  @Test
  void refusesAValueThatIsNotAnAddressAtAll() {
    assertThrows(
        IllegalArgumentException.class, () -> new CliInvoker().scan(requestFor("example.com")));
  }

  @Test
  void refusesNothing() {
    assertThrows(IllegalArgumentException.class, () -> new CliInvoker().scan(requestFor(null)));
  }

  @Test
  void doesNotRefuseAnOrdinaryAddress() {
    // This one is expected to get past the check and fail later, when it tries to
    // run a command that is not installed here. Failing for that reason is the
    // proof that the check let it through; a check that refused everything would
    // pass the three tests above and be useless.
    Exception thrown =
        assertThrows(
            Exception.class, () -> new CliInvoker().scan(requestFor("https://example.com/")));
    assertTrue(
        !(thrown instanceof IllegalArgumentException),
        "an ordinary address must not be refused by the address check; it failed with: "
            + thrown.getClass().getSimpleName()
            + ": "
            + thrown.getMessage());
  }
}
