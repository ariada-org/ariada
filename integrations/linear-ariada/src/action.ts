import { readFile } from 'node:fs/promises';

import { createIssue, LinearGraphQL, listTeamIssues } from './linear.js';
import { findingsFromReport, hasFingerprint, toLinearIssue } from './mapper.js';
import type { AriadaReport, LinearTransport, SyncResult } from './types.js';
export async function syncReport(
    report: AriadaReport,
    config: { teamId: string; transport: LinearTransport },
): Promise<SyncResult> {
    const sourceUrl = report.reportUrl ?? report.url;
    const existing = await listTeamIssues(config.transport, config.teamId);
    const created: SyncResult['created'] = [];
    const skipped: SyncResult['skipped'] = [];
    for (const finding of findingsFromReport(report)) {
        const input = toLinearIssue(finding, { teamId: config.teamId, reportUrl: sourceUrl });
        if (existing.some((issue) => hasFingerprint(issue, input.fingerprint))) {
            skipped.push(input.fingerprint);
            continue;
        }
        created.push(await createIssue(config.transport, input));
    }
    return { created, skipped };
}
if (process.argv[1]?.endsWith('/action.js')) {
    const token = process.env.LINEAR_API_KEY;
    const teamId = process.env.LINEAR_TEAM_ID;
    const inputPath = process.env.ARIADA_REPORT ?? process.argv[2];
    if (!token || !teamId || !inputPath)
        throw new Error('Set LINEAR_API_KEY, LINEAR_TEAM_ID and ARIADA_REPORT (or pass a report path).');
    const result = await syncReport(JSON.parse(await readFile(inputPath, 'utf8')), { teamId, transport: new LinearGraphQL(token) });
    console.log(JSON.stringify({ created: result.created.length, skipped: result.skipped.length, issues: result.created }, null, 2));
}
