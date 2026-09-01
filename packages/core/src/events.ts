/**
 * Backwards-compat sub-export. Pre-split callers used
 * `import { ... } from '@ariada-org/core/events'`. Same surface, sourced from
 * `@ariada-org/core-engine`.
 */
export {
  createEventEmitter,
  scanEventSchema,
  type ScanEvent,
  type ScanEventEmitter,
  type ScanEventListener,
  type Unsubscribe,
} from '@ariada-org/core-engine';
