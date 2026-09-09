// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.project.DumbAware;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.ui.content.Content;
import com.intellij.ui.content.ContentFactory;
import org.jetbrains.annotations.NotNull;

/**
 * Builds the tool window's content.
 *
 * <p>It keeps no registry of open windows. The one it used to keep existed so a
 * menu action could reach the window and tell it to scan; the scan now lives in
 * the project's service, so the window can be built, closed and rebuilt without
 * anything holding on to it.
 */
public final class AriadaToolWindowFactory implements ToolWindowFactory, DumbAware {
  @Override
  public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow toolWindow) {
    AriadaResultsPanel panel = new AriadaResultsPanel(project);
    Content content = ContentFactory.getInstance().createContent(panel, "Findings", false);
    content.setDisposer(panel);
    toolWindow.getContentManager().addContent(content);
  }
}
