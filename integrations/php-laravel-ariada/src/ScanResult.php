<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility;

final class ScanResult
{
    /**
     * @param array<string, mixed> $report
     */
    public function __construct(
        public readonly string $url,
        public readonly array $report,
        public readonly int $cliExitCode,
        public readonly string $stdout,
        public readonly string $stderr,
    ) {
    }

    public function findingCount(): int
    {
        $summary = $this->report['summary'] ?? null;
        if (is_array($summary) && isset($summary['total']) && is_numeric($summary['total'])) {
            return (int) $summary['total'];
        }

        $findings = $this->report['report']['findings'] ?? $this->report['findings'] ?? [];
        if (is_array($findings) && array_is_list($findings)) {
            return count($findings);
        }

        if (is_array($findings)) {
            return array_reduce(
                $findings,
                static fn (int $count, mixed $bucket): int => $count + (is_array($bucket) ? count($bucket) : 0),
                0
            );
        }

        return 0;
    }

    public function passed(): bool
    {
        return $this->cliExitCode === 0;
    }

    public function exitCode(): int
    {
        return $this->passed() ? 0 : 1;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'url' => $this->url,
            'passed' => $this->passed(),
            'findingCount' => $this->findingCount(),
            'cliExitCode' => $this->cliExitCode,
            'stdout' => $this->stdout,
            'stderr' => $this->stderr,
            'report' => $this->report,
        ];
    }
}
