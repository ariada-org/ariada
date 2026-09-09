// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.actionSystem.ActionUpdateThread;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.project.DumbAwareAction;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowManager;
import org.jetbrains.annotations.NotNull;

/** Checks the file that is open, as it currently stands in the editor. */
public final class AriadaScanAction extends DumbAwareAction {
  @Override
  public void actionPerformed(@NotNull AnActionEvent event) {
    Project project = event.getProject();
    VirtualFile file = event.getData(CommonDataKeys.VIRTUAL_FILE);
    if (project == null || file == null || !AriadaScanService.isSupported(file)) {
      return;
    }
    project.getService(AriadaScanService.class).scanFile(file);
    showFindings(project);
  }

  @Override
  public void update(@NotNull AnActionEvent event) {
    Project project = event.getProject();
    VirtualFile file = event.getData(CommonDataKeys.VIRTUAL_FILE);
    event.getPresentation()
        .setEnabledAndVisible(
            project != null && file != null && AriadaScanService.isSupported(file));
  }

  @Override
  public @NotNull ActionUpdateThread getActionUpdateThread() {
    return ActionUpdateThread.BGT;
  }

  static void showFindings(Project project) {
    ToolWindow toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Ariada");
    if (toolWindow != null) {
      toolWindow.show();
    }
  }
}
