// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * What the scan is actually run with.
 *
 * <p>These drive the same method the real scan does, rather than a copy of its
 * logic: the list this returns is the list handed to {@code ProcessBuilder}, so
 * a check that passes here is a statement about what the process receives. A
 * test that rebuilt the arguments itself would pass whatever the scanner did.
 *
 * <p>The address comes from a dialog. No shell is involved, so no second command
 * can be started; what an unchecked value can do is stop being an address and
 * start being a flag.
 */
class AriadaCliScannerCommandTest {
  private static final Path OUT = Path.of("/tmp/ariada-jetbrains");

  @Test
  @DisplayName("an ordinary address is passed through as one argument")
  void ordinaryAddress() {
    List<String> command = AriadaCliScanner.buildScanCommand("https://example.test/page", OUT);

    assertTrue(command.contains("https://example.test/page"));
    assertEquals("scan", command.get(1));
    assertTrue(command.contains("--output-dir"));
    assertEquals(OUT.toString(), command.get(command.indexOf("--output-dir") + 1));
  }

  @Test
  @DisplayName("plain http is an address too, and is not refused")
  void plainHttp() {
    assertTrue(AriadaCliScanner.buildScanCommand("http://localhost:4321/", OUT)
        .contains("http://localhost:4321/"));
  }

  @Test
  @DisplayName("a value that begins with a dash never reaches the arguments")
  void dashIsRefused() {
    // Typed into the address box, this would be read by the command as its own
    // flag and the report would be written where it said, while the scan looked
    // as though it had found nothing.
    IllegalArgumentException refused = assertThrows(
        IllegalArgumentException.class,
        () -> AriadaCliScanner.buildScanCommand("--output-dir=/etc", OUT));

    assertTrue(refused.getMessage().contains("--output-dir=/etc"),
        "the refusal must name what was given, or the person cannot fix it");
  }

  @Test
  @DisplayName("a scheme that is not http is refused rather than passed along")
  void otherSchemesRefused() {
    for (String value : List.of("file:///etc/passwd", "javascript:alert(1)", "ftp://host/x")) {
      assertThrows(IllegalArgumentException.class,
          () -> AriadaCliScanner.buildScanCommand(value, OUT),
          "expected refusal for " + value);
    }
  }

  @Test
  @DisplayName("nothing at all is refused by name, not by a null pointer")
  void emptyRefused() {
    assertThrows(IllegalArgumentException.class,
        () -> AriadaCliScanner.buildScanCommand(null, OUT));
    assertThrows(IllegalArgumentException.class,
        () -> AriadaCliScanner.buildScanCommand("   ", OUT));
  }
}
