// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoExecutionException;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.LifecyclePhase;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

@Mojo(name = "scan", defaultPhase = LifecyclePhase.VERIFY, threadSafe = true)
public final class ScanMojo extends AbstractMojo {
  @Parameter(property = "ariada.url")
  private String url;

  @Parameter(property = "ariada.siteDirectory", defaultValue = "${project.build.directory}/site")
  private File siteDirectory;

  @Parameter(property = "ariada.outputDirectory", defaultValue = "${project.build.directory}/ariada")
  private File outputDirectory;

  @Parameter(property = "ariada.cliExecutable", defaultValue = "npx")
  private String cliExecutable;

  @Parameter(property = "ariada.cliPackage", defaultValue = "@ariada-org/cli")
  private String cliPackage;

  @Parameter(property = "ariada.browser", defaultValue = "chromium")
  private String browser;

  @Parameter(property = "ariada.severityThreshold", defaultValue = "moderate")
  private String severityThreshold;

  @Parameter(property = "ariada.timeoutMs", defaultValue = "30000")
  private int timeoutMs;

  @Parameter(property = "ariada.failOnViolations", defaultValue = "true")
  private boolean failOnViolations;

  @Parameter(property = "ariada.skip", defaultValue = "false")
  private boolean skip;

  @Parameter(defaultValue = "${project.basedir}", readonly = true)
  private File basedir;

  @Override
  public void execute() throws MojoExecutionException, MojoFailureException {
    if (skip) {
      getLog().info("Skipping Ariada scan because ariada.skip=true");
      return;
    }

    Severity threshold = Severity.parse(severityThreshold);
    Path out = outputDirectory.toPath();
    try {
      Files.createDirectories(out);
    } catch (IOException err) {
      throw new MojoExecutionException("Cannot create Ariada output directory: " + out, err);
    }

    String scanUrl = normalizedUrl();
    try (StaticSiteServer server = scanUrl == null ? StaticSiteServer.start(siteDirectory.toPath()) : null) {
      if (scanUrl == null) {
        scanUrl = server.url();
        getLog().info("Serving static Maven site for Ariada scan at " + scanUrl);
      }

      CliInvocationResult invocation = new CliInvoker().scan(new CliInvoker.CliRequest(
          cliExecutable,
          cliPackage,
          scanUrl,
          out,
          basedir.toPath(),
          browser,
          threshold,
          timeoutMs));

      if (!invocation.stdout().isBlank()) {
        getLog().info(invocation.stdout().trim());
      }
      if (!invocation.stderr().isBlank()) {
        getLog().warn(invocation.stderr().trim());
      }

      Path scanJson = resolveCliJson(out);

      AriadaScanResult result = new AriadaScanResultParser().parse(scanJson);
      int violations = result.countAtOrAbove(threshold);
      getLog().info("Ariada scan " + result.scanId() + " found " + violations
          + " violation(s) at or above " + threshold.cliName() + " for " + result.url());

      if (invocation.exitCode() != 0 && invocation.exitCode() != 1) {
        throw new MojoExecutionException("Ariada CLI failed with exit code " + invocation.exitCode());
      }
      if (failOnViolations && violations > 0) {
        throw new MojoFailureException("Ariada accessibility gate failed: " + violations
            + " violation(s) at or above " + threshold.cliName());
      }
    } catch (IOException err) {
      throw new MojoExecutionException("Ariada Maven scan failed", err);
    } catch (InterruptedException err) {
      Thread.currentThread().interrupt();
      throw new MojoExecutionException("Ariada CLI invocation was interrupted", err);
    }
  }

  private String normalizedUrl() throws MojoExecutionException {
    if (url == null || url.isBlank()) {
      return null;
    }
    String trimmed = url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      throw new MojoExecutionException("ariada.url must be an http(s) URL: " + trimmed);
    }
    return trimmed;
  }

  private Path resolveCliJson(Path out) throws MojoExecutionException {
    Path scanEnvelope = out.resolve("scan.json");
    if (Files.exists(scanEnvelope)) {
      return scanEnvelope;
    }
    Path multiDomain = out.resolve("multi-domain-report.json");
    if (Files.exists(multiDomain)) {
      return multiDomain;
    }
    throw new MojoExecutionException("Ariada CLI did not write scan.json or multi-domain-report.json in " + out);
  }
}
