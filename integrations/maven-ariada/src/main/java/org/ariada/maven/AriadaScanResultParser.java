// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;

public final class AriadaScanResultParser {
  private static final ObjectMapper JSON = new ObjectMapper();

  public AriadaScanResult parse(Path scanJson) throws IOException {
    JsonNode root = JSON.readTree(Files.readString(scanJson));
    if (root.has("grid")) {
      return parseMultiDomainReport(root);
    }
    return parseScanEnvelope(root);
  }

  private AriadaScanResult parseScanEnvelope(JsonNode root) {
    JsonNode summary = root.path("summary");
    EnumMap<Severity, Integer> counts = new EnumMap<>(Severity.class);
    JsonNode byImpact = summary.path("byImpact");
    for (Severity severity : Severity.values()) {
      int count = byImpact.path(severity.cliName()).asInt(0);
      counts.put(severity, count);
    }
    return new AriadaScanResult(
        root.path("url").asText(""),
        root.path("scanId").asText(""),
        summary.path("total").asInt(0),
        counts,
        root.path("exitCode").asInt(0));
  }

  private AriadaScanResult parseMultiDomainReport(JsonNode root) {
    EnumMap<Severity, Integer> counts = new EnumMap<>(Severity.class);
    for (Severity severity : Severity.values()) {
      counts.put(severity, 0);
    }

    String firstUrl = root.path("sites").path(0).asText("");
    String scanId = "";
    int total = 0;
    JsonNode grid = root.path("grid");
    for (JsonNode siteNode : grid) {
      for (JsonNode domainFindings : siteNode) {
        for (JsonNode finding : domainFindings) {
          Severity severity = Severity.parse(finding.path("severity").asText("moderate"));
          counts.put(severity, counts.get(severity) + 1);
          if (scanId.isBlank()) {
            scanId = finding.path("scanId").asText("");
          }
          total++;
        }
      }
    }

    return new AriadaScanResult(firstUrl, scanId, total, counts, total > 0 ? 1 : 0);
  }
}
