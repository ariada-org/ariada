// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Recovered from `dist/scan.js` and `dist/scan.d.ts`. The source this was built
// from was never committed; the compiled output is `tsc` with the types
// stripped, so the shapes come back from the declaration file and the bodies
// are the compiled ones. Checked with `bash scripts/sverit-vosstanovlennoe.sh`.

export type BuilderContent = {
  previewUrl?: unknown;
  pageUrl?: unknown;
  url?: unknown;
  data?: { previewUrl?: unknown; page?: { url?: unknown } };
};

export type ScanTarget = { url: string; source: 'preview' | 'page' };

export type AriadaFinding = {
  id: string;
  impact: string;
  message: string;
  helpUrl?: string;
};

export type AriadaPanelResult = {
  passed: boolean;
  total: number;
  counts: Record<string, number>;
  findings: AriadaFinding[];
  target: ScanTarget;
};

export type CommandResult = { stdout: string; stderr?: string; exitCode: number };
export type CommandRunner = (command: string, args: string[]) => Promise<CommandResult>;

/**
 * The value as an http(s) URL, or nothing.
 *
 * Anything that is not a web address is discarded rather than passed on: the
 * URL here comes out of somebody else's content model, and a scanner pointed at
 * a `file:` or `javascript:` address is a scanner pointed somewhere it was not
 * asked to look.
 *
 * @param value - the candidate
 * @returns the normalised address, or undefined
 */
function url(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Where to scan, from whichever field the content happens to carry.
 *
 * Preview addresses are preferred over published ones: the point of scanning
 * from inside the editor is to see the change before it ships.
 *
 * @param content - the content entry
 * @returns the address and which kind it was
 */
export function resolveScanTarget(content: BuilderContent): ScanTarget {
  const candidates: [unknown, 'preview' | 'page'][] = [
    [content.previewUrl, 'preview'],
    [content.data?.previewUrl, 'preview'],
    [content.pageUrl, 'page'],
    [content.url, 'page'],
    [content.data?.page?.url, 'page'],
  ];
  for (const [value, source] of candidates) {
    const target = url(value);
    if (target) return { url: target, source };
  }
  throw new Error('Builder.io content has no reachable previewUrl or page URL');
}

/**
 * The command line for one scan.
 *
 * @param target - where to scan
 * @returns the arguments
 */
export function buildScanArgs(target: ScanTarget): string[] {
  return ['scan', target.url, '--format', 'json', '--no-fail'];
}

/**
 * Normalise whatever the scanner returned into what the panel renders.
 *
 * Every field is read defensively and given a name if it has none, because a
 * panel that throws on an unexpected shape shows the editor nothing at all —
 * which is worse than showing a finding called `finding-3`.
 *
 * @param raw - the scanner's output
 * @param target - what was scanned
 * @returns the result the panel takes
 */
export function mapScanResult(raw: unknown, target: ScanTarget): AriadaPanelResult {
  const report = (raw && typeof raw === 'object' ? raw : {}) as {
    findings?: unknown;
    passed?: unknown;
  };
  const rawFindings = Array.isArray(report.findings) ? report.findings : [];
  const findings: AriadaFinding[] = rawFindings.map((item, index) => {
    // Именованные необязательные поля, а не индексная запись: оригинал
    // обращался к ним через точку, и сверка это заметила. Индексный тип
    // потребовал бы скобок и дал бы другой модуль из того же смысла.
    const finding = (item && typeof item === 'object' ? item : {}) as {
      id?: unknown;
      ruleId?: unknown;
      impact?: unknown;
      severity?: unknown;
      message?: unknown;
      description?: unknown;
      helpUrl?: unknown;
    };
    return {
      id: String(finding.id ?? finding.ruleId ?? `finding-${index + 1}`),
      impact: String(finding.impact ?? finding.severity ?? 'unknown'),
      message: String(finding.message ?? finding.description ?? 'Ariada finding'),
      ...(typeof finding.helpUrl === 'string' ? { helpUrl: finding.helpUrl } : {}),
    };
  });
  const counts: Record<string, number> = {};
  for (const finding of findings) counts[finding.impact] = (counts[finding.impact] ?? 0) + 1;
  const passed = typeof report.passed === 'boolean' ? report.passed : findings.length === 0;
  return { passed, total: findings.length, counts, findings, target };
}

/**
 * Scan one content entry and return what the panel needs.
 *
 * @param content - the content entry
 * @param runner - how commands are run
 * @param command - the executable
 * @returns the result
 */
export async function runAriadaScan(
  content: BuilderContent,
  runner: CommandRunner,
  command = 'ariada',
): Promise<AriadaPanelResult> {
  const target = resolveScanTarget(content);
  const result = await runner(command, buildScanArgs(target));
  if (!result.stdout.trim())
    throw new Error(`Ariada CLI returned no JSON (exit ${result.exitCode})`);
  return mapScanResult(JSON.parse(result.stdout), target);
}
