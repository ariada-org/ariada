package org.ariada.gradle;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import org.gradle.api.DefaultTask;
import org.gradle.api.GradleException;
import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.TaskAction;

public abstract class AriadaScanTask extends DefaultTask {
    @Input
    public abstract Property<String> getTargetUrl();

    @Input
    public abstract Property<String> getCliCommand();

    @Input
    public abstract Property<String> getOutputDir();

    @Input
    public abstract Property<String> getDomains();

    @Input
    public abstract Property<String> getSeverityThreshold();

    @Input
    public abstract Property<Boolean> getFailOnViolations();

    private final CliRunner cliRunner;

    public AriadaScanTask() {
        this(new ProcessCliRunner());
    }

    AriadaScanTask(CliRunner cliRunner) {
        this.cliRunner = cliRunner;
    }

    @TaskAction
    public void runScan() {
        String url = getTargetUrl().getOrElse("").trim();
        if (url.isEmpty()) {
            throw new GradleException("ariada.targetUrl must be set before running ariadaScan");
        }

        File outputDirectory = getProject().file(getOutputDir().get());
        if (!outputDirectory.exists() && !outputDirectory.mkdirs()) {
            throw new GradleException("Could not create Ariada output directory: " + outputDirectory);
        }

        CliInvocation invocation = new CliInvocation(
            getCliCommand().get(),
            url,
            outputDirectory.toPath(),
            getDomains().get(),
            getSeverityThreshold().get()
        );

        CliResult cliResult;
        try {
            cliResult = cliRunner.run(invocation);
        } catch (IOException e) {
            throw new GradleException("Could not execute Ariada CLI: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GradleException("Ariada CLI execution was interrupted", e);
        }

        if (!cliResult.stdout().isBlank()) {
            getLogger().lifecycle(cliResult.stdout().trim());
        }
        if (!cliResult.stderr().isBlank()) {
            getLogger().warn(cliResult.stderr().trim());
        }

        Path scanJson = resolveReportPath(outputDirectory.toPath());
        ScanSummary summary;
        try {
            summary = ScanReportParser.parse(scanJson);
        } catch (IOException e) {
            throw new GradleException("Ariada CLI did not produce a readable JSON report at " + scanJson, e);
        }

        getLogger().lifecycle(
            "Ariada scan summary: {} total findings (critical={}, serious={}, moderate={}, minor={})",
            summary.total(),
            summary.critical(),
            summary.serious(),
            summary.moderate(),
            summary.minor()
        );

        if (cliResult.exitCode() > 1) {
            throw new GradleException("Ariada CLI failed with exit code " + cliResult.exitCode());
        }

        if (getFailOnViolations().get() && summary.total() > 0) {
            throw new GradleException("Ariada scan found " + summary.total() + " finding(s)");
        }
    }

    private Path resolveReportPath(Path outputDirectory) {
        Path scanJson = outputDirectory.resolve("scan.json");
        if (scanJson.toFile().isFile()) {
            return scanJson;
        }
        Path multiDomainReport = outputDirectory.resolve("multi-domain-report.json");
        if (multiDomainReport.toFile().isFile()) {
            return multiDomainReport;
        }
        return scanJson;
    }
}
