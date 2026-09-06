// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class CliInvoker {
  public CliInvocationResult scan(CliRequest request) throws IOException, InterruptedException {
    List<String> command = new ArrayList<>();
    command.add(request.cliExecutable());
    if (request.usesNpx()) {
      command.add("--yes");
      command.add(request.cliPackage());
    }
    command.add("scan");
    // A value that begins with a dash is read by the command as one of its own
    // flags, not as an address — `--output-dir` given as the target would send the
    // report somewhere the caller did not choose. No shell is involved here, so
    // nothing can start a second command; what a bare value can do is stop being
    // an address, and that is what this refuses.
    if (request.url() == null
        || !(request.url().startsWith("http://") || request.url().startsWith("https://"))) {
      throw new IllegalArgumentException(
          "Ariada scans an http or https address; got: "
              + (request.url() == null ? "nothing" : request.url()));
    }
    command.add(request.url());
    command.add("--format");
    command.add("json");
    command.add("--output-dir");
    command.add(request.outputDirectory().toString());
    command.add("--browser");
    command.add(request.browser());
    command.add("--severity-threshold");
    command.add(request.severityThreshold().cliName());
    command.add("--timeout-ms");
    command.add(Integer.toString(request.timeoutMs()));

    Process process = new ProcessBuilder(command)
        .directory(request.workingDirectory().toFile())
        .start();

    ByteArrayOutputStream stdout = new ByteArrayOutputStream();
    ByteArrayOutputStream stderr = new ByteArrayOutputStream();
    Thread outThread = copyAsync(process.getInputStream(), stdout);
    Thread errThread = copyAsync(process.getErrorStream(), stderr);
    int exitCode = process.waitFor();
    outThread.join();
    errThread.join();
    return new CliInvocationResult(
        exitCode,
        stdout.toString(StandardCharsets.UTF_8),
        stderr.toString(StandardCharsets.UTF_8));
  }

  private static Thread copyAsync(InputStream input, ByteArrayOutputStream output) {
    Thread thread = new Thread(() -> {
      try (input) {
        input.transferTo(output);
      } catch (IOException ignored) {
        // The process exit code and stderr are more useful to Maven users.
      }
    });
    thread.start();
    return thread;
  }

  public record CliRequest(
      String cliExecutable,
      String cliPackage,
      String url,
      Path outputDirectory,
      Path workingDirectory,
      String browser,
      Severity severityThreshold,
      int timeoutMs) {
    public boolean usesNpx() {
      return "npx".equals(cliExecutable);
    }
  }
}
