// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

using Ariada.DotNet.Core;

return await DotNetAriadaProgram.RunAsync(args).ConfigureAwait(false);

internal static class DotNetAriadaProgram
{
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0 || args[0] is "-h" or "--help")
        {
            PrintHelp();
            return 0;
        }

        if (!string.Equals(args[0], "scan", StringComparison.OrdinalIgnoreCase))
        {
            Console.Error.WriteLine("Unknown command. Expected: scan");
            return 2;
        }

        var parsed = ParseScanArgs(args.Skip(1).ToArray());
        if (parsed is null)
        {
            return 2;
        }

        var result = await new AriadaCliRunner().RunAsync(parsed).ConfigureAwait(false);
        Console.Write(result.StandardOutput);
        if (!string.IsNullOrWhiteSpace(result.StandardError))
        {
            Console.Error.Write(result.StandardError);
        }

        Console.WriteLine($"Ariada .NET scan: {result.Findings.Count} finding(s), report: {result.ReportPath ?? "not written"}");
        return result.ExitCode;
    }

    private static AriadaOptions? ParseScanArgs(string[] args)
    {
        if (args.Length == 0)
        {
            Console.Error.WriteLine("Missing scan target.");
            return null;
        }

        var target = args[0];
        var output = "ariada-output";
        var cli = "ariada";
        var browser = "chromium";
        var threshold = "moderate";
        var timeout = 30000;
        IReadOnlyList<string>? domains = null;

        for (var i = 1; i < args.Length; i++)
        {
            var arg = args[i];
            if (arg is "--output-dir" or "-o" && TryReadValue(args, ref i, out var outputValue))
            {
                output = outputValue;
            }
            else if (arg == "--cli" && TryReadValue(args, ref i, out var cliValue))
            {
                cli = cliValue;
            }
            else if (arg == "--browser" && TryReadValue(args, ref i, out var browserValue))
            {
                browser = browserValue;
            }
            else if (arg == "--threshold" && TryReadValue(args, ref i, out var thresholdValue))
            {
                threshold = thresholdValue;
            }
            else if (arg == "--timeout-ms" && TryReadValue(args, ref i, out var timeoutValue) && int.TryParse(timeoutValue, out var parsedTimeout))
            {
                timeout = parsedTimeout;
            }
            else if (arg == "--domains" && TryReadValue(args, ref i, out var domainsValue))
            {
                domains = domainsValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            }
            else
            {
                Console.Error.WriteLine($"Unknown or incomplete option: {arg}");
                return null;
            }
        }

        return new AriadaOptions(target, output, cli, browser, "json", threshold, timeout, domains);
    }

    private static bool TryReadValue(string[] args, ref int index, out string value)
    {
        if (index + 1 >= args.Length)
        {
            value = "";
            return false;
        }

        index++;
        value = args[index];
        return true;
    }

    private static void PrintHelp()
    {
        Console.WriteLine("dotnet-ariada scan <url-or-static-output-dir> [--threshold serious] [--domains accessibility,security]");
    }
}
