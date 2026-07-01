import type { AriadaScanResult, CiGateFailurePayload, SlackMessage } from './types.js';

function escapeMrkdwn(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function statusLabel(status: AriadaScanResult['status']): string {
  return status === 'fail' ? 'FAIL' : 'PASS';
}

export function parseScanCommand(text = ''): { url: string } | null {
  const match = text.trim().match(/^scan\s+(https?:\/\/\S+)$/iu);
  return match ? { url: match[1] } : null;
}

export function buildScanRequestResponse(text: string): SlackMessage {
  const request = parseScanCommand(text);
  if (!request) {
    return {
      response_type: 'ephemeral',
      text: 'Use: /ariada scan https://example.com',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Use:* `/ariada scan https://example.com`' },
        },
      ],
    };
  }

  return {
    response_type: 'ephemeral',
    text: `Ariada scan requested for ${request.url}.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Ariada scan requested*\nTarget: <${escapeMrkdwn(request.url)}>\nLocal fixture accepted the command. Production requires the hosted scan API.`,
        },
      },
    ],
  };
}

export function buildScanResultMessage(scan: AriadaScanResult): SlackMessage {
  const topFindings = scan.violations
    .slice(0, 3)
    .map((item) => `• *${escapeMrkdwn(item.id)}* (${escapeMrkdwn(item.impact)}): ${escapeMrkdwn(item.description)}`)
    .join('\n');

  return {
    response_type: 'in_channel',
    text: `Ariada accessibility gate: ${statusLabel(scan.status)}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Ariada accessibility gate: ${statusLabel(scan.status)}*` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*URL*\n<${escapeMrkdwn(scan.url)}>` },
          { type: 'mrkdwn', text: `*Violations*\n${scan.summary.violations}` },
          { type: 'mrkdwn', text: `*Passes*\n${scan.summary.passes}` },
          { type: 'mrkdwn', text: `*Report*\n${scan.reportUrl ? `<${escapeMrkdwn(scan.reportUrl)}|Open report>` : 'Not provided'}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: topFindings || 'No violations in the supplied result.' },
      },
    ],
  };
}

export function buildCiGateFailureMessage(payload: CiGateFailurePayload): SlackMessage {
  const scanMessage = buildScanResultMessage(payload.scan);
  return {
    ...scanMessage,
    text: `Ariada CI gate failed for ${payload.repository}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Ariada CI gate failed*\nRepository: \`${escapeMrkdwn(payload.repository)}\`\nBranch: \`${escapeMrkdwn(payload.branch)}\`\nCommit: \`${escapeMrkdwn(payload.commit)}\``,
        },
      },
      ...scanMessage.blocks.slice(1),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open CI job' },
            url: payload.pipelineUrl,
          },
        ],
      },
    ],
  };
}
