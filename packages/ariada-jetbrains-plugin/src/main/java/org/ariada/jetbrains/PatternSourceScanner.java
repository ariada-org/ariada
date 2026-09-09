// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The in-editor scan: two checks a person can run on an unsaved file without a
 * browser, a build, or a server.
 *
 * <p>Two is the honest count. The identifiers are the editor-side analyzer's,
 * not the command-line scanner's — that one names its rules for the pack they
 * belong to, and the two vocabularies do not overlap, so a finding's identifier
 * says which scan produced it. None claims a criterion it did not exercise.
 */
final class PatternSourceScanner implements SourceScanner {
  private static final String DOMAIN = "accessibility";
  private static final Pattern IMAGE_TAG = Pattern.compile("<img\\b[^>]*>", Pattern.CASE_INSENSITIVE);
  private static final Pattern BUTTON_TAG =
      Pattern.compile("<button\\b([^>]*)>(.*?)</button>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

  @Override
  public ScanSnapshot scan(String sourcePath, String sourceText) {
    List<AriadaFinding> findings = new ArrayList<>();
    collectMissingImageAlt(sourcePath, sourceText, findings);
    collectEmptyButtons(sourcePath, sourceText, findings);
    return new ScanSnapshot(
        sourcePath,
        findings,
        "Checked the file's markup only. Run a site scan for the rules that need a rendered page.");
  }

  private static void collectMissingImageAlt(
      String sourcePath, String sourceText, List<AriadaFinding> findings) {
    Matcher matcher = IMAGE_TAG.matcher(sourceText);
    while (matcher.find()) {
      String tag = matcher.group().toLowerCase(Locale.ROOT);
      if (!tag.contains(" alt=") && !tag.contains("\talt=") && !tag.contains("\nalt=")) {
        findings.add(new AriadaFinding(
            DOMAIN,
            "wcag-22-1-1-1-image-alt",
            "critical",
            "Image is missing alternative text",
            sourcePath,
            "Add an alt attribute that conveys the image purpose, or alt=\"\" for decorative images."));
      }
    }
  }

  private static void collectEmptyButtons(
      String sourcePath, String sourceText, List<AriadaFinding> findings) {
    Matcher matcher = BUTTON_TAG.matcher(sourceText);
    while (matcher.find()) {
      String attributes = matcher.group(1).toLowerCase(Locale.ROOT);
      String body = matcher.group(2).replaceAll("<[^>]+>", "").trim();
      boolean hasAccessibleName =
          attributes.contains("aria-label=") || attributes.contains("aria-labelledby=");
      if (!hasAccessibleName && body.isEmpty()) {
        findings.add(new AriadaFinding(
            DOMAIN,
            "wcag-22-4-1-2-button-name",
            "critical",
            "Button has no accessible name",
            sourcePath,
            "Add visible text, aria-label, or aria-labelledby so assistive technology can announce the button."));
      }
    }
  }
}
