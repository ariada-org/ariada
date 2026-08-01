// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

import {
    allChecks,
    allRules,
    type CheckDefinition,
    type RuleDefinition,
} from '@ariada-org/wcag-rules-extended';
import type { Check, Rule, Spec } from 'axe-core';

/** Native axe-core check configuration object. */
export type AxeCheckObject = Check;
/** Native axe-core rule configuration object. */
export type AxeRuleObject = Rule;
/** The rules-and-checks subset accepted by `axe.configure`. */
export type AxeConfigurePayload = Required<Pick<Spec, 'checks' | 'rules'>>;

/** Minimal contract required by {@link registerAriadaRules}. */
export interface AxeConfigurable {
    configure(spec: Spec): void;
}

function adaptRule(source: RuleDefinition): AxeRuleObject {
    return {
        id: source.id,
        selector: source.selector,
        impact: source.metadata.impact,
        any: [...source.any],
        all: [...source.all],
        none: [...source.none],
        tags: [...source.tags],
        ...(source.matches === undefined ? {} : { matches: source.matches }),
        metadata: {
            description: source.metadata.description,
            help: source.metadata.help,
            helpUrl: source.metadata.helpUrl,
        },
    };
}
function adaptCheck(source: CheckDefinition): AxeCheckObject {
    const sourceMetadata = source.metadata;
    const sourceMessages = sourceMetadata?.messages;
    const messages = sourceMessages?.pass === undefined || sourceMessages.fail === undefined
        ? undefined
        : {
            pass: sourceMessages.pass,
            fail: sourceMessages.fail,
            ...(sourceMessages.incomplete === undefined
                ? {}
                : { incomplete: sourceMessages.incomplete }),
        };
    return {
        id: source.id,
        evaluate: source.evaluate,
        ...(sourceMetadata === undefined
            ? {}
            : {
                metadata: {
                    ...(sourceMetadata.impact === undefined
                        ? {}
                        : { impact: sourceMetadata.impact }),
                    ...(messages === undefined ? {} : { messages }),
                },
            }),
    };
}
/** All Ariada rules normalized to axe-core's native rule shape. */
export const rules: AxeRuleObject[] = allRules.map(adaptRule);
/** All Ariada checks normalized to axe-core's native check shape. */
export const checks: AxeCheckObject[] = allChecks.map(adaptCheck);
/** Ready-to-use payload for `axe.configure(ariadaAxeRuleset)`. */
export const ariadaAxeRuleset: AxeConfigurePayload = { rules, checks };
/** Register the Ariada payload on an axe-core-compatible instance. */
export function registerAriadaRules(axe: AxeConfigurable): void {
    axe.configure(ariadaAxeRuleset);
}
export default ariadaAxeRuleset;
