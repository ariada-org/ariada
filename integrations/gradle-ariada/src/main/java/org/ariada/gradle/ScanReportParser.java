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
    private static final Pattern SEVERITY_VALUE_PATTERN =
        Pattern.compile("\"severity\"\\s*:\\s*\"(critical|serious|moderate|minor)\"");

    private ScanReportParser() {}

    static ScanSummary parse(Path scanJson) throws IOException {
        String json = Files.readString(scanJson);
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

        if (critical + serious + moderate + minor == 0) {
            Matcher severityMatcher = SEVERITY_VALUE_PATTERN.matcher(json);
            while (severityMatcher.find()) {
                switch (severityMatcher.group(1)) {
                    case "critical" -> critical++;
                    case "serious" -> serious++;
                    case "moderate" -> moderate++;
                    case "minor" -> minor++;
                    default -> throw new IllegalStateException("Unexpected severity: " + severityMatcher.group(1));
                }
            }
        }

        int severityTotal = critical + serious + moderate + minor;
        int total = firstInt(TOTAL_PATTERN, json, severityTotal);
        return new ScanSummary(total, critical, serious, moderate, minor);
    }

    private static int firstInt(Pattern pattern, String json, int fallback) {
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) {
            return fallback;
        }
        return Integer.parseInt(matcher.group(1));
    }
}
