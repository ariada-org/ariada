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
        // A value beginning with a dash is read by the command as one of its own
        // flags rather than as an address. No shell is involved, so nothing here
        // can start a second command; what a bare value can do is stop being an
        // address, and that is what this refuses.
        if (invocation.targetUrl() == null
                || !(invocation.targetUrl().startsWith("http://")
                        || invocation.targetUrl().startsWith("https://"))) {
            throw new IllegalArgumentException(
                    "Ariada scans an http or https address; got: "
                            + (invocation.targetUrl() == null ? "nothing" : invocation.targetUrl()));
        }
        command.add(invocation.targetUrl());
        command.add("--format");
        command.add("json");
        command.add("--output-dir");
        command.add(invocation.outputDir().toString());
        command.add("--domains");
        command.add(invocation.domains());
        command.add("--severity-threshold");
        command.add(invocation.severityThreshold());

        // The list form, so no shell parses any of this and an argument cannot
        // become a command. What is configurable is the program NAME — a build
        // extension property — and whoever sets that already controls the build
        // they are setting it in. Held by tests/scripts/test-zapusk-bez-obolochki.sh,
        // which refuses the string form and an explicit shell anywhere in the tree,
        // so this reasoning cannot quietly stop being true.
        // nosemgrep: java.lang.security.audit.command-injection-process-builder.command-injection-process-builder
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
