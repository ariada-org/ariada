#!/usr/bin/env ruby
# frozen_string_literal: true

require "open3"
require "webrick"

root = File.expand_path("../examples/minimal_rails_surface", __dir__)
output_dir = File.expand_path("../scan-evidence/ariada-output", __dir__)
cli = ENV.fetch("ARIADA_CLI", "node../../packages/ariada-cli/dist/bin.js")

server = WEBrick::HTTPServer.new(
 BindAddress: "127.0.0.1",
 Port: 0,
 DocumentRoot: root,
 Logger: WEBrick::Log.new(File::NULL),
 AccessLog: []
)

thread = Thread.new { server.start }
begin
 sleep 0.2 until server.status ==:Running
 url = "http://127.0.0.1:#{server.config[:Port]}/index.html"
 env = {
 "ARIADA_TARGET" => url,
 "ARIADA_CLI" => cli,
 "ARIADA_OUTPUT_DIR" => output_dir,
 "ARIADA_DOMAINS" => ENV.fetch("ARIADA_DOMAINS", "accessibility")
 }

 stdout, stderr, status = Open3.capture3(env, "bundle", "exec", "rake", "ariada:scan")
 puts stdout unless stdout.empty?
 warn stderr unless stderr.empty?
 exit status.exitstatus
ensure
 server.shutdown
 thread.join
end
