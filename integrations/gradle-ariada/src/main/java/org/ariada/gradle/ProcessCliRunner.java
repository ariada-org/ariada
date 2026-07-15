package org.ariada.gradle;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class ProcessCliRunner implements CliRunner {
    @Override
    public CliResult run(CliInvocation invocation) throws IOException, InterruptedException {
        List<String> command = new ArrayList<>(splitCommand(invocation.cliCommand()));
        command.add("scan");
        command.add(invocation.targetUrl());
        command.add("--format");
        command.add("json");
        command.add("--output-dir");
        command.add(invocation.outputDir().toString());
        command.add("--domains");
        command.add(invocation.domains());
        command.add("--severity-threshold");
        command.add(invocation.severityThreshold());

        Process process = new ProcessBuilder(command).start();
        byte[] stdout = process.getInputStream().readAllBytes();
        byte[] stderr = process.getErrorStream().readAllBytes();
        int exitCode = process.waitFor();
        return new CliResult(
            exitCode,
            new String(stdout, StandardCharsets.UTF_8),
            new String(stderr, StandardCharsets.UTF_8)
        );
    }

    private static List<String> splitCommand(String command) {
        String trimmed = command.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("cliCommand must not be blank");
        }
        return List.of(trimmed.split("\\s+"));
    }
}
