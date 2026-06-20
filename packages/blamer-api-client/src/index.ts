// SPDX-License-Identifier: EUPL-1.2
// Copyright Agonist Development AB — see NOTICE
// Public surface of @ariada-org/blamer-api-client

export type {
  BlamedApiError,
  BlamedApiErrorKind,
  BlamedClientOptions,
  BlamedReport,
  BlamedResult,
  BlamedViolation,
  AttributeRequestBody,
  QuotaExceededPayload,
} from './types.js';

export { BlamedApiClient, createBlamedClient } from './client.js';
export {
  renderGitHubComment,
  renderVercelComment,
  renderQuotaExceededComment,
  renderAuthErrorComment,
} from './renderers.js';
