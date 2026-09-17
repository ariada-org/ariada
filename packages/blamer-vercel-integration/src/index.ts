// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
export { handleDeployment } from './handler.js';
export { verifyWebhook } from './webhook.js';
export type {
  VercelIntegrationConfig,
  VercelDeploymentEvent,
  HandleDeploymentResult,
} from './types.js';
