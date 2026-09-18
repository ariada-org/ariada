import { readFile, writeFile } from 'node:fs/promises';

import { ClickUpRest } from './clickup.js';
import { findingsFromReport, hasFingerprint, toClickUpTask } from './mapper.js';
import type { AriadaReport, ClickUpTransport, DedupeState, SyncResult } from './types.js';
export async function syncReport(
    report: AriadaReport,
    config: {
        listId: string;
        transport: ClickUpTransport;
        severityFieldId?: string;
        ruleIdFieldId?: string;
        state?: DedupeState;
    },
): Promise<SyncResult> {
    const existing = await config.transport.listTasks(config.listId);
    const seen = new Set(existing.flatMap((task) => task.description?.match(/Ariada fingerprint: ([^\s]+)/)?.[1] ?? []).concat(Object.keys(config.state?.fingerprints ?? {})));
    const created: SyncResult['created'] = [];
    const skipped: SyncResult['skipped'] = [];
    const reportUrl = report.reportUrl ?? report.url;
    for (const finding of findingsFromReport(report)) {
        const input = toClickUpTask(finding, { reportUrl, severityFieldId: config.severityFieldId, ruleIdFieldId: config.ruleIdFieldId });
        if (seen.has(input.fingerprint) || existing.some((task) => hasFingerprint(task, input.fingerprint))) {
            skipped.push(input.fingerprint);
            continue;
        }
        const task = await config.transport.createTask(config.listId, input);
        created.push(task);
        seen.add(input.fingerprint);
        if (config.state)
            config.state.fingerprints[input.fingerprint] = task.id;
    }
    return { created, skipped };
}
if (process.argv[1]?.endsWith('/action.js')) {
    const token = process.env.CLICKUP_API_TOKEN;
    const listId = process.env.CLICKUP_LIST_ID;
    const inputPath = process.env.ARIADA_REPORT ?? process.argv[2];
    if (!token || !listId || !inputPath)
        throw new Error('Set CLICKUP_API_TOKEN, CLICKUP_LIST_ID and ARIADA_REPORT (or pass a report path).');
    const statePath = process.env.ARIADA_STATE_FILE;
    const state = statePath ? JSON.parse(await readFile(statePath, 'utf8')) : { fingerprints: {} };
    const result = await syncReport(JSON.parse(await readFile(inputPath, 'utf8')), { listId, transport: new ClickUpRest(token), severityFieldId: process.env.CLICKUP_SEVERITY_FIELD_ID, ruleIdFieldId: process.env.CLICKUP_RULE_ID_FIELD_ID, state });
    if (statePath)
        await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
    console.log(JSON.stringify({ created: result.created.length, skipped: result.skipped.length, tasks: result.created }, null, 2));
}
