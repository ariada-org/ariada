// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/**
 * Where a scan runs.
 *
 * <p>The service asks for a scan and is handed the answer later. It does not
 * know, and must not know, which thread the work happened on — that is this
 * interface's only job, and separating it is what stops the work from drifting
 * back onto the thread that draws the interface. It is also what lets the
 * service be exercised in a test without an IDE running underneath it.
 */
public interface ScanRunner {

  /** Work that may be asked to stop, and may fail. */
  @FunctionalInterface
  interface ScanWork {
    ScanSnapshot run(BooleanSupplier cancelled) throws Exception;
  }

  void submit(
      Project project,
      String title,
      ScanWork work,
      Consumer<ScanSnapshot> onResult,
      Consumer<Exception> onFailure);
}
