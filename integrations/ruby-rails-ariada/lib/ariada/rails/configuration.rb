module Ariada
 module Rails
 class Configuration
 attr_accessor:cli_command,
:output_dir,
:browser,
:format,
:severity_threshold,
:timeout_ms,
:domains,
:targets

 def initialize
 @cli_command = "ariada"
 @output_dir = "ariada-output"
 @browser = "chromium"
 @format = "json"
 @severity_threshold = "moderate"
 @timeout_ms = 30_000
 @domains = []
 @targets = []
 end
 end
 end
end
