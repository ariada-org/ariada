// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

/**
 * Reads a source file as text and reports what it can see there.
 *
 * <p>This is the scan that answers while the person is still typing, so it takes
 * the file's text rather than a running page. It sees markup and nothing else:
 * no computed styles, no accessibility tree, no scripts having run. That is a
 * narrow view, and the results say so — the command-line scan behind
 * {@link AriadaCliScanner} is the one that loads the page and checks it whole.
 */
public interface SourceScanner {
  ScanSnapshot scan(String sourcePath, String sourceText);
}
