package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.ui.components.JBList;
import com.intellij.ui.components.JBScrollPane;
import java.awt.BorderLayout;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;

public final class AriadaToolWindow {
  private final Project project;
  private final ScanRunner runner;
  private final JPanel panel = new JPanel(new BorderLayout(8, 8));
  private final JLabel status = new JLabel("No Ariada scan has run.");
  private final DefaultListModel<String> model = new DefaultListModel<>();

  public AriadaToolWindow(Project project) {
    this(project, new BackgroundScanRunner());
  }

  AriadaToolWindow(Project project, ScanRunner runner) {
    this.project = project;
    this.runner = runner;
    JButton scan = new JButton("Run scan");
    scan.addActionListener(event -> runScan());
    JPanel top = new JPanel(new BorderLayout(8, 8));
    top.add(status, BorderLayout.CENTER);
    top.add(scan, BorderLayout.EAST);
    panel.add(top, BorderLayout.NORTH);
    panel.add(new JBScrollPane(new JBList<>(model)), BorderLayout.CENTER);
  }

  public JPanel content() {
    return panel;
  }

  public void runScan() {
    String url = AriadaCliScanner.discoverProjectUrl(project);
    if (url.isBlank()) {
      url = Messages.showInputDialog(
          project,
          "Enter the local or staging URL to scan with Ariada CLI.",
          "Ariada Scan URL",
          Messages.getQuestionIcon());
    }
    if (url == null || url.isBlank()) {
      status.setText("Scan cancelled: no URL configured.");
      return;
    }
    // Handed to the runner rather than called here: this method runs on the
    // thread that draws the interface, and the scan waits on a child process.
    status.setText("Running Ariada scan...");
    runner.submit(project, url.trim(), this::showResult, this::showFailure);
  }

  private void showFailure(Exception err) {
    String reason = err.getMessage() == null ? err.getClass().getSimpleName() : err.getMessage();
    status.setText("Ariada scan failed: " + reason);
    model.clear();
  }

  private void showResult(AriadaScanResult result) {
    status.setText(result.statusLine());
    model.clear();
    if (result.findings().isEmpty()) {
      model.addElement("No findings listed. Report: " + result.reportPath());
      if (!result.rawOutput().isBlank()) {
        model.addElement(result.rawOutput().trim());
      }
      return;
    }
    for (AriadaFinding finding : result.findings()) {
      model.addElement(finding.label());
    }
    model.addElement("Raw JSON: " + result.reportPath());
  }
}
