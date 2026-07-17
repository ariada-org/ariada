/** Minimal Ariada CLI summary shown in hosted IDE terminals. */
export interface ScanSummary {
  url: string;
  status: 'pass' | 'fail';
  summary: {
    violations: number;
    passes: number;
  };
}

/** Builds the Ariada CLI argv used inside hosted web IDE terminals. */
export function buildWebIdeScanArgs(target?: string): string[] {
  const url = target && /^https?:\/\/\S+$/iu.test(target) ? target : 'http://localhost:5173';
  return ['scan', url, '--format', 'json'];
}

/** Formats Ariada CLI JSON into a short terminal summary. */
export function formatTerminalSummary(result: ScanSummary): string {
  return [
    `Ariada ${result.status.toUpperCase()}: ${result.url}`,
    `Violations: ${result.summary.violations}`,
    `Passes: ${result.summary.passes}`
  ].join('\n');
}
