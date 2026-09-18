import { createHash } from 'node:crypto';

import { isRecord, type AriadaFinding, type AriadaReport } from './contracts';

const stringValue = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;

export function normalizeReport(input: unknown): AriadaReport {
	if (!isRecord(input) || typeof input.scanId !== 'string' || typeof input.passed !== 'boolean' || !Array.isArray(input.findings)) {
		throw new Error('Invalid Ariada report: scanId, passed, and findings are required');
	}
	const findings = input.findings.map((raw, index) => {
		if (!isRecord(raw) || typeof raw.ruleId !== 'string')
			throw new Error(`Invalid Ariada finding at index ${index}`);
		return raw as AriadaFinding;
	});
	return { ...input, scanId: input.scanId, passed: input.passed, findings };
}

// A stable name for a finding, so the same one in two reports is recognised as
// one thing downstream. It is built from what makes the finding what it is —
// the page, the rule, the element — and not from anything a rerun changes.
export function findingFingerprint(report: AriadaReport, finding: AriadaFinding): string {
	if (typeof finding.fingerprint === 'string' && finding.fingerprint.length > 0)
		return finding.fingerprint;
	const stable = [report.sourceUrl ?? '', finding.ruleId, finding.url ?? report.sourceUrl ?? '', finding.selector ?? '', finding.html ?? ''].join('|');
	return createHash('sha256').update(stable).digest('hex');
}

// Псевдоним типа, а не интерфейс, и это не вкусовщина: интерфейсу TypeScript
// не даёт неявной индексной сигнатуры, а рабочий процесс принимает объект,
// у которого она есть. Предмет от этого не меняется ни на поле — меняется
// только то, признаёт ли его чужой тип объектом JSON, каким он и является.
export type AriadaItemPayload = {
	scanId: string;
	completedAt?: string;
	passed: boolean;
	reportUrl?: string;
	sourceUrl?: string;
	finding: AriadaFinding;
	fingerprint: string;
}

// One item per finding rather than one per report: a workflow acts on a finding,
// and a report with forty of them is not something to branch on.
export function reportToItems(reportInput: unknown): AriadaItemPayload[] {
	const report = normalizeReport(reportInput);
	return report.findings.map((finding) => ({
		scanId: report.scanId, completedAt: report.completedAt, passed: report.passed,
		reportUrl: report.reportUrl, sourceUrl: report.sourceUrl, finding,
		fingerprint: findingFingerprint(report, finding),
	}));
}

// Объявленный тип — тот, который и возвращается. `Record<string, unknown>`
// выбрасывал всё, что здесь известно, и заодно делал предмет непригодным
// для рабочего процесса: `unknown` шире, чем значение, которое тот берёт.
export type AriadaCompletionPayload = {
	event: 'scan.completed';
	scanId: string;
	completedAt?: string;
	passed: boolean;
	sourceUrl?: string;
	reportUrl?: string;
	summary: AriadaReport['summary'];
	findingCount: number;
};

export function reportToCompletionItem(reportInput: unknown): AriadaCompletionPayload {
	const report = normalizeReport(reportInput);
	return { event: 'scan.completed', scanId: report.scanId, completedAt: report.completedAt, passed: report.passed, sourceUrl: report.sourceUrl, reportUrl: report.reportUrl, summary: report.summary, findingCount: report.findings.length };
}

export function getText(value: unknown): string { return stringValue(value) ?? ''; }
