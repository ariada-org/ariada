/** One accessibility finding rendered into a Discord embed. */
export interface AriadaViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
}

/** Minimal Ariada CLI result shape consumed by the Discord renderer. */
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

/** CI webhook payload accepted by the Discord notification handler. */
export interface DiscordWebhookPayload {
  scan: AriadaScanResult;
}
