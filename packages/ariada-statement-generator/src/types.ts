// SPDX-License-Identifier: EUPL-1.2
/**
 * Local primitive types for @ariada/statement-generator.
 *
 * Kept narrow so the package stays standalone-installable (Supabase
 * pattern — independent usability is the test).
 */

/**
 * Supported UI locales for statement messages.
 * Nordic 4 + English baseline.
 */
export type Locale = 'en' | 'sv' | 'nb' | 'da' | 'fi';