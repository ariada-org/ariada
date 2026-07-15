package org.ariada.jetbrains;

import com.intellij.openapi.project.Project;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AriadaCliScanner {
  private static final Duration TIMEOUT = Duration.ofSeconds(45);
  private static final Pattern FINDING_PATTERN = Pattern.compile(
      "\\{[^{}]*\"ruleId\"\\s*:\\s*\"([^\"]+)\"[^{}]*\"severity\"\\s*:\\s*\"([^\"]+)\"[^{}]*\"message\"\\s*:\\s*\"([^\"]*)\"",
      Pattern.DOTALL);
  private static final Pattern DOMAIN_PATTERN = Pattern.compile("\"([a-z0-9-]+)\"\\s*:\\s*\\[", Pattern.CASE_INSENSITIVE);

  public AriadaScanResult scan(Project project, String url) throws IOException, InterruptedException {
    Path projectDir = Path.of(project.getBasePath() == null ? "." : project.getBasePath());
    Path outputDir = projectDir.resolve(".ariada").resolve("jetbrains");
    Files.createDirectories(outputDir);

    List<String> command = new ArrayList<>();
    command.add(resolveCommand());
    command.add("scan");
    command.add(url);
    command.add("--domains");
    command.add("accessibility");
    command.add("--format");
    command.add("json");
    command.add("--output-dir");
    command.add(outputDir.toString());
    command.add("--severity-threshold");
    command.add("minor");

    Process process = new ProcessBuilder(command)
        .directory(projectDir.toFile())
        .redirectErrorStream(true)
        .start();
    boolean finished = process.waitFor(TIMEOUT.toSeconds(), java.util.concurrent.TimeUnit.SECONDS);
    if (!finished) {
      process.destroyForcibly();
      throw new IOException("Ariada CLI scan timed out after " + TIMEOUT.toSeconds() + " seconds");
    }

    String rawOutput = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    Path reportPath = outputDir.resolve("multi-domain-report.json");
    List<AriadaFinding> findings = Files.exists(reportPath)
        ? parseFindings(Files.readString(reportPath, StandardCharsets.UTF_8))
        : List.of();
    return new AriadaScanResult(url, process.exitValue(), reportPath, findings, rawOutput);
  }

  public static String discoverProjectUrl(Project project) {
    String envUrl = System.getenv("ARIADA_SCAN_URL");
    if (isHttpUrl(envUrl)) {
      return envUrl;
    }
    if (project.getBasePath() != null) {
      Path marker = Path.of(project.getBasePath()).resolve(".ariada-url");
      try {
        if (Files.exists(marker)) {
          String configured = Files.readString(marker, StandardCharsets.UTF_8).trim();
          if (isHttpUrl(configured)) {
            return configured;
          }
        }
      } catch (IOException ignored) {
        return "";
      }
    }
    return "";
  }

  public static List<AriadaFinding> parseFindings(String json) {
    List<AriadaFinding> findings = new ArrayList<>();
    String domain = "accessibility";
    Matcher domainMatcher = DOMAIN_PATTERN.matcher(json);
    if (domainMatcher.find()) {
      domain = domainMatcher.group(1).toLowerCase(Locale.ROOT);
    }
    Matcher matcher = FINDING_PATTERN.matcher(json);
    while (matcher.find()) {
      findings.add(new AriadaFinding(
          domain,
          unescape(matcher.group(1)),
          unescape(matcher.group(2)),
          unescape(matcher.group(3))));
    }
    return findings;
  }

  private static String resolveCommand() {
    String configured = System.getenv("ARIADA_CLI_COMMAND");
    return configured == null || configured.isBlank() ? "ariada" : configured;
  }

  private static boolean isHttpUrl(String value) {
    return value != null && (value.startsWith("http://") || value.startsWith("https://"));
  }

  private static String unescape(String value) {
    return value.replace("\\\"", "\"").replace("\\n", "\n").replace("\\/", "/");
  }
}
