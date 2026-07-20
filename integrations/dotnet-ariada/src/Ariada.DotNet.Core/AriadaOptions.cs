// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada.DotNet.Core;

public sealed record AriadaOptions(
    string Target,
    string OutputDirectory,
    string CliCommand = "ariada",
    string Browser = "chromium",
    string Format = "json",
    string SeverityThreshold = "moderate",
    int TimeoutMilliseconds = 30000,
    IReadOnlyList<string>? Domains = null);

public sealed record AriadaFinding(string RuleId, string Severity, string Domain);

public sealed record AriadaScanResult(
    string Target,
    int ExitCode,
    string StandardOutput,
    string StandardError,
    string? ReportPath,
    IReadOnlyList<AriadaFinding> Findings)
{
    public bool GateFailed => ExitCode == 1;

    public bool RuntimeFailed => ExitCode >= 2;
}
