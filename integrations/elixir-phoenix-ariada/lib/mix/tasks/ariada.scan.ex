defmodule Mix.Tasks.Ariada.Scan do
  @moduledoc """
  Runs an Ariada accessibility scan against a Phoenix URL or static HTML path.

      mix ariada.scan --url http://localhost:4000
      mix ariada.scan --path priv/static/index.html --max-violations 0
  """

  use Mix.Task

  @shortdoc "Runs @ariada-org/cli against a Phoenix-rendered surface"

  @impl Mix.Task
  def run(args) do
    exit_code = run_with(args)

    if exit_code != 0 do
      System.halt(exit_code)
    end
  end

  @doc false
  def run_with(args, runner \\ &System.cmd/3) do
    switches = [url: :string, path: :string, cli: :string, max_violations: :integer]
    aliases = [u: :url, p: :path]

    {parsed, _remaining, invalid} = OptionParser.parse(args, strict: switches, aliases: aliases)

    if invalid != [] do
      Mix.raise("Invalid options: #{inspect(invalid)}")
    end

    case AriadaPhoenix.run_scan(parsed, runner) do
      {:ok, summary} ->
        print_summary(summary)
        0

      {:error, %{total_violations: _} = summary} ->
        print_summary(summary)
        1

      {:error, error} ->
        Mix.shell().error("Ariada scan failed: #{Map.get(error, :message, "unknown error")}")
        exit_code(error)
    end
  end

  defp print_summary(summary) do
    Mix.shell().info("Ariada target: #{summary.target}")
    Mix.shell().info("Ariada violations: #{summary.total_violations}")

    summary.severity_counts
    |> Enum.sort()
    |> Enum.each(fn {severity, count} ->
      Mix.shell().info("  #{severity}: #{count}")
    end)
  end

  defp exit_code(%{exit_code: exit_code}) when is_integer(exit_code) and exit_code > 0, do: exit_code
  defp exit_code(_error), do: 1
end
