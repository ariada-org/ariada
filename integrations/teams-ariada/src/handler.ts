import { buildAdaptiveCard } from './card.js';
import type { AriadaScanResult, TeamsActivity } from './types.js';

/** Extracts the target URL from the Teams scan command text. */
export function parseScanCommand(text = ''): { url: string } | null {
  const match = text.trim().match(/^\/?ariada\s+scan\s+(https?:\/\/\S+)$/iu);
  return match ? { url: match[1] } : null;
}

/** Handles a mock Teams activity without embedding scanner execution. */
export function handleTeamsActivity(activity: TeamsActivity): object {
  if (activity.value) {
    return buildAdaptiveCard(activity.value);
  }

  const request = parseScanCommand(activity.text);
  if (!request) {
    return {
      type: 'message',
      text: 'Use: /ariada scan https://example.com',
    };
  }

  const pending: AriadaScanResult = {
    url: request.url,
    status: 'pass',
    summary: { violations: 0, passes: 0 },
    violations: [],
    reportUrl: undefined,
  };
  return buildAdaptiveCard(pending);
}
