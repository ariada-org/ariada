package org.ariada.jetbrains;

public final class AriadaFinding {
  private final String domain;
  private final String ruleId;
  private final String severity;
  private final String message;

  public AriadaFinding(String domain, String ruleId, String severity, String message) {
    this.domain = domain;
    this.ruleId = ruleId;
    this.severity = severity;
    this.message = message;
  }

  public String label() {
    return "[" + severity + "] " + domain + "/" + ruleId + " - " + message;
  }
}
