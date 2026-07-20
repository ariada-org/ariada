package org.ariada.eclipse;

public record AriadaMarker(String file, int line, int column, int severity, String message) {
}
