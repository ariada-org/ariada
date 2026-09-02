package org.ariada.jetbrains;

import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.progress.ProgressIndicator;
import com.intellij.openapi.progress.Task;
import com.intellij.openapi.project.Project;
import java.util.function.Consumer;
import org.jetbrains.annotations.NotNull;

/**
 * Runs the scan on a background task and hands the answer back on the thread
 * that draws the interface.
 *
 * <p>The scan starts a child process and waits for it, for as long as
 * forty-five seconds. Waited for on the interface thread — which is where a
 * button's listener runs — that is forty-five seconds of frozen editor, and an
 * accessibility tool that hangs the editor teaches people to stop running it.
 */
public final class BackgroundScanRunner implements ScanRunner {
  @Override
  public void submit(
      Project project,
      String url,
      Consumer<AriadaScanResult> onResult,
      Consumer<Exception> onFailure) {
    new Task.Backgroundable(project, "Ariada accessibility scan", true) {
      @Override
      public void run(@NotNull ProgressIndicator indicator) {
        indicator.setIndeterminate(true);
        indicator.setText(url);
        try {
          AriadaScanResult result = new AriadaCliScanner().scan(project, url, indicator::isCanceled);
          onInterface(() -> onResult.accept(result));
        } catch (InterruptedException interrupted) {
          // Leave the flag as it was found, so anything above this can still see
          // that the wait was cut short rather than finished.
          Thread.currentThread().interrupt();
          onInterface(() -> onFailure.accept(interrupted));
        } catch (Exception err) {
          onInterface(() -> onFailure.accept(err));
        }
      }
    }.queue();
  }

  private static void onInterface(Runnable work) {
    ApplicationManager.getApplication().invokeLater(work);
  }
}
