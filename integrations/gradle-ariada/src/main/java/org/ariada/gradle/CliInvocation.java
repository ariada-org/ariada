package org.ariada.gradle;

import java.nio.file.Path;

record CliInvocation(
 String cliCommand,
 String targetUrl,
 Path outputDir,
 String domains,
 String severityThreshold
) {}
