// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

using Ariada.DotNet.Core;
using Microsoft.Build.Framework;
using Microsoft.Build.Utilities;

namespace Ariada.DotNet.MSBuild;

public sealed class AriadaScanTask: Task
{
 [Required]
 public string Target { get; set; } = "";

 public string OutputDirectory { get; set; } = "obj/ariada-output";

 public string CliCommand { get; set; } = "ariada";

 public string Browser { get; set; } = "chromium";

 public string SeverityThreshold { get; set; } = "moderate";

 public string Domains { get; set; } = "";

 public int TimeoutMilliseconds { get; set; } = 30000;

 public override bool Execute()
 {
 try
 {
 var options = new AriadaOptions(
 Target,
 OutputDirectory,
 CliCommand,
 Browser,
 "json",
 SeverityThreshold,
 TimeoutMilliseconds,
 SplitDomains(Domains));

 var result = new AriadaCliRunner().RunAsync(options).GetAwaiter().GetResult();
 Log.LogMessage(MessageImportance.High, result.StandardOutput);
 if (!string.IsNullOrWhiteSpace(result.StandardError))
 {
 Log.LogWarning(result.StandardError);
 }

 if (result.GateFailed)
 {
 Log.LogError($"Ariada scan failed the gate with {result.Findings.Count} finding(s). Report: {result.ReportPath ?? "not written"}");
 return false;
 }

 return !result.RuntimeFailed;
 }
 catch (Exception ex)
 {
 Log.LogErrorFromException(ex, showStackTrace: true);
 return false;
 }
 }

 private static IReadOnlyList<string> SplitDomains(string domains)
 {
 return string.IsNullOrWhiteSpace(domains)
 ? Array.Empty<string>()
: domains.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
 }
}

