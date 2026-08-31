package org.ariada.gradle;

import java.io.IOException;

interface CliRunner {
    CliResult run(CliInvocation invocation) throws IOException, InterruptedException;
}
