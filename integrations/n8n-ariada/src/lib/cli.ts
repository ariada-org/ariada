import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import type { AriadaReport } from './contracts';
import { normalizeReport } from './report';

export interface ScanRunner {
	executable: string;
	args: string[];
	cwd?: string;
}

export function runAriadaCli(config: ScanRunner): AriadaReport {
	const result = spawnSync(config.executable, config.args, { cwd: config.cwd, encoding: 'utf8' });
	if (result.error)
		throw result.error;
	if (result.status !== 0)
		throw new Error(`Ariada CLI failed with exit code ${result.status}: ${result.stderr.trim()}`);
	return normalizeReport(JSON.parse(result.stdout));
}

export function readReportFile(path: string): AriadaReport { return normalizeReport(JSON.parse(readFileSync(path, 'utf8'))); }
