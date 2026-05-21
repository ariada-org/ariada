// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import * as vscode from 'vscode';

import { analyze, isSupportedLanguage, type Finding } from './analyzer.js';
import { buildClipboardCitation, buildHoverMarkdown } from './hover.js';
import { getRule, listRules, type RuleSeverity } from './rules.js';
import { computeScore, countBySeverity, statusBarText } from './score.js';
import { mapSeverity } from './severity-mapper.js';

const DIAGNOSTIC_SOURCE = 'ariada';
const COLLECTION_NAME = 'ariada';

interface ExtensionState {
  readonly diagnostics: vscode.DiagnosticCollection;
  readonly output: vscode.OutputChannel;
  readonly statusBar: vscode.StatusBarItem;
  readonly findingsByDoc: Map<string, readonly Finding[]>;
  readonly debounceTimers: Map<string, NodeJS.Timeout>;
}

let state: ExtensionState | undefined;

/**
 *
 */
export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(COLLECTION_NAME);
  const output = vscode.window.createOutputChannel('Ariada');
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'ariada.showOutputChannel';
  statusBar.text = '✓ ariada 100 · 0 issues';
  statusBar.tooltip = 'Ariada accessibility score';

  state = {
    diagnostics,
    output,
    statusBar,
    findingsByDoc: new Map(),
    debounceTimers: new Map(),
  };

  context.subscriptions.push(diagnostics, output, statusBar);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => scheduleAnalysis(doc, /* immediate */ true)),
    vscode.workspace.onDidChangeTextDocument((e) => {
      const cfg = vscode.workspace.getConfiguration('ariada');
      if (cfg.get<boolean>('scanOnType', true)) {
        scheduleAnalysis(e.document, false);
      }
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      const cfg = vscode.workspace.getConfiguration('ariada');
      if (cfg.get<boolean>('scanOnSave', false)) {
        scheduleAnalysis(doc, true);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      const cfg = vscode.workspace.getConfiguration('ariada');
      const uriStr = doc.uri.toString();
      const timer = state?.debounceTimers.get(uriStr);
      if (timer) {
        clearTimeout(timer);
        state?.debounceTimers.delete(uriStr);
      }
      if (cfg.get<boolean>('clearOnClose', false)) {
        state?.findingsByDoc.delete(uriStr);
        diagnostics.delete(doc.uri);
        refreshStatusBar();
      }
    }),
  );

  // Hover provider — one for each supported language.
  const hoverProvider: vscode.HoverProvider = {
    provideHover(document, position) {
      const findings = state?.findingsByDoc.get(document.uri.toString()) ?? [];
      const offset = document.offsetAt(position);
      const finding = findings.find(
        (f) => offset >= f.range.startOffset && offset <= f.range.endOffset,
      );
      if (!finding) {
        return undefined;
      }
      const md = buildHoverMarkdown(finding.ruleId);
      if (!md) {
        return undefined;
      }
      const markdown = new vscode.MarkdownString(md);
      markdown.isTrusted = false;
      return new vscode.Hover(markdown);
    },
  };
  for (const lang of ['html', 'javascriptreact', 'typescriptreact', 'vue', 'svelte']) {
    context.subscriptions.push(vscode.languages.registerHoverProvider(lang, hoverProvider));
  }

  // Commands.
  context.subscriptions.push(
    vscode.commands.registerCommand('ariada.scanCurrentFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        scheduleAnalysis(editor.document, true);
      }
    }),
    vscode.commands.registerCommand('ariada.scanWorkspace', async () => {
      await scanWorkspace();
    }),
    vscode.commands.registerCommand('ariada.scanUrl', async () => {
      vscode.window.showInformationMessage(
        'ariada.scanUrl will delegate to the @ariada-org/cli runner in a later release.',
      );
    }),
    vscode.commands.registerCommand('ariada.openReport', () => {
      vscode.window.showInformationMessage(
        'ariada.openReport will open the most recent scan report in a later release.',
      );
    }),
    vscode.commands.registerCommand('ariada.refreshDiagnostics', () => {
      state?.findingsByDoc.clear();
      diagnostics.clear();
      for (const doc of vscode.workspace.textDocuments) {
        scheduleAnalysis(doc, true);
      }
    }),
    vscode.commands.registerCommand('ariada.copyFindingCitation', async (ruleId?: string) => {
      const id =
        ruleId ??
        (await vscode.window.showQuickPick(listKnownRuleIds(), {
          placeHolder: 'Select a rule ID to copy citation for',
        }));
      if (!id) {
        return;
      }
      const citation = buildClipboardCitation(id);
      if (citation) {
        await vscode.env.clipboard.writeText(citation);
        vscode.window.showInformationMessage(`Citation copied: ${citation}`);
      }
    }),
    vscode.commands.registerCommand('ariada.showOutputChannel', () => {
      output.show(true);
    }),
  );

  output.appendLine(
    `[${new Date().toISOString()}] [info]  Ariada extension activated. Static-tractable rule subset loaded.`,
  );

  // Analyse already-open documents.
  for (const doc of vscode.workspace.textDocuments) {
    scheduleAnalysis(doc, true);
  }
}

