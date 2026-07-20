#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "open3"
require "socket"
require "webrick"

ROOT = File.expand_path("..", __dir__)
REPO = File.expand_path("../..", __dir__)
SCAN_EVIDENCE = File.join(ROOT, "scan-evidence")
OUTPUT_DIR = File.join(SCAN_EVIDENCE, "ariada-output")
COMMAND_LOG = File.join(SCAN_EVIDENCE, "command.log")
COMMAND_EXIT = File.join(SCAN_EVIDENCE, "command.exit")

def free_port
  server = TCPServer.new("127.0.0.1", 0)
  port = server.addr[1]
  server.close
  port
end

def cli_command
  env = ENV["ARIADA_CLI"]
  return env.split if env && !env.empty?

  ["node", File.join(REPO, "packages/ariada-cli/dist/bin.js")]
end

def jekyll_available?
  _stdout, _stderr, status = Open3.capture3("bundle", "exec", "jekyll", "--version", chdir: ROOT)
  status.success?
end

def build_jekyll_fixture
  return [File.join(ROOT, "fixtures/static-site"), "blocked: bundle exec jekyll is unavailable"] unless jekyll_available?

  source = File.join(ROOT, "fixtures/jekyll-site")
  dest = File.join(source, "_site")
  stdout, stderr, status = Open3.capture3(
    "bundle",
    "exec",
    "jekyll",
    "build",
    "--source",
    source,
    "--destination",
    dest,
    "--config",
    File.join(source, "_config.yml"),
    chdir: ROOT
  )
  return [dest, "built: #{stdout}#{stderr}"] if status.success?
  if File.exist?(File.join(dest, "index.html"))
    return [dest, "built with expected Ariada gate exit #{status.exitstatus}: #{stdout}#{stderr}"]
  end

  [File.join(ROOT, "fixtures/static-site"), "blocked: jekyll build exit #{status.exitstatus}: #{stdout}#{stderr}"]
end

def serve(root)
  port = free_port
  logger = WEBrick::Log.new(File::NULL)
  server = WEBrick::HTTPServer.new(
    BindAddress: "127.0.0.1",
    Port: port,
    DocumentRoot: root,
    Logger: logger,
    AccessLog: []
  )
  thread = Thread.new { server.start }
  sleep 0.3
  [server, thread, "http://127.0.0.1:#{port}/"]
end

FileUtils.rm_rf(OUTPUT_DIR)
FileUtils.mkdir_p(OUTPUT_DIR)
site_root, build_note = build_jekyll_fixture
server, thread, url = serve(site_root)
command = cli_command + [
  "scan",
  url,
  "--format",
  "json",
  "--output-dir",
  OUTPUT_DIR,
  "--browser",
  ENV.fetch("ARIADA_BROWSER", "chromium"),
  "--severity-threshold",
  "minor",
  "--timeout-ms",
  "30000"
]

stdout, stderr, status = Open3.capture3(*command, chdir: REPO)
File.write(
  COMMAND_LOG,
  [
    "Fixture root: #{site_root}",
    "Jekyll host status: #{build_note}",
    "Command: #{command.join(' ')}",
    "",
    "STDOUT:",
    stdout,
    "",
    "STDERR:",
    stderr
  ].join("\n")
)
File.write(COMMAND_EXIT, "#{status.exitstatus}\n")
server.shutdown
thread.join
exit(status.exitstatus || 3)
