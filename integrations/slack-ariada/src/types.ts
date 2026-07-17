export type AriadaStatus = 'pass' | 'fail';

export interface AriadaViolation {
  id: string;
  impact: string;
  description: string;
}

export interface AriadaScanResult {
  url: string;
  status: AriadaStatus;
  summary: {
    violations: number;
    passes: number;
  };
  violations: AriadaViolation[];
  reportUrl?: string;
}

export interface CiGateFailurePayload {
  repository: string;
  branch: string;
  commit: string;
  pipelineUrl: string;
  scan: AriadaScanResult;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<Record<string, unknown>>;
}

export interface SlackMessage {
  response_type?: 'ephemeral' | 'in_channel';
  text: string;
  blocks: SlackBlock[];
}
