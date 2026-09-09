// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;

/**
 * Finds out which address to scan, and starts the scan.
 *
 * <p>Two places offer a site scan — the tool window's button and the Tools menu —
 * and both have to answer the same question first. Asking it in one place is
 * what keeps them from drifting into two different answers.
 */
final class SiteScanPrompt {

  private SiteScanPrompt() {}

  /** Must be called on the thread that draws the interface: it may open a dialog. */
  static void start(Project project) {
    AriadaScanService service = project.getService(AriadaScanService.class);
    String url = service.discoverUrl();
    if (url.isBlank()) {
      url = Messages.showInputDialog(
          project,
          "Address of the running site to scan — a local server or a staging build.",
          "Ariada Site Scan",
          Messages.getQuestionIcon());
    }
    if (url == null || url.isBlank()) {
      return;
    }
    service.scanSite(url.trim());
  }
}
