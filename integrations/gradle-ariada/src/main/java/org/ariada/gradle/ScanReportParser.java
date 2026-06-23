package org.ariada.gradle;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class ScanReportParser {
    private static final Pattern TOTAL_PATTERN = Pattern.compile("\"total\"\\s*:\\s*(\\d+)");
    private static final Pattern IMPACT_PATTERN =
        Pattern.compile("\"(critical|serious|moderate|minor)\"\\s*:\\s*(\\d+)");

    private ScanReportParser() {}

    static ScanSummary parse(Path scanJson) throws IOException {
        String json = Files.readString(scanJson);
        int total = firstInt(TOTAL_PATTERN, json, "summary.total");
        int critical = 0;
        int serious = 0;
        int moderate = 0;
        int minor = 0;

        Matcher matcher = IMPACT_PATTERN.matcher(json);
        while (matcher.find()) {
            int value = Integer.parseInt(matcher.group(2));
            switch (matcher.group(1)) {
                case "critical" -> critical = value;
                case "serious" -> serious = value;
                case "moderate" -> moderate = value;
                case "minor" -> minor = value;
                default -> throw new IllegalStateException("Unexpected impact: " + matcher.group(1));
            }
        }

        return new ScanSummary(total, critical, serious, moderate, minor);
    }

    private static int firstInt(Pattern pattern, String json, String fieldName) {
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) {
            throw new IllegalArgumentException("Missing " + fieldName + " in Ariada scan JSON");
        }
        return Integer.parseInt(matcher.group(1));
    }
}
