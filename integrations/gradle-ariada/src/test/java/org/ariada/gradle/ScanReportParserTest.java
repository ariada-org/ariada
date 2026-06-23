package org.ariada.gradle;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class ScanReportParserTest {
 @TempDir
 Path tempDir;

 @Test
 void parsesSummaryCountsFromCliScanJson() throws Exception {
 Path scanJson = tempDir.resolve("scan.json");
 Files.writeString(scanJson, """
 {
 "summary": {
 "total": 3,
 "byImpact": {
 "critical": 1,
 "serious": 1,
 "moderate": 1,
 "minor": 0
 }
 },
 "exitCode": 1
 }
 """);

 ScanSummary summary = ScanReportParser.parse(scanJson);

 assertEquals(3, summary.total());
 assertEquals(1, summary.critical());
 assertEquals(1, summary.serious());
 assertEquals(1, summary.moderate());
 assertEquals(0, summary.minor());
 }
}
