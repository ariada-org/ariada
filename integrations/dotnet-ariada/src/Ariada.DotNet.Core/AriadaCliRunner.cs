// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

namespace Ariada.DotNet.Core;

public interface IAriadaProcessRunner
{
 Task<ProcessResult> RunAsync(IReadOnlyList<string> command, CancellationToken cancellationToken);
}

public sealed record ProcessResult(int ExitCode, string StandardOutput, string StandardError);

public sealed class SystemProcessRunner: IAriadaProcessRunner
{
 public async Task<ProcessResult> RunAsync(IReadOnlyList<string> command, CancellationToken cancellationToken)
 {
 if (command.Count == 0)
 {
 throw new ArgumentException("Command must not be empty.", nameof(command));
 }

 var start = new ProcessStartInfo
 {
 FileName = command[0],
 RedirectStandardOutput = true,
 RedirectStandardError = true,
 UseShellExecute = false,
 };

 foreach (var arg in command.Skip(1))
 {
 start.ArgumentList.Add(arg);
 }

 using var process = Process.Start(start) ?? throw new InvalidOperationException("Could not start Ariada CLI.");
 var stdout = process.StandardOutput.ReadToEndAsync(cancellationToken);
 var stderr = process.StandardError.ReadToEndAsync(cancellationToken);
 await process.WaitForExitAsync(cancellationToken).ConfigureAwait(false);
 return new ProcessResult(process.ExitCode, await stdout.ConfigureAwait(false), await stderr.ConfigureAwait(false));
 }
}

public sealed class AriadaCliRunner
{
 private readonly IAriadaProcessRunner processRunner;

 public AriadaCliRunner(IAriadaProcessRunner? processRunner = null)
 {
 this.processRunner = processRunner ?? new SystemProcessRunner();
 }

 public async Task<AriadaScanResult> RunAsync(AriadaOptions options, CancellationToken cancellationToken = default)
 {
 Directory.CreateDirectory(options.OutputDirectory);
 await using var served = LocalStaticTarget.TryServe(options.Target, cancellationToken);
 var command = BuildCommand(options with { Target = served.Url });
 var completed = await processRunner.RunAsync(command, cancellationToken).ConfigureAwait(false);
 var reportPath = FindReport(options.OutputDirectory);
 var findings = reportPath is null ? Array.Empty<AriadaFinding>(): AriadaReportParser.ParseReportFile(reportPath);

 return new AriadaScanResult(
 options.Target,
 completed.ExitCode,
 completed.StandardOutput,
 completed.StandardError,
 reportPath,
 findings);
 }

 public static IReadOnlyList<string> BuildCommand(AriadaOptions options)
 {
 var command = new List<string>
 {
 options.CliCommand,
 "scan",
 options.Target,
 "--format",
 options.Format,
 "--output-dir",
 options.OutputDirectory,
 "--browser",
 options.Browser,
 "--severity-threshold",
 options.SeverityThreshold,
 "--timeout-ms",
 options.TimeoutMilliseconds.ToString(),
 };

 if (options.Domains is { Count: > 0 })
 {
 command.Add("--domains");
 command.Add(string.Join(",", options.Domains));
 }

 return command;
 }

 private static string? FindReport(string outputDirectory)
 {
 var multi = Path.Combine(outputDirectory, "multi-domain-report.json");
 if (File.Exists(multi))
 {
 return multi;
 }

 var single = Path.Combine(outputDirectory, "scan.json");
 return File.Exists(single) ? single: null;
 }
}

internal sealed class ServedTarget: IAsyncDisposable
{
 private readonly HttpListener? listener;
 private readonly Task? serverTask;

 public ServedTarget(string url, HttpListener? listener = null, Task? serverTask = null)
 {
 Url = url;
 this.listener = listener;
 this.serverTask = serverTask;
 }

 public string Url { get; }

 public async ValueTask DisposeAsync()
 {
 if (listener is null)
 {
 return;
 }

 listener.Stop();
 listener.Close();
 if (serverTask is not null)
 {
 try
 {
 await serverTask.ConfigureAwait(false);
 }
 catch (HttpListenerException)
 {
 }
 catch (ObjectDisposedException)
 {
 }
 }
 }
}

internal static class LocalStaticTarget
{
 public static ServedTarget TryServe(string target, CancellationToken cancellationToken)
 {
 if (!Directory.Exists(target))
 {
 return new ServedTarget(target);
 }

 var root = Path.GetFullPath(target);
 var port = ReserveLoopbackPort();
 var url = $"http://127.0.0.1:{port}/";
 var listener = new HttpListener();
 listener.Prefixes.Add(url);
 listener.Start();
 var task = Task.Run(() => ServeAsync(listener, root, cancellationToken), cancellationToken);
 return new ServedTarget(url, listener, task);
 }

 private static async Task ServeAsync(HttpListener listener, string root, CancellationToken cancellationToken)
 {
 while (listener.IsListening && !cancellationToken.IsCancellationRequested)
 {
 var context = await listener.GetContextAsync().ConfigureAwait(false);
 _ = Task.Run(() => RespondAsync(context, root), cancellationToken);
 }
 }

 private static async Task RespondAsync(HttpListenerContext context, string root)
 {
 var raw = context.Request.Url?.AbsolutePath.TrimStart('/') ?? "";
 var relative = string.IsNullOrWhiteSpace(raw) ? "index.html": Uri.UnescapeDataString(raw);
 var candidate = Path.GetFullPath(Path.Combine(root, relative));
 if (!candidate.StartsWith(root, StringComparison.Ordinal) || !File.Exists(candidate))
 {
 context.Response.StatusCode = 404;
 context.Response.Close();
 return;
 }

 var bytes = await File.ReadAllBytesAsync(candidate).ConfigureAwait(false);
 context.Response.ContentType = ContentTypeFor(candidate);
 context.Response.ContentLength64 = bytes.Length;
 await context.Response.OutputStream.WriteAsync(bytes).ConfigureAwait(false);
 context.Response.Close();
 }

 private static int ReserveLoopbackPort()
 {
 var listener = new TcpListener(IPAddress.Loopback, 0);
 listener.Start();
 var port = ((IPEndPoint)listener.LocalEndpoint).Port;
 listener.Stop();
 return port;
 }

 private static string ContentTypeFor(string path)
 {
 return Path.GetExtension(path).ToLowerInvariant() switch
 {
 ".html" => "text/html; charset=utf-8",
 ".css" => "text/css; charset=utf-8",
 ".js" => "text/javascript; charset=utf-8",
 ".json" => "application/json; charset=utf-8",
 ".png" => "image/png",
 ".jpg" or ".jpeg" => "image/jpeg",
 ".svg" => "image/svg+xml",
 _ => "application/octet-stream",
 };
 }
}
