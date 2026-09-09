// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.components.Service;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.vfs.VfsUtilCore;
import com.intellij.openapi.vfs.VirtualFile;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * The one place a scan's result lives, for both scans this plugin can run.
 *
 * <p>Two scans answer different questions and the plugin needs both: the file
 * in the editor can be checked while it is still being written, and the served
 * page can be checked properly. The rewrite that removed the earlier service left
 * nowhere to keep a result, so a window had to run its own scan and hold its own
 * answer; whichever one a person opened, the other knew nothing about it.
 *
 * <p>Anything that wants to show results registers a listener and reads
 * {@link #latestSnapshot()}. Nothing reaches into a window to make it scan.
 */
@Service(Service.Level.PROJECT)
public final class AriadaScanService {
  private static final Logger LOG = Logger.getInstance(AriadaScanService.class);

  private final Project project;
  private final ScanRunner runner;
  private final SourceScanner sourceScanner;
  private final AriadaCliScanner cliScanner;
  private final CopyOnWriteArrayList<Runnable> listeners = new CopyOnWriteArrayList<>();
  private volatile ScanSnapshot latestSnapshot = ScanSnapshot.empty();

  public AriadaScanService(Project project) {
    this(project, new BackgroundScanRunner(), new PatternSourceScanner(), new AriadaCliScanner());
  }

  AriadaScanService(
      Project project, ScanRunner runner, SourceScanner sourceScanner, AriadaCliScanner cliScanner) {
    this.project = project;
    this.runner = runner;
    this.sourceScanner = sourceScanner;
    this.cliScanner = cliScanner;
  }

  public ScanSnapshot latestSnapshot() {
    return latestSnapshot;
  }

  public void addListener(Runnable listener, Disposable parentDisposable) {
    listeners.add(listener);
    Disposer.register(parentDisposable, () -> listeners.remove(listener));
  }

  /** Checks the markup of one file, without saving, building or serving it. */
  public void scanFile(VirtualFile file) {
    String target = file.getPresentableUrl();
    if (!isSupported(file)) {
      publish(new ScanSnapshot(target, List.of(), "Not a file this scan reads."));
      return;
    }
    announce(target, "Reading the file…");
    runner.submit(
        project,
        "Ariada file scan",
        cancelled -> scanVirtualFile(file),
        this::publish,
        error -> publish(ScanSnapshot.failed(target, describe(error))));
  }

  /** Runs the full scanner over a served page and reads the report it writes. */
  public void scanSite(String url) {
    announce(url, "Running the Ariada scanner…");
    runner.submit(
        project,
        "Ariada site scan",
        cancelled -> cliScanner.scan(project, url, cancelled),
        this::publish,
        error -> publish(ScanSnapshot.failed(url, describe(error))));
  }

  /** The URL a site scan would use without asking, or empty when there is none. */
  public String discoverUrl() {
    return AriadaCliScanner.discoverProjectUrl(project);
  }

  ScanSnapshot scanText(String sourcePath, String sourceText) {
    return sourceScanner.scan(sourcePath, sourceText);
  }

  private ScanSnapshot scanVirtualFile(VirtualFile file) {
    String target = file.getPresentableUrl();
    try {
      var document = FileDocumentManager.getInstance().getDocument(file);
      String text = document == null ? VfsUtilCore.loadText(file) : document.getText();
      return sourceScanner.scan(target, text);
    } catch (IOException error) {
      LOG.warn("Unable to read file for Ariada scan", error);
      return ScanSnapshot.failed(target, describe(error));
    }
  }

  /**
   * Shows that a scan has started. Without it the panel keeps the previous
   * result on screen while the next scan runs, and a stale list of findings is
   * read as the current one.
   */
  private void announce(String target, String what) {
    publish(new ScanSnapshot(target, List.of(), what));
  }

  private void publish(ScanSnapshot snapshot) {
    latestSnapshot = snapshot;
    for (Runnable listener : listeners) {
      listener.run();
    }
  }

  private static String describe(Exception error) {
    return error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
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
