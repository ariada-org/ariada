package org.ariada.eclipse;

public record AriadaFinding(String file, int line, int column, String impact, String ruleId, String message) {
}
