// SPDX-License-Identifier: Apache-2.0
//
// The visual contract two renderers share: the overlay paints it on a live
// page, a report emits the same box as static HTML.

export declare const SEVERITY_COLOUR: Record<string, string>;
export declare const DEFAULT_COLOUR: string;

/** Colour for a severity, falling back for anything unrecognised. */
export declare function sevColor(severity: string | undefined): string;

/** The outline the overlay draws, as plain style properties. */
export declare function boxStyle(severity: string | undefined): {
  border: string;
  borderRadius: string;
  boxShadow: string;
};
