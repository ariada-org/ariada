// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

using Ariada.DotNet.Core;
using Xunit;

namespace Ariada.DotNet.Tests;

public sealed class AriadaReportParserTests
{
    [Fact]
    public void ParsesMultiDomainGridFindings()
    {
        var findings = AriadaReportParser.ParseFindings(
            """
            {
              "sites": ["http://example.test/"],
              "domains": ["accessibility"],
              "grid": {
                "http://example.test/": {
                  "accessibility": [
                    {"ruleId": "image-alt", "severity": "critical"},
                    {"ruleId": "button-name", "severity": "serious"}
                  ]
                }
              }
            }
            """);

        Assert.Equal(2, findings.Count);
        Assert.Contains(findings, f => f.RuleId == "image-alt" && f.Severity == "critical");
    }

    [Fact]
    public void BuildsCliCommandWithDomains()
    {
        var command = AriadaCliRunner.BuildCommand(new AriadaOptions(
            "http://example.test/",
            "out",
            "ariada",
            "chromium",
            "json",
            "serious",
            15000,
            new[] { "accessibility", "security" }));

        Assert.Equal("ariada", command[0]);
        Assert.Contains("--domains", command);
        Assert.Contains("accessibility,security", command);
    }

    [Fact]
    public async Task RunnerReportsGateFailureFromStubbedCli()
    {
        using var temp = new TempDirectory();
        var runner = new AriadaCliRunner(new StubProcessRunner(temp.Path));

        var result = await runner.RunAsync(new AriadaOptions("http://example.test/", temp.Path));

        Assert.True(result.GateFailed);
        Assert.Equal(1, result.ExitCode);
        Assert.Single(result.Findings);
    }

    [Fact]
    public async Task RunnerServesStaticOutputDirectoryBeforeCallingCli()
    {
        using var staticRoot = new TempDirectory();
        using var output = new TempDirectory();
        File.WriteAllText(System.IO.Path.Combine(staticRoot.Path, "index.html"), "<html><body><button></button></body></html>");
        var runner = new AriadaCliRunner(new CapturingProcessRunner(output.Path));

        var result = await runner.RunAsync(new AriadaOptions(staticRoot.Path, output.Path));

        Assert.Equal(staticRoot.Path, result.Target);
    }

    private sealed class CapturingProcessRunner : IAriadaProcessRunner
    {
        private readonly string outputDirectory;

        public CapturingProcessRunner(string outputDirectory)
        {
            this.outputDirectory = outputDirectory;
        }

        public Task<ProcessResult> RunAsync(IReadOnlyList<string> command, CancellationToken cancellationToken)
        {
            Assert.StartsWith("http://127.0.0.1:", command[2]);
            File.WriteAllText(
                System.IO.Path.Combine(outputDirectory, "multi-domain-report.json"),
                """
                {"grid":{"http://127.0.0.1/":{"accessibility":[]}}}
                """);
            return Task.FromResult(new ProcessResult(0, "Wrote report\n", ""));
        }
    }

    private sealed class StubProcessRunner : IAriadaProcessRunner
    {
        private readonly string outputDirectory;

        public StubProcessRunner(string outputDirectory)
        {
            this.outputDirectory = outputDirectory;
        }

        public Task<ProcessResult> RunAsync(IReadOnlyList<string> command, CancellationToken cancellationToken)
        {
            File.WriteAllText(
                Path.Combine(outputDirectory, "multi-domain-report.json"),
                """
                {"grid":{"http://example.test/":{"accessibility":[{"ruleId":"image-alt","severity":"critical"}]}}}
                """);
            return Task.FromResult(new ProcessResult(1, "Wrote report\n", ""));
        }
    }

    private sealed class TempDirectory : IDisposable
    {
        public TempDirectory()
        {
            Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"ariada-dotnet-{Guid.NewGuid():N}");
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            Directory.Delete(Path, recursive: true);
        }
    }
}
