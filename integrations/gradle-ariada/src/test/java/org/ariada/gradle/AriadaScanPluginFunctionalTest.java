package org.ariada.gradle;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import org.gradle.testkit.runner.BuildResult;
import org.gradle.testkit.runner.GradleRunner;
import org.gradle.testkit.runner.TaskOutcome;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class AriadaScanPluginFunctionalTest {
    @TempDir
    Path tempDir;

    @Test
    void failsBuildWhenStubCliReportsFindings() throws Exception {
        writeSampleBuild(true);

        BuildResult result = GradleRunner.create()
            .withProjectDir(tempDir.toFile())
            .withArguments("ariadaScan", "--stacktrace")
            .withPluginClasspath()
            .buildAndFail();

        assertTrue(result.getOutput().contains("Ariada scan found 1 finding(s)"));
        assertTrue(Files.exists(tempDir.resolve("build/ariada/multi-domain-report.json")));
    }

    @Test
    void canReportFindingsWithoutFailingWhenGateDisabled() throws Exception {
        writeSampleBuild(false);

        BuildResult result = GradleRunner.create()
            .withProjectDir(tempDir.toFile())
            .withArguments("ariadaScan")
            .withPluginClasspath()
            .build();

        assertTrue(result.getOutput().contains("Ariada scan summary: 1 total findings"));
        assertTrue(result.task(":ariadaScan").getOutcome() == TaskOutcome.SUCCESS);
    }

    private void writeSampleBuild(boolean failOnViolations) throws Exception {
        Path stubCli = tempDir.resolve("stub-ariada-cli.sh");
        Files.writeString(stubCli, """
            #!/usr/bin/env bash
            set -euo pipefail
            out_dir=""
            while [[ $# -gt 0 ]]; do
              case "$1" in
                --output-dir)
                  out_dir="$2"
                  shift 2
                  ;;
                *)
                  shift
                  ;;
              esac
            done
            mkdir -p "$out_dir"
            cat > "$out_dir/multi-domain-report.json" <<'JSON'
            {
              "sites": ["http://127.0.0.1:4173/"],
              "domains": ["accessibility"],
              "grid": {
                "http://127.0.0.1:4173/": {
                  "accessibility": [
                  {
                    "ruleId": "image-alt",
                    "severity": "serious",
                    "message": "Image missing alternative text"
                  }
                  ]
                }
              }
            }
            JSON
            echo "Wrote $out_dir/multi-domain-report.json"
            exit 1
            """);
        stubCli.toFile().setExecutable(true);

        Files.writeString(tempDir.resolve("settings.gradle.kts"), "rootProject.name = \"sample-gradle-ariada\"\n");
        Files.writeString(tempDir.resolve("build.gradle.kts"), """
            plugins {
                id("org.ariada.scan")
            }

            ariada {
                targetUrl.set("http://127.0.0.1:4173/")
                cliCommand.set("%s")
                domains.set("accessibility")
                severityThreshold.set("moderate")
                failOnViolations.set(%s)
            }
            """.formatted(stubCli.toAbsolutePath(), failOnViolations));
    }
}
