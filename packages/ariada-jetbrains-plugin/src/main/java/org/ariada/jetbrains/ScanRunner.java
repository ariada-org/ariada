package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import java.util.function.Consumer;

/**
 * Where a scan runs.
 *
 * <p>The tool window asks for a scan and is handed the answer later. It does not
 * know, and must not know, which thread the work happened on — that is this
 * interface's only job, and separating it is what stops the work from drifting
 * back onto the thread that draws the interface.
 */
public interface ScanRunner {
  void submit(
      Project project,
      String url,
      Consumer<AriadaScanResult> onResult,
      Consumer<Exception> onFailure);
}
