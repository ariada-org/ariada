package org.ariada.jetbrains;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowManager;
import org.jetbrains.annotations.NotNull;

public final class AriadaScanAction extends AnAction {
  @Override
  public void actionPerformed(@NotNull AnActionEvent event) {
    Project project = event.getProject();
    if (project == null) {
      Messages.showInfoMessage("Open a project before running Ariada.", "Ariada");
      return;
    }
    ToolWindow toolWindow = ToolWindowManager.getInstance(project).getToolWindow("Ariada");
    if (toolWindow == null) {
      Messages.showErrorDialog(project, "Ariada tool window is not registered.", "Ariada");
      return;
    }
    toolWindow.show(() -> {
      AriadaToolWindow window = AriadaToolWindowFactory.get(project);
      if (window != null) {
        window.runScan();
      }
    });
  }

  @Override
  public void update(@NotNull AnActionEvent event) {
    event.getPresentation().setEnabled(event.getProject() != null);
  }
}
