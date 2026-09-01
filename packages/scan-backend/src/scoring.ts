/**
 * Re-export the locked scoring helper. Apps and UI consume from here too,
 * so swapping the source is a one-line change.
 * @patentBinding('D','IC1')
 */
export { scoreFromCounts, bandFromScore } from '@ariada-org/core';
export type { Counts, ScoreBand } from '@ariada-org/core';
