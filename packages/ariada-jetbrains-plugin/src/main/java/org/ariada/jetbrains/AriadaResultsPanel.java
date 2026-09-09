// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.project.Project;
import com.intellij.ui.components.JBLabel;
import com.intellij.ui.components.JBList;
import com.intellij.ui.components.JBPanel;
import com.intellij.ui.components.JBScrollPane;
import com.intellij.util.ui.JBUI;
import java.awt.BorderLayout;
import java.util.List;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JPanel;

/**
 * The tool window: what the last scan found, and a way to run the next one.
 *
 * <p>It draws whatever the service last published and knows nothing about how a
 * scan runs. That is why the two scans can share it — and why a scan started
 * from the Tools menu shows up here without the menu having to reach in.
 */
final class AriadaResultsPanel extends JBPanel<AriadaResultsPanel> implements Disposable {
  private final AriadaScanService service;
  private final JBLabel summary = new JBLabel();
  private final JBLabel detail = new JBLabel();
  private final DefaultListModel<String> listModel = new DefaultListModel<>();

  AriadaResultsPanel(Project project) {
    super(new BorderLayout(JBUI.scale(8), JBUI.scale(8)));
    service = project.getService(AriadaScanService.class);
    service.addListener(this::render, this);

    JButton scanSite = new JButton("Scan site");
    scanSite.setToolTipText("Run the full Ariada scanner against a running site");
    scanSite.addActionListener(event -> SiteScanPrompt.start(project));

    JPanel header = new JPanel(new BorderLayout(JBUI.scale(8), JBUI.scale(4)));
    header.add(summary, BorderLayout.CENTER);
    header.add(scanSite, BorderLayout.EAST);
    header.add(detail, BorderLayout.SOUTH);

    add(header, BorderLayout.NORTH);
    add(new JBScrollPane(new JBList<>(listModel)), BorderLayout.CENTER);
    setBorder(JBUI.Borders.empty(8));
    render();
  }

  private void render() {
    ScanSnapshot snapshot = service.latestSnapshot();
    List<AriadaFinding> findings = snapshot.findings();
    summary.setText(snapshot.summaryLine());
    detail.setText(snapshot.detail());
    detail.setVisible(!snapshot.detail().isEmpty());
    listModel.clear();

    if (findings.isEmpty()) {
      // Deliberately not "no problems found": this scan reaching nothing and the
      // page being sound produce the same empty list, and only the detail line
      // above can tell them apart.
      listModel.addElement("Nothing reported by this scan.");
      return;
    }
    for (AriadaFinding finding : findings) {
      listModel.addElement(finding.label());
    }
  }

  @Override
  public void dispose() {
  }
}
