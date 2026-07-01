// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

package org.ariada.jetbrains;

interface AriadaRemediationWorkflow {
  ScanSnapshot scan(String sourcePath, String sourceText);
}
