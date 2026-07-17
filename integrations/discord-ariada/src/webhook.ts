import { buildDiscordEmbed } from './embed.js';
import type { DiscordWebhookPayload } from './types.js';

/** Converts a CI webhook payload into a Discord webhook response body. */
export function handleWebhook(payload: DiscordWebhookPayload): object {
  return {
    embeds: [buildDiscordEmbed(payload.scan)],
  };
}

/** Builds the acknowledgement returned by the slash-command endpoint. */
export function buildSlashCommandResponse(url: string): object {
  if (!/^https?:\/\/\S+$/iu.test(url)) {
    return { content: 'Use an http or https URL.', ephemeral: true };
  }

  return {
    content: `Ariada scan requested for ${url}. A CI/CLI runner must post the result webhook.`,
    ephemeral: true,
  };
}
