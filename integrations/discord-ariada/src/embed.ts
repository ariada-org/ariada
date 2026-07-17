import type { AriadaScanResult } from './types.js';

/** Builds a Discord embed from an Ariada CLI scan result. */
export function buildDiscordEmbed(result: AriadaScanResult): object {
  const color = result.status === 'pass' ? 0x1f8f4d : 0xc73535;
  return {
    title: `Ariada accessibility gate: ${result.status.toUpperCase()}`,
    url: result.reportUrl,
    color,
    fields: [
      { name: 'Target', value: result.url, inline: false },
      { name: 'Violations', value: String(result.summary.violations), inline: true },
      { name: 'Passes', value: String(result.summary.passes), inline: true },
      ...result.violations.slice(0, 5).map((violation) => ({
        name: `${violation.impact.toUpperCase()} ${violation.id}`,
        value: violation.description,
        inline: false,
      })),
    ],
  };
}
