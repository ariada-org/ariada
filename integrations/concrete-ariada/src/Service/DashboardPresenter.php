<?php

namespace ConcreteAriada\Service;

defined('C5_EXECUTE') or die('Access Denied.');

use ConcreteAriada\Model\AuditReport;
use ConcreteAriada\Model\Settings;

final class DashboardPresenter
{
    /** @return array<string, string|int> */
    public function settings(Settings $settings): array
    {
        return [
            'mode' => $this->escape($settings->mode()),
            'siteUrl' => $this->escape($settings->siteUrl()),
            'reportFilename' => $this->escape($settings->reportFilename()),
            'browser' => $this->escape($settings->browser()),
            'severityThreshold' => $this->escape($settings->severityThreshold()),
            'navigationTimeoutMs' => $settings->navigationTimeoutMs(),
        ];
    }

    /** @return array<string, mixed> */
    public function report(AuditReport $report, int $limit): array
    {
        $violations = [];
        foreach (array_slice($report->violations(), 0, $limit) as $violation) {
            $violations[] = [
                'ruleId' => $this->escape($violation->ruleId()),
                'severity' => $this->escape($violation->severity()),
                'message' => $this->escape($violation->message()),
                'count' => $violation->count(),
            ];
        }

        return [
            'passed' => $report->passed(),
            'statusLabel' => $report->passed() ? 'PASS' : 'FAIL',
            'url' => $this->escape($report->url()),
            'scanId' => $this->escape($report->scanId()),
            'startedAt' => $this->escape($report->startedAt()),
            'completedAt' => $this->escape($report->completedAt()),
            'durationMs' => $report->durationMs(),
            'total' => $report->total(),
            'byImpact' => $report->byImpact(),
            'violations' => $violations,
        ];
    }

    public function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }

    public function safeError(string $message): string
    {
        $message = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/', ' ', $message) ?? '';
        return $this->escape(substr(trim($message), 0, 500));
    }
}
