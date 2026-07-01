// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.progress.ProgressIndicator;
import com.intellij.openapi.progress.Task;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.vfs.VfsUtilCore;
import com.intellij.openapi.vfs.VirtualFile;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import org.jetbrains.annotations.NotNull;

@Service(Service.Level.PROJECT)
public final class AriadaScanService {
  private static final Logger LOG = Logger.getInstance(AriadaScanService.class);
  private final Project project;
  private final AriadaRemediationWorkflow workflow = new StubAriadaRemediationWorkflow();
  private final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
  private volatile ScanSnapshot latestSnapshot = ScanSnapshot.empty();

  public AriadaScanService(Project project) {
    this.project = project;
  }

  public ScanSnapshot latestSnapshot() {
    return latestSnapshot;
  }

  public void addListener(Runnable listener, Disposable parentDisposable) {
    listeners.add(listener);
    Disposer.register(parentDisposable, () -> listeners.remove(listener));
  }

  public void scanFile(VirtualFile file) {
    new Task.Backgroundable(project, "Ariada accessibility scan", false) {
      @Override
      public void run(@NotNull ProgressIndicator indicator) {
        ScanSnapshot snapshot = scanVirtualFile(file);
        ApplicationManager.getApplication().invokeLater(() -> publish(snapshot), project.getDisposed());
      }
    }.queue();
  }

  ScanSnapshot scanText(String sourcePath, String sourceText) {
    return workflow.scan(sourcePath, sourceText);
  }

  private ScanSnapshot scanVirtualFile(VirtualFile file) {
    if (!isSupported(file)) {
      return new ScanSnapshot(file.getPresentableUrl(), List.of());
    }

    try {
      var document = FileDocumentManager.getInstance().getDocument(file);
      String text = document == null ? VfsUtilCore.loadText(file) : document.getText();
      return workflow.scan(file.getPresentableUrl(), text);
    } catch (IOException error) {
      LOG.warn("Unable to read file for Ariada scan", error);
      return new ScanSnapshot(file.getPresentableUrl(), List.of());
    }
  }

  private void publish(ScanSnapshot snapshot) {
    latestSnapshot = snapshot;
    for (Runnable listener : listeners) {
      listener.run();
    }
  }

  static boolean isSupported(VirtualFile file) {
    String name = file.getName().toLowerCase(Locale.ROOT);
    return name.endsWith(".html")
        || name.endsWith(".htm")
        || name.endsWith(".jsx")
        || name.endsWith(".tsx")
        || name.endsWith(".vue")
        || name.endsWith(".svelte");
  }
}
