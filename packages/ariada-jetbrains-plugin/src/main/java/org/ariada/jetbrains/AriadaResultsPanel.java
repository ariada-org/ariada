// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.project.Project;
import com.intellij.ui.components.JBLabel;
import com.intellij.ui.components.JBList;
import com.intellij.ui.components.JBPanel;
import com.intellij.util.ui.JBUI;
import java.awt.BorderLayout;
import java.util.List;
import javax.swing.DefaultListModel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;

final class AriadaResultsPanel extends JBPanel<AriadaResultsPanel> implements Disposable {
  private final AriadaScanService service;
  private final JBLabel summary = new JBLabel();
  private final DefaultListModel<String> listModel = new DefaultListModel<>();

  AriadaResultsPanel(Project project) {
    super(new BorderLayout(JBUI.scale(8), JBUI.scale(8)));
    service = project.getService(AriadaScanService.class);
    service.addListener(this::render, this);

    JPanel header = new JPanel(new BorderLayout());
    header.add(summary, BorderLayout.CENTER);

    add(header, BorderLayout.NORTH);
    add(new JScrollPane(new JBList<>(listModel)), BorderLayout.CENTER);
    setBorder(JBUI.Borders.empty(8));
    render();
  }

  private void render() {
    ScanSnapshot snapshot = service.latestSnapshot();
    List<AriadaFinding> findings = snapshot.findings();
    summary.setText(snapshot.target() + " - " + findings.size() + " finding(s)");
    listModel.clear();

    if (findings.isEmpty()) {
      listModel.addElement("No findings for the latest scan.");
      return;
    }

    for (AriadaFinding finding : findings) {
      listModel.addElement(finding.renderLine() + " Remediation: " + finding.remediation());
    }
  }

  @Override
  public void dispose() {
  }
}
