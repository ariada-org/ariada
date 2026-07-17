defmodule AriadaPhoenixTest do
  use ExUnit.Case, async: false

  test "builds the shared Ariada CLI command for Phoenix default URL" do
    {cli, args, target, max_violations} = AriadaPhoenix.build_args([])

    assert cli == "ariada"
    assert args == ["scan", "http://localhost:4000", "--format", "json"]
    assert target == "http://localhost:4000"
    assert max_violations == 0
  end

  test "parses multi-domain CLI findings into a CI gate failure" do
    json = File.read!("test/fixtures/ariada_output.json")

    assert {:ok, summary} =
             AriadaPhoenix.parse_summary(json, "test/fixtures/phoenix_static_output/index.html", 0)

    assert summary.total_violations == 3
    refute summary.passed
    assert summary.severity_counts["serious"] == 2
  end

  test "uses an injected runner instead of implementing scanning" do
    runner = fn "ariada", ["scan", "https://example.test", "--format", "json"], _opts ->
      {File.read!("test/fixtures/ariada_output.json"), 0}
    end

    assert {:error, summary} = AriadaPhoenix.run_scan([url: "https://example.test"], runner)
    assert summary.total_violations == 3
    assert summary.exit_code == 0
  end

  test "mix task returns zero when the configured gate passes" do
    Mix.shell(Mix.Shell.Process)

    try do
      runner = fn "ariada", ["scan", "https://example.test", "--format", "json"], _opts ->
        {File.read!("test/fixtures/ariada_output.json"), 0}
      end

      assert Mix.Tasks.Ariada.Scan.run_with(
               ["--url", "https://example.test", "--max-violations", "3"],
               runner
             ) == 0

      assert_received {:mix_shell, :info, ["Ariada target: https://example.test"]}
      assert_received {:mix_shell, :info, ["Ariada violations: 3"]}
    after
      Mix.shell(Mix.Shell.IO)
    end
  end

  test "mix task returns a CI failure code when the gate fails" do
    Mix.shell(Mix.Shell.Process)

    try do
      runner = fn "ariada", ["scan", "https://example.test", "--format", "json"], _opts ->
        {File.read!("test/fixtures/ariada_output.json"), 0}
      end

      assert Mix.Tasks.Ariada.Scan.run_with(["--url", "https://example.test"], runner) == 1
      assert_received {:mix_shell, :info, ["Ariada violations: 3"]}
    after
      Mix.shell(Mix.Shell.IO)
    end
  end
end
