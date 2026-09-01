package org.ariada.jetbrains;

import java.nio.file.Path;
import java.util.List;

public final class AriadaScanResult {
  private final String url;
  private final int exitCode;
  private final Path reportPath;
  private final List<AriadaFinding> findings;
  private final String rawOutput;

  public AriadaScanResult(
      String url,
      int exitCode,
      Path reportPath,
      List<AriadaFinding> findings,
      String rawOutput) {
    this.url = url;
    this.exitCode = exitCode;
    this.reportPath = reportPath;
    this.findings = List.copyOf(findings);
    this.rawOutput = rawOutput;
  }

  public String url() {
    return url;
  }

  public int exitCode() {
    return exitCode;
  }

  public Path reportPath() {
    return reportPath;
  }

  public List<AriadaFinding> findings() {
    return findings;
  }

  public String rawOutput() {
    return rawOutput;
  }

  public String statusLine() {
    return "Ariada scan: " + findings.size() + " finding(s), exit " + exitCode + " - " + url;
  }
}
