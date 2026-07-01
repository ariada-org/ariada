import { App } from '@slack/bolt';
import { buildScanRequestResponse } from './messages.js';

export interface AriadaSlackConfig {
  signingSecret: string;
  botToken: string;
}

export function createAriadaSlackApp(config: AriadaSlackConfig): App {
  const app = new App({
    signingSecret: config.signingSecret,
    token: config.botToken,
  });

  app.command('/ariada', async ({ ack, command, respond }) => {
    await ack();
    await respond(buildScanRequestResponse(command.text));
  });

  return app;
}
