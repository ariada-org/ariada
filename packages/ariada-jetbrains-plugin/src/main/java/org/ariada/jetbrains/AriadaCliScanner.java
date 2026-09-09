// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.intellij.openapi.project.Project;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;

/**
 * The site scan: runs the Ariada command-line scanner over a served page and
 * reads the report it writes.
 *
 * <p>This is the scan that checks the page as a browser builds it, so it reaches
 * the rules the in-editor scan cannot: contrast, focus order, names computed at
 * runtime, everything a template only decides once it has rendered.
 */
public final class AriadaCliScanner {
  private static final Duration TIMEOUT = Duration.ofSeconds(45);
  private static final long POLL_MILLIS = 200;

  public ScanSnapshot scan(Project project, String url) throws IOException, InterruptedException {
    return scan(project, url, () -> false);
  }

  /**
   * As above, but asking {@code cancelled} between waits so a scan the person
   * has given up on stops taking their machine with it. Without this the only
   * way out of a slow scan is the forty-five second timeout, which is a long
   * time to watch a progress bar you have already dismissed.
   */
  public ScanSnapshot scan(Project project, String url, BooleanSupplier cancelled)
      throws IOException, InterruptedException {
    Path projectDir = Path.of(project.getBasePath() == null ? "." : project.getBasePath());
    Path outputDir = projectDir.resolve(".ariada").resolve("jetbrains");
    Files.createDirectories(outputDir);

    Process process = new ProcessBuilder(buildScanCommand(url, outputDir))
        .directory(projectDir.toFile())
        .redirectErrorStream(true)
        .start();
    long deadline = System.nanoTime() + TIMEOUT.toNanos();
    boolean finished = false;
    while (!finished && System.nanoTime() < deadline) {
      if (cancelled.getAsBoolean()) {
        process.destroyForcibly();
        throw new InterruptedException("Ariada scan cancelled");
      }
      finished = process.waitFor(POLL_MILLIS, TimeUnit.MILLISECONDS);
    }
    if (!finished) {
      process.destroyForcibly();
      throw new IOException("Ariada CLI scan timed out after " + TIMEOUT.toSeconds() + " seconds");
    }

    String rawOutput = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    Path reportPath = outputDir.resolve("multi-domain-report.json");
    if (!Files.exists(reportPath)) {
      // No report is not "nothing wrong" — it is a scan that did not produce one,
      // and the command's own output is the only thing that can say why.
      return new ScanSnapshot(
          url,
          List.of(),
          "No report at " + reportPath + " (exit " + process.exitValue() + "). "
              + firstLines(rawOutput));
    }
    List<AriadaFinding> findings = parseFindings(Files.readString(reportPath, StandardCharsets.UTF_8));
    String detail = "exit " + process.exitValue() + " · report: " + reportPath;
    if (findings.isEmpty() && !rawOutput.isBlank()) {
      detail = detail + " · " + firstLines(rawOutput);
    }
    return new ScanSnapshot(url, findings, detail);
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

  /**
   * Reads every finding out of a scanner report.
   *
   * <p>This used to be two regular expressions over the file's text, and it
   * found nothing at all: they required a finding's rule, severity and message
   * to sit in one brace pair with nothing nested between them, and a real
   * finding carries its element as a nested object in exactly that gap. So the old
   * reader returned nothing from a report that had defects in it, and labelled
   * the domain "sites", which is merely the first key in the file. The tool window
   * then said there was nothing wrong.
   *
   * <p>So the report is parsed rather than pattern-matched, and the walk is over
   * the whole tree: any object carrying a rule identifier is a finding, wherever
   * the report's shape puts it. That way a change to the report's layout costs
   * nothing here, and the two shapes in use today — findings grouped by site and
   * domain, and a flat list — both read correctly.
   */
  public static List<AriadaFinding> parseFindings(String json) {
    List<AriadaFinding> findings = new ArrayList<>();
    JsonElement root;
    try {
      root = JsonParser.parseString(json);
    } catch (JsonSyntaxException malformed) {
      return List.of();
    }
    collect(root, "", "", findings);
    return findings;
  }

  private static void collect(
      JsonElement element, String domainHint, String siteHint, List<AriadaFinding> findings) {
    if (element == null || element.isJsonNull()) {
      return;
    }
    if (element.isJsonArray()) {
      for (JsonElement item : element.getAsJsonArray()) {
        collect(item, domainHint, siteHint, findings);
      }
      return;
    }
    if (!element.isJsonObject()) {
      return;
    }
    JsonObject object = element.getAsJsonObject();
    if (isFinding(object)) {
      findings.add(toFinding(object, domainHint, siteHint));
      return;
    }
    for (Map.Entry<String, JsonElement> entry : object.entrySet()) {
      String key = entry.getKey();
      JsonElement value = entry.getValue();
      // A report groups findings by site and then by domain, so the key a list
      // hangs off names the domain, and the key an object hangs off names the
      // site. Both are only a fallback: a finding that states its own domain or
      // site is believed over where it was found.
      String nextDomain = value.isJsonArray() ? key.toLowerCase(Locale.ROOT) : domainHint;
      String nextSite = value.isJsonObject() && looksLikeSite(key) ? key : siteHint;
      collect(value, nextDomain, nextSite, findings);
    }
  }

  /**
   * A rule identifier alone does not make a finding.
   *
   * <p>A report also summarises: a section listing which rules were tripped
   * across which sites carries a rule and a domain and nothing else. Counting
   * those as findings overstates what a page needs: the fixture beside these
   * tests carries two such entries, and read as findings they put two rows in
   * the tool window with no severity and no message — an over-report, which
   * costs the same trust as a missed one.
   */
  private static boolean isFinding(JsonObject object) {
    return object.has("ruleId") && !string(object, "message", "").isEmpty();
  }

  private static AriadaFinding toFinding(JsonObject object, String domainHint, String siteHint) {
    String domain = string(object, "domain", domainHint);
    String site = string(object, "site", siteHint);
    String selector = "";
    if (object.has("element") && object.get("element").isJsonObject()) {
      selector = string(object.getAsJsonObject("element"), "selector", "");
    }
    String where = site.isEmpty() ? selector : (selector.isEmpty() ? site : site + " " + selector);
    return AriadaFinding.fromReport(
        domain,
        string(object, "ruleId", ""),
        string(object, "severity", ""),
        string(object, "message", ""),
        where);
  }

  private static String string(JsonObject object, String member, String fallback) {
    if (object.has(member) && object.get(member).isJsonPrimitive()) {
      String value = object.get(member).getAsString();
      if (!value.isBlank()) {
        return value;
      }
    }
    return fallback;
  }

  private static boolean looksLikeSite(String key) {
    return key.contains("://") || key.contains("/") || key.contains(".");
  }

  private static String firstLines(String output) {
    String trimmed = output.strip();
    if (trimmed.isEmpty()) {
      return "The command printed nothing.";
    }
    String[] lines = trimmed.split("\\R");
    int take = Math.min(lines.length, 3);
    return String.join(" / ", List.of(lines).subList(0, take));
  }

  private static String resolveCommand() {
    String configured = System.getenv("ARIADA_CLI_COMMAND");
    return configured == null || configured.isBlank() ? "ariada" : configured;
  }

  private static boolean isHttpUrl(String value) {
    return value != null && (value.startsWith("http://") || value.startsWith("https://"));
  }

  /**
   * The arguments the scan is run with, built where they can be read.
   *
   * <p>The address arrives from a dialog the person types into, and it used to
   * reach the argument list without anyone asking what it was. No shell is
   * involved — the list form of {@code ProcessBuilder} passes each element
   * through as one argument — so nothing here can start a second command. What
   * it can do is stop being an address: a value beginning with a dash is read by
   * the command as one of its own flags, and {@code --output-dir} typed into the
   * address box would then write the report wherever it said. The scan would
   * look as though it had simply found nothing.
   *
   * <p>So the address is required to be one: http or https, and nothing else
   * gets as far as the process. The refusal says what was given rather than that
   * something was wrong, because the person who typed it is the one who can fix
   * it.
   *
   * <p>The same check already guarded the addresses discovered from the
   * environment and from configuration. It did not guard the one a person types,
   * which is the only one that is not ours.
   */
  static List<String> buildScanCommand(String url, Path outputDir) {
    if (!isHttpUrl(url)) {
      throw new IllegalArgumentException(
          "Ariada scans an http or https address; got: " + (url == null ? "nothing" : url));
    }
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
    return command;
  }
}
