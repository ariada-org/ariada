// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// What to do about a scan, decided before anything is sent.
//
// The plan is separated from the sending on purpose: the command line's default
// is to print the plan and touch nothing, so the thing a person reads before
// letting it run is the same object the run acts on, not a description of it.

import { ValidationError } from './errors.js';
import { classifyAriadaResult, mapAriadaStatusToComponentState } from './mapping.js';
import { parseAriadaCliResult } from './parser.js';
import type { ComponentUpdateReceipt, StatusBoardProvider } from './provider.js';
import type { AriadaCliResult, AriadaStatus, StatusComponentState } from './types.js';
import { assertNonEmptyString, assertProviderIdentifier } from './validation.js';

const DEFAULT_INCIDENT_NAME = 'Ariada accessibility regression detected';

/** What to call the incident, if one is wanted at all. */
export interface RegressionIncidentOptions {
  readonly name?: string;
}

/** An incident as the board would accept it — built here, never sent from here. */
export interface StatuspageIncidentPayload {
  readonly incident: {
    readonly name: string;
    readonly status: 'investigating';
    readonly impact_override: 'minor' | 'major';
    readonly body: string;
    readonly component_ids: readonly string[];
    readonly components: Readonly<Record<string, StatusComponentState>>;
    readonly deliver_notifications: false;
  };
}

/** Which page, which component, and whether to draft an incident. */
export interface StatusUpdatePlanOptions {
  readonly pageId: string;
  readonly componentId: string;
  readonly regressionIncident?: boolean | RegressionIncidentOptions;
}

/** Everything that would happen, before any of it does. */
export interface StatusUpdatePlan {
  readonly pageId: string;
  readonly componentId: string;
  readonly ariadaStatus: AriadaStatus;
  readonly componentStatus: StatusComponentState;
  readonly incidentPayload?: StatuspageIncidentPayload;
}

/** The plan, plus somewhere to carry it out. */
export interface UpdateStatusComponentOptions extends StatusUpdatePlanOptions {
  readonly provider: StatusBoardProvider;
}

/** The plan, plus what the board said about it afterwards. */
export interface StatusUpdateResult extends StatusUpdatePlan {
  readonly receipt: ComponentUpdateReceipt;
}

/**
 * `true` means the default name; an object means a name of your own; anything
 * else is refused rather than read as truthy, because a stray value here would
 * quietly file an incident called after itself.
 */
function normalizeIncidentSetting(
  value: boolean | RegressionIncidentOptions | undefined,
): { enabled: false } | { enabled: true; name: string } {
  if (value === undefined || value === false) {
    return { enabled: false };
  }
  if (value === true) {
    return { enabled: true, name: DEFAULT_INCIDENT_NAME };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError('regressionIncident must be a boolean or an options object', {
      field: 'regressionIncident',
    });
  }
  const unknown = Object.keys(value).filter((key) => key !== 'name');
  if (unknown.length > 0) {
    throw new ValidationError(`regressionIncident contains unknown field: ${unknown[0]}`, {
      field: 'regressionIncident',
    });
  }
  return {
    enabled: true,
    name:
      value.name === undefined
        ? DEFAULT_INCIDENT_NAME
        : assertNonEmptyString(value.name, 'regressionIncident.name', 200),
  };
}

/**
 * No incident for a clean scan — that is the whole judgement here. The body
 * says which scan and what it found, because an incident nobody can trace back
 * to a run is an incident nobody can close.
 */
function buildIncidentFromParsed(
  result: AriadaCliResult,
  status: AriadaStatus,
  componentId: string,
  name: string,
): StatuspageIncidentPayload | undefined {
  if (status === 'pass') {
    return undefined;
  }

  const componentStatus = mapAriadaStatusToComponentState(status);
  const counts = result.summary.byImpact;
  const scanReference = result.scanId ?? 'unidentified scan';
  const body =
    `Ariada scan ${scanReference} classified as ${status} for ${result.url}. ` +
    `Findings: ${result.summary.total} total (${counts.critical} critical, ` +
    `${counts.serious} serious, ${counts.moderate} moderate, ${counts.minor} minor).`;

  return {
    incident: {
      name,
      status: 'investigating',
      impact_override: status === 'partial' ? 'minor' : 'major',
      body,
      component_ids: [componentId],
      components: { [componentId]: componentStatus },
      // Never wakes anybody. Filing is a decision; paging is a louder one, and
      // this package is not in a position to make it.
      deliver_notifications: false,
    },
  };
}

/** An incident for a scan, or nothing if the scan was clean. */
export function buildRegressionIncidentPayload(
  result: unknown,
  options: { readonly componentId: string; readonly name?: string },
): StatuspageIncidentPayload | undefined {
  const parsed = parseAriadaCliResult(result);
  const componentId = assertProviderIdentifier(options.componentId, 'componentId');
  const name =
    options.name === undefined
      ? DEFAULT_INCIDENT_NAME
      : assertNonEmptyString(options.name, 'name', 200);
  return buildIncidentFromParsed(parsed, classifyAriadaResult(parsed), componentId, name);
}

/** Everything that would happen, worked out without doing any of it. */
export function createStatusUpdatePlan(
  result: unknown,
  options: StatusUpdatePlanOptions,
): StatusUpdatePlan {
  const parsed = parseAriadaCliResult(result);
  const pageId = assertProviderIdentifier(options.pageId, 'pageId');
  const componentId = assertProviderIdentifier(options.componentId, 'componentId');
  const ariadaStatus = classifyAriadaResult(parsed);
  const componentStatus = mapAriadaStatusToComponentState(ariadaStatus);
  const incidentSetting = normalizeIncidentSetting(options.regressionIncident);
  const incidentPayload = incidentSetting.enabled
    ? buildIncidentFromParsed(parsed, ariadaStatus, componentId, incidentSetting.name)
    : undefined;

  const plan: StatusUpdatePlan = { pageId, componentId, ariadaStatus, componentStatus };
  return incidentPayload === undefined ? plan : { ...plan, incidentPayload };
}

/** The plan, carried out, with the board's own answer attached. */
export async function updateStatusComponent(
  result: unknown,
  options: UpdateStatusComponentOptions,
): Promise<StatusUpdateResult> {
  const plan = createStatusUpdatePlan(result, options);
  const receipt = await options.provider.updateComponent({
    pageId: plan.pageId,
    componentId: plan.componentId,
    status: plan.componentStatus,
  });
  return { ...plan, receipt };
}
