// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

// The shape of a status board, so the rest of this package never names one.
// There is a single implementation today; the point of the seam is that the
// planning can be tested without it.

import type { StatusComponentState } from './types.js';

/** Set one component to one state on one page. */
export interface ComponentUpdateRequest {
  readonly pageId: string;
  readonly componentId: string;
  readonly status: StatusComponentState;
}

/** What the board said it did — read back rather than assumed. */
export interface ComponentUpdateReceipt {
  readonly provider: string;
  readonly componentId: string;
  readonly status: StatusComponentState;
}

/** Anything that can be told a component changed state. */
export interface StatusBoardProvider {
  readonly name: string;
  updateComponent(request: ComponentUpdateRequest): Promise<ComponentUpdateReceipt>;
}
