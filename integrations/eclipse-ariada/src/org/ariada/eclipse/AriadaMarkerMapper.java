package org.ariada.eclipse;

public final class AriadaMarkerMapper {
  public static final int INFO = 1;
  public static final int WARNING = 2;
  public static final int ERROR = 3;

  private AriadaMarkerMapper() {
  }

  public static AriadaMarker toMarker(AriadaFinding finding) {
    return new AriadaMarker(
        finding.file(),
        finding.line(),
        finding.column(),
        severityForImpact(finding.impact()),
        finding.ruleId() + ": " + finding.message());
  }

  public static int severityForImpact(String impact) {
    return switch (impact == null ? "" : impact.toLowerCase()) {
      case "critical", "serious" -> ERROR;
      case "moderate" -> WARNING;
      default -> INFO;
    };
  }
}
