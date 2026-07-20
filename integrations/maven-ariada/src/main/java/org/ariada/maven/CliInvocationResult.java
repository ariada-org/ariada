// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
package org.ariada.maven;

public record CliInvocationResult(int exitCode, String stdout, String stderr) {
}
