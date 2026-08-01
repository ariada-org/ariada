// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

export const PRODUCT_EVENT_VERSION = 1 as const;

export const PRODUCT_EVENT_TYPES = [
  'scan.requested',
  'scan.completed',
  'report.emitted',
  'evidence.emitted',
  'deployment.gate.evaluated',
  'remediation.requested',
  'remediation.completed',
  'integration.delivery.failed',
  'channel.catalog.updated',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

export interface ArtifactRef {
  uri: string;
  mediaType?: string;
  sha256?: string;
  sizeBytes?: number;
}

export interface ScanRequestedData {
  scanId: string;
  targets: string[];
  domains?: string[];
}

export interface ScanCompletedData {
  scanId: string;
  status: 'succeeded' | 'violations' | 'failed';
  findingCount?: number;
  durationMs?: number;
  reportRef?: ArtifactRef;
  errorCode?: string;
}

export interface ReportEmittedData {
  reportId: string;
  format: string;
  artifact: ArtifactRef;
}

export interface EvidenceEmittedData {
  evidenceId: string;
  format: 'vpat' | 'en301549' | 'doslagen' | string;
  commitSha?: string;
  artifact: ArtifactRef;
}

export interface DeploymentGateEvaluatedData {
  gateId: string;
  decision: 'pass' | 'warn' | 'fail';
  policyVersion?: string;
}

export interface RemediationRequestedData {
  remediationId: string;
  findingIds: string[];
  mode: 'draft' | 'apply';
}

export interface RemediationCompletedData {
  remediationId: string;
  status: 'succeeded' | 'failed' | 'partial';
  changedArtifacts?: ArtifactRef[];
}

export interface IntegrationDeliveryFailedData {
  integration: string;
  operation: string;
  attempt: number;
  errorCode?: string;
  retryable: boolean;
}

export interface ChannelCatalogUpdatedData {
  snapshotId: string;
  generatedAt: string;
  total: number;
  built: number;
  planned: number;
  landed: number;
  localOnly: number;
  published: number;
  updated24h: number;
  updated7d: number;
  artifact: ArtifactRef;
}

export interface ProductEventDataMap {
  'scan.requested': ScanRequestedData;
  'scan.completed': ScanCompletedData;
  'report.emitted': ReportEmittedData;
  'evidence.emitted': EvidenceEmittedData;
  'deployment.gate.evaluated': DeploymentGateEvaluatedData;
  'remediation.requested': RemediationRequestedData;
  'remediation.completed': RemediationCompletedData;
  'integration.delivery.failed': IntegrationDeliveryFailedData;
  'channel.catalog.updated': ChannelCatalogUpdatedData;
}

export interface ProductEvent<T extends ProductEventType = ProductEventType> {
  id: string;
  type: T;
  version: typeof PRODUCT_EVENT_VERSION;
  occurredAt: string;
  source: string;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  subject: string;
  data: ProductEventDataMap[T];
  artifactRefs?: ArtifactRef[];
  trace?: {
    traceId?: string;
    spanId?: string;
  };
}

export type ProductEventInit<T extends ProductEventType> = Omit<
  ProductEvent<T>,
  'id' | 'type' | 'version' | 'occurredAt'
> & {
  id?: string;
  occurredAt?: string;
};

export function eventSubject(type: ProductEventType): string {
  return `ariada.v1.${type}`;
}

export function createProductEvent<T extends ProductEventType>(
  type: T,
  init: ProductEventInit<T>,
): ProductEvent<T> {
  const event: ProductEvent<T> = {
    id: init.id ?? globalThis.crypto.randomUUID(),
    type,
    version: PRODUCT_EVENT_VERSION,
    occurredAt: init.occurredAt ?? new Date().toISOString(),
    source: init.source,
    tenantId: init.tenantId,
    correlationId: init.correlationId,
    subject: init.subject,
    data: init.data,
    ...(init.causationId !== undefined ? { causationId: init.causationId } : {}),
    ...(init.artifactRefs !== undefined ? { artifactRefs: init.artifactRefs } : {}),
    ...(init.trace !== undefined ? { trace: init.trace } : {}),
  };

  assertProductEvent(event);
  return event;
}

export function assertProductEvent(value: unknown): asserts value is ProductEvent {
  if (!isRecord(value)) throw new TypeError('event must be an object');

  requireString(value, 'id', 128);
  requireString(value, 'source', 128);
  requireString(value, 'tenantId', 128);
  requireString(value, 'correlationId', 128);
  requireString(value, 'subject', 512);
  if (value['causationId'] !== undefined) requireString(value, 'causationId', 128);

  if (value['version'] !== PRODUCT_EVENT_VERSION) {
    throw new TypeError('unsupported event version');
  }
  if (!PRODUCT_EVENT_TYPES.includes(value['type'] as ProductEventType)) {
    throw new TypeError('unsupported event type');
  }
  if (
    typeof value['occurredAt'] !== 'string' ||
    Number.isNaN(Date.parse(value['occurredAt']))
  ) {
    throw new TypeError('occurredAt must be an ISO date-time');
  }
  if (!isRecord(value['data'])) throw new TypeError('event data must be an object');

  if (value['artifactRefs'] !== undefined) {
    if (!Array.isArray(value['artifactRefs'])) {
      throw new TypeError('artifactRefs must be an array');
    }
    for (const artifact of value['artifactRefs']) assertArtifactRef(artifact);
  }
}

export function parseProductEvent(value: unknown): ProductEvent {
  assertProductEvent(value);
  return value;
}

function assertArtifactRef(value: unknown): asserts value is ArtifactRef {
  if (!isRecord(value)) throw new TypeError('artifact reference must be an object');
  requireString(value, 'uri', 2048);
  if (value['mediaType'] !== undefined) requireString(value, 'mediaType', 256);
  if (
    value['sha256'] !== undefined &&
    (typeof value['sha256'] !== 'string' || !/^[a-f0-9]{64}$/i.test(value['sha256']))
  ) {
    throw new TypeError('artifact sha256 must be a 64-character hex digest');
  }
  if (
    value['sizeBytes'] !== undefined &&
    (!Number.isSafeInteger(value['sizeBytes']) || Number(value['sizeBytes']) < 0)
  ) {
    throw new TypeError('artifact sizeBytes must be a non-negative integer');
  }
}

function requireString(value: Record<string, unknown>, key: string, maxLength: number): void {
  const item = value[key];
  if (typeof item !== 'string' || item.length === 0 || item.length > maxLength) {
    throw new TypeError(`${key} must be a non-empty string up to ${maxLength} characters`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
