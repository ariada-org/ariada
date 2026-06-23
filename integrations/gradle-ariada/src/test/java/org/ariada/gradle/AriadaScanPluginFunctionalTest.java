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
        assertTrue(Files.exists(tempDir.resolve("build/ariada/scan.json")));
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
            cat > "$out_dir/scan.json" <<'JSON'
            {
              "$schema": "https://ariada.org/schemas/cli-scan.v1.json",
              "summary": {
                "total": 1,
                "byImpact": {
                  "critical": 0,
                  "serious": 1,
                  "moderate": 0,
                  "minor": 0
                }
              },
              "report": {
                "findings": [
                  {
                    "ruleId": "image-alt",
                    "severity": "serious",
                    "message": "Image missing alternative text"
                  }
                ]
              },
              "exitCode": 1
            }
            JSON
            echo "Wrote $out_dir/scan.json"
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
