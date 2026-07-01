require "test_helper"
require "jekyll/ariada"

class PluginTest < Minitest::Test
  Site = Struct.new(:config, :dest, keyword_init: true)

  def test_reads_jekyll_config_and_defaults_to_site_dest
    site = Site.new(
      dest: "_site",
      config: {
        "ariada" => {
          "gate" => false,
          "cli_command" => "bundle exec ariada",
          "output_dir" => "scan-evidence/ariada-output",
          "domains" => ["accessibility"]
        }
      }
    )

    config = Jekyll::Ariada::Configuration.from_site(site)

    assert config.enabled
    refute config.gate
    assert_equal "bundle exec ariada", config.cli_command
    assert_equal "_site", config.target
    assert_equal ["accessibility"], config.domains
  end

  def test_plugin_raises_when_gate_is_enabled_and_cli_finds_violations
    Dir.mktmpdir("jekyll-ariada-plugin") do |dir|
      output_dir = File.join(dir, "out")
      FileUtils.mkdir_p(output_dir)
      File.write(
        File.join(output_dir, "scan.json"),
        JSON.pretty_generate("summary" => { "total" => 1 })
      )
      site = Site.new(
        dest: "_site",
        config: {
          "ariada" => {
            "target" => "https://example.test",
            "output_dir" => output_dir,
            "gate" => true
          }
        }
      )
      runner = ->(_command) { ["Wrote #{output_dir}/scan.json\n", "", 1] }

      assert_raises(Jekyll::Errors::FatalException) do
        Jekyll::Ariada.run(site, runner: runner)
      end
    end
  end

  def test_plugin_returns_nil_when_disabled
    site = Site.new(dest: "_site", config: { "ariada" => { "enabled" => false } })

    assert_nil Jekyll::Ariada.run(site, runner: ->(_command) { raise "should not run" })
  end
end
