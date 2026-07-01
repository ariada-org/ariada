require "test_helper"

class ScannerTest < Minitest::Test
  def test_builds_shared_cli_scan_command
    scanner = Jekyll::Ariada::Scanner.new({
      cli_command: "node ../../packages/ariada-cli/dist/bin.js",
      output_dir: "tmp/out",
      domains: %w[accessibility privacy]
    })

    assert_equal(
      [
        "node",
        "../../packages/ariada-cli/dist/bin.js",
        "scan",
        "https://example.test",
        "--format",
        "json",
        "--output-dir",
        "tmp/out",
        "--browser",
        "chromium",
        "--severity-threshold",
        "moderate",
        "--timeout-ms",
        "30000",
        "--domains",
        "accessibility,privacy"
      ],
      scanner.command_for("https://example.test")
    )
  end

  def test_returns_gate_failure_from_fixture_json
    Dir.mktmpdir("jekyll-ariada") do |dir|
      File.write(
        File.join(dir, "scan.json"),
        JSON.pretty_generate("summary" => { "total" => 3 }, "report" => { "findings" => [] })
      )
      runner = ->(_command) { ["Wrote #{dir}/scan.json\n", "", 1] }

      result = Jekyll::Ariada::Scanner.new({ output_dir: dir }, runner: runner).scan("https://example.test")

      assert result.gate_failed?
      refute result.runtime_failed?
      assert_equal 3, result.total_findings
      assert_match(/scan\.json\z/, result.report_path)
    end
  end

  def test_counts_multi_domain_grid_findings
    Dir.mktmpdir("jekyll-ariada-grid") do |dir|
      File.write(
        File.join(dir, "multi-domain-report.json"),
        JSON.generate(
          "grid" => {
            "https://example.test" => {
              "accessibility" => [{ "ruleId" => "image-alt" }],
              "security" => [{ "ruleId" => "csp" }]
            }
          }
        )
      )

      result = Jekyll::Ariada::Scanner.new({ output_dir: dir }, runner: ->(_command) { ["", "", 0] }).scan("/")

      assert_equal 2, result.total_findings
      assert_match(/multi-domain-report\.json\z/, result.report_path)
    end
  end
end
