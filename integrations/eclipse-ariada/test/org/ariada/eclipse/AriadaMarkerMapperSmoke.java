package org.ariada.eclipse;

public final class AriadaMarkerMapperSmoke {
  private AriadaMarkerMapperSmoke() {
  }

  public static void main(String[] args) {
    AriadaFinding finding = new AriadaFinding("index.html", 12, 4, "serious", "image-alt", "Images need alt text");
    AriadaMarker marker = AriadaMarkerMapper.toMarker(finding);
    if (marker.severity() != AriadaMarkerMapper.ERROR) {
      throw new IllegalStateException("serious findings must map to error markers");
    }
    if (!marker.message().contains("image-alt")) {
      throw new IllegalStateException("marker message must include Ariada rule id");
    }
    System.out.println("PASS Eclipse marker mapper smoke");
  }
}
