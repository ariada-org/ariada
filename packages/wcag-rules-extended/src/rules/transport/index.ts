// SPDX-FileCopyrightText: 2025-2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/**
 * Pack G — Transport services rules.
 *
 * 5 rules covering EAA Annex I §I.7 (transport services: booking, timetables,
 * ticketing). The rules detect transport-domain UI via explicit data-attribute
 * markers (data-timetable, data-live-status, data-seat-map, data-booking-timeout,
 * data-fare-table) so they never false-positive on unrelated markup.
 */

import type { RuleDefinition, CheckDefinition, RulePack } from '../../types.js';

import {
  rule as bookingTimeoutRule,
  checkDefinition as bookingTimeoutCheck,
} from './booking-timeout-has-warning.js';
import {
  rule as fareTableRule,
  checkDefinition as fareTableCheck,
} from './fare-table-has-caption.js';
import {
  rule as liveStatusRule,
  checkDefinition as liveStatusCheck,
} from './live-status-has-live-region.js';
import {
  rule as seatSelectionRule,
  checkDefinition as seatSelectionCheck,
} from './seat-selection-has-accessible-name.js';
import {
  rule as timetableRule,
  checkDefinition as timetableCheck,
} from './timetable-has-header-cells.js';

export const transportRules: RuleDefinition[] = [
  timetableRule,
  liveStatusRule,
  seatSelectionRule,
  bookingTimeoutRule,
  fareTableRule,
];

export const transportChecks: CheckDefinition[] = [
  timetableCheck,
  liveStatusCheck,
  seatSelectionCheck,
  bookingTimeoutCheck,
  fareTableCheck,
];

export const transportPack: RulePack = {
  id: 'transport',
  name: 'Transport services (EAA Annex I §I.7)',
  description:
    'Rule pack targeting EAA-2025 transport services: timetables, live departure boards, seat maps, booking hold timers, and fare tables.',
  rules: transportRules,
  checks: transportChecks,
};
