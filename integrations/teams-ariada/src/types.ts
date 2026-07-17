/** Severity labels emitted by Ariada CLI JSON. */
export type AriadaImpact = 'minor' | 'moderate' | 'serious' | 'critical';

/** One accessibility finding rendered into Teams. */
export interface AriadaViolation {
  id: string;
  impact: AriadaImpact;
  description: string;
}

/** Minimal Ariada CLI result shape consumed by the Teams card renderer. */
export interface AriadaScanResult {
  url: string;
  status: 'pass' | 'fail';
  summary: {
    violations: number;
    passes: number;
  };
  violations: AriadaViolation[];
  reportUrl?: string;
}

/** Minimal Teams activity shape used by the local command handler tests. */
export interface TeamsActivity {
  text?: string;
  value?: AriadaScanResult;
}