/**
 *
 */
export function deactivate(): void {
  if (!state) {
    return;
  }
  for (const timer of state.debounceTimers.values()) {
    clearTimeout(timer);
  }
  state.debounceTimers.clear();
  state.findingsByDoc.clear();
  state.diagnostics.dispose();
  state.output.dispose();
  state.statusBar.dispose();
  state = undefined;
}

function scheduleAnalysis(document: vscode.TextDocument, immediate: boolean): void {
  if (!state) {
    return;
  }
  if (!isSupportedLanguage(document.languageId)) {
    return;
  }
  const cfg = vscode.workspace.getConfiguration('ariada');
  if (!cfg.get<boolean>('enable', true)) {
    return;
  }
  const uriStr = document.uri.toString();
  const existing = state.debounceTimers.get(uriStr);
  if (existing) {
    clearTimeout(existing);
  }
  const debounceMs = immediate ? 0 : cfg.get<number>('scanOnTypeDebounceMs', 300);
  const timer = setTimeout(() => {
    runAnalysis(document);
    state?.debounceTimers.delete(uriStr);
  }, debounceMs);
  state.debounceTimers.set(uriStr, timer);
}

function runAnalysis(document: vscode.TextDocument): void {
  if (!state) {
    return;
  }
  const cfg = vscode.workspace.getConfiguration('ariada');
  const threshold = cfg.get<RuleSeverity>('severityThreshold', 'minor');
  const text = document.getText();
  const startedAt = Date.now();
  const findings = analyze(text, {
    languageId: document.languageId,
    severityThreshold: threshold,
  });
  const elapsedMs = Date.now() - startedAt;

  state.findingsByDoc.set(document.uri.toString(), findings);

  const vscodeDiagnostics = findings.map((f) => toVscodeDiagnostic(document, f));
  state.diagnostics.set(document.uri, vscodeDiagnostics);

  state.output.appendLine(
    `[${new Date().toISOString()}] [debug] Analysed ${document.uri.fsPath} in ${elapsedMs} ms · ${findings.length} findings`,
  );
  refreshStatusBar();
}

function toVscodeDiagnostic(document: vscode.TextDocument, finding: Finding): vscode.Diagnostic {
  const startPos = document.positionAt(finding.range.startOffset);
  const endPos = document.positionAt(finding.range.endOffset);
  const range = new vscode.Range(startPos, endPos);
  const diag = new vscode.Diagnostic(range, finding.message, mapSeverity(finding.severity));
  diag.code = finding.ruleId;
  diag.source = DIAGNOSTIC_SOURCE;
  const rule = getRule(finding.ruleId);
  if (rule) {
    diag.code = {
      value: finding.ruleId,
      target: vscode.Uri.parse(rule.helpUrl),
    };
  }
  return diag;
}

async function scanWorkspace(): Promise<void> {
  if (!state) {
    return;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    vscode.window.showInformationMessage('No workspace folder is open.');
    return;
  }
  const pattern = '**/*.{html,htm,jsx,tsx,vue,svelte}';
  const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 5000);
  let total = 0;
  for (const uri of uris) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      runAnalysis(doc);
      total += state.findingsByDoc.get(uri.toString())?.length ?? 0;
    } catch (err) {
      state.output.appendLine(
        `[${new Date().toISOString()}] [warn]  Skipped ${uri.fsPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  vscode.window.showInformationMessage(
    `Ariada: scanned ${uris.length} files; ${total} findings.`,
  );
}

function refreshStatusBar(): void {
  if (!state) {
    return;
  }
  const cfg = vscode.workspace.getConfiguration('ariada');
  if (!cfg.get<boolean>('statusBarEnabled', true)) {
    state.statusBar.hide();
    return;
  }
  const allFindings: Finding[] = [];
  for (const list of state.findingsByDoc.values()) {
    allFindings.push(...list);
  }
  const counts = countBySeverity(allFindings.map((f) => f.severity));
  const score = computeScore(counts);
  state.statusBar.text = statusBarText(score, allFindings.length);
  state.statusBar.show();
}

function listKnownRuleIds(): readonly string[] {
  return listRules().map((r) => r.id);
}
