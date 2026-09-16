<?php

declare(strict_types=1);

namespace Ariada\Symfony\Scanner;

final readonly class ScanResult
{
    public function __construct(
        public string $target,
        public int $exitCode,
        public string $stdout,
        public string $stderr,
        public ?string $reportPath,
        public int $totalFindings,
    ) {
    }

    public function gateFailed(): bool
    {
        return $this->exitCode === 1;
    }

    public function runtimeFailed(): bool
    {
        return $this->exitCode >= 2;
    }
}
