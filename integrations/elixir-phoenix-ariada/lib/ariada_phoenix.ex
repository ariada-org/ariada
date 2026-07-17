defmodule AriadaPhoenix do
  @moduledoc """
  Thin Phoenix-facing wrapper around the shared `@ariada-org/cli` scanner.

  The module builds an `ariada scan` command, runs it through an injectable
  runner, parses the JSON output with Jason, and returns a small gate summary.
  It does not implement scanning logic.
  """

  @type scan_options :: [
          url: String.t(),
          path: String.t(),
          cli: String.t(),
          max_violations: non_neg_integer()
        ]

  @type summary :: %{
          total_violations: non_neg_integer(),
          severity_counts: map(),
          passed: boolean(),
          target: String.t()
        }

  @default_url "http://localhost:4000"

  @spec default_target() :: String.t()
  def default_target do
    Application.get_env(:ariada_phoenix, :base_url, @default_url)
  end

  @spec build_args(scan_options()) :: {String.t(), [String.t()], String.t(), non_neg_integer()}
  def build_args(options) do
    target = Keyword.get(options, :url) || Keyword.get(options, :path) || default_target()
    cli = Keyword.get(options, :cli, System.get_env("ARIADA_CLI") || "ariada")
    max_violations = Keyword.get(options, :max_violations, 0)

    {cli, ["scan", target, "--format", "json"], target, max_violations}
  end

  @spec run_scan(scan_options(), function()) :: {:ok, summary()} | {:error, map()}
  def run_scan(options, runner \\ &System.cmd/3) do
    {cli, args, target, max_violations} = build_args(options)
    {stdout, exit_code} = runner.(cli, args, stderr_to_stdout: true)

    case parse_summary(stdout, target, max_violations) do
      {:ok, summary} ->
        if summary.passed and exit_code == 0 do
          {:ok, summary}
        else
          {:error, Map.merge(summary, %{exit_code: exit_code})}
        end

      {:error, reason} ->
        {:error, %{message: reason, raw_output: stdout, exit_code: exit_code, target: target}}
    end
  end

  @spec parse_summary(String.t(), String.t(), non_neg_integer()) ::
          {:ok, summary()} | {:error, String.t()}
  def parse_summary(json, target, max_violations \\ 0) do
    with {:ok, decoded} <- Jason.decode(json) do
      severity_counts = severity_counts(decoded)
      total = Enum.reduce(severity_counts, 0, fn {_severity, count}, acc -> acc + count end)

      {:ok,
       %{
         total_violations: total,
         severity_counts: severity_counts,
         passed: total <= max_violations,
         target: target
       }}
    else
      {:error, %Jason.DecodeError{} = error} -> {:error, Exception.message(error)}
      {:error, reason} -> {:error, inspect(reason)}
    end
  end

  defp severity_counts(%{"summary" => %{"severityCounts" => counts}}) when is_map(counts), do: counts
  defp severity_counts(%{"severityCounts" => counts}) when is_map(counts), do: counts

  defp severity_counts(%{"findings" => findings}) when is_map(findings) do
    findings
    |> Map.values()
    |> List.flatten()
    |> Enum.reduce(%{}, fn finding, acc ->
      severity = Map.get(finding, "severity", "unknown")
      Map.update(acc, severity, 1, &(&1 + 1))
    end)
  end

  defp severity_counts(%{"violations" => violations}) when is_list(violations) do
    Enum.reduce(violations, %{}, fn finding, acc ->
      severity = Map.get(finding, "severity", "unknown")
      Map.update(acc, severity, 1, &(&1 + 1))
    end)
  end

  defp severity_counts(_decoded), do: %{}
end
