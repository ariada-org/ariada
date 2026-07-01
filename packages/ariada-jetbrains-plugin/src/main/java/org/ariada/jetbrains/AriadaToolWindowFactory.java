package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.ui.content.Content;
import com.intellij.ui.content.ContentFactory;
import java.util.Map;
import java.util.WeakHashMap;
import org.jetbrains.annotations.NotNull;

public final class AriadaToolWindowFactory implements ToolWindowFactory {
  private static final Map<Project, AriadaToolWindow> WINDOWS = new WeakHashMap<>();

  @Override
  public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow toolWindow) {
    AriadaToolWindow view = new AriadaToolWindow(project);
    WINDOWS.put(project, view);
    Content content = ContentFactory.getInstance().createContent(view.content(), "Findings", false);
    toolWindow.getContentManager().addContent(content);
  }

  public static AriadaToolWindow get(Project project) {
    return WINDOWS.get(project);
  }
}
