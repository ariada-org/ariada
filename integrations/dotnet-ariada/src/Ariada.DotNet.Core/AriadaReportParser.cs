// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

using System.Text.Json;

namespace Ariada.DotNet.Core;

public static class AriadaReportParser
{
 public static IReadOnlyList<AriadaFinding> ParseFindings(string json)
 {
 using var document = JsonDocument.Parse(json);
 var root = document.RootElement;
 var findings = new List<AriadaFinding>();

 if (root.TryGetProperty("grid", out var grid) && grid.ValueKind == JsonValueKind.Object)
 {
 foreach (var site in grid.EnumerateObject())
 {
 if (site.Value.ValueKind != JsonValueKind.Object)
 {
 continue;
 }

 foreach (var domain in site.Value.EnumerateObject())
 {
 if (domain.Value.ValueKind != JsonValueKind.Array)
 {
 continue;
 }

 foreach (var finding in domain.Value.EnumerateArray())
 {
 findings.Add(ReadFinding(finding, domain.Name));
 }
 }
 }
 }

 if (root.TryGetProperty("report", out var report) &&
 report.ValueKind == JsonValueKind.Object &&
 report.TryGetProperty("findings", out var singleFindings))
 {
 ReadSingleScanFindings(singleFindings, findings);
 }

 return findings;
 }

 public static IReadOnlyList<AriadaFinding> ParseReportFile(string reportPath)
 {
 return File.Exists(reportPath)
 ? ParseFindings(File.ReadAllText(reportPath))
: Array.Empty<AriadaFinding>();
 }

 private static void ReadSingleScanFindings(JsonElement value, List<AriadaFinding> findings)
 {
 if (value.ValueKind == JsonValueKind.Array)
 {
 foreach (var item in value.EnumerateArray())
 {
 findings.Add(ReadFinding(item, "accessibility"));
 }
 }

 if (value.ValueKind == JsonValueKind.Object)
 {
 foreach (var group in value.EnumerateObject())
 {
 if (group.Value.ValueKind != JsonValueKind.Array)
 {
 continue;
 }

 foreach (var item in group.Value.EnumerateArray())
 {
 findings.Add(ReadFinding(item, group.Name));
 }
 }
 }
 }

 private static AriadaFinding ReadFinding(JsonElement finding, string domain)
 {
 return new AriadaFinding(
 ReadString(finding, "ruleId", "rule"),
 ReadString(finding, "severity", "moderate"),
 domain);
 }

 private static string ReadString(JsonElement element, string name, string fallback)
 {
 return element.ValueKind == JsonValueKind.Object &&
 element.TryGetProperty(name, out var value) &&
 value.ValueKind == JsonValueKind.String
 ? value.GetString() ?? fallback
: fallback;
 }
}

