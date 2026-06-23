require "spec_helper"

RSpec.describe "ariada:scan rake task" do
 before do
 Rake.application = Rake::Application.new
 load File.expand_path("../lib/tasks/ariada.rake", __dir__)
 end

 after do
 Rake.application = nil
 Ariada::Rails.configuration.targets = []
 end

 it "uses ARIADA_TARGET as the scan target" do
 previous = ENV["ARIADA_TARGET"]
 ENV["ARIADA_TARGET"] = "https://example.test"
 scanned = nil

 allow(Ariada::Rails).to receive(:scan) do |target|
 scanned = target
 Ariada::Rails::ScanResult.new(
 target: target,
 exit_code: 0,
 stdout: "ok\n",
 stderr: "",
 report_path: nil,
 total_findings: 0
)
 end

 Rake::Task["ariada:scan"].invoke

 expect(scanned).to eq("https://example.test")
 ensure
 ENV["ARIADA_TARGET"] = previous
 end

 it "falls back to configured Rails targets" do
 previous = ENV.delete("ARIADA_TARGET")
 Ariada::Rails.configuration.targets = ["/"]

 allow(Ariada::Rails).to receive(:scan).and_return(
 Ariada::Rails::ScanResult.new(
 target: "/",
 exit_code: 0,
 stdout: "",
 stderr: "",
 report_path: nil,
 total_findings: 0
)
)

 Rake::Task["ariada:scan"].invoke

 expect(Ariada::Rails).to have_received(:scan).with("/")
 ensure
 ENV["ARIADA_TARGET"] = previous
 end
end
