<?php

namespace ConcreteAriada\Model;

defined('C5_EXECUTE') or die('Access Denied.');

final class AuditReport
{
    private string $url;
    private string $scanId;
    private string $startedAt;
    private string $completedAt;
    private int $durationMs;
    private int $total;
    /** @var array{critical: int, serious: int, moderate: int, minor: int} */
    private array $byImpact;
    /** @var list<Violation> */
    private array $violations;
    private int $exitCode;

    /**
     * @param array{critical: int, serious: int, moderate: int, minor: int} $byImpact
     * @param list<Violation> $violations
     */
    public function __construct(
        string $url,
        string $scanId,
        string $startedAt,
        string $completedAt,
        int $durationMs,
        int $total,
        array $byImpact,
        array $violations,
        int $exitCode
    ) {
        $this->url = $url;
        $this->scanId = $scanId;
        $this->startedAt = $startedAt;
        $this->completedAt = $completedAt;
        $this->durationMs = $durationMs;
        $this->total = $total;
        $this->byImpact = $byImpact;
        $this->violations = $violations;
        $this->exitCode = $exitCode;
    }

    public function url(): string
    {
        return $this->url;
    }

    public function scanId(): string
    {
        return $this->scanId;
    }

    public function startedAt(): string
    {
        return $this->startedAt;
    }

    public function completedAt(): string
    {
        return $this->completedAt;
    }

    public function durationMs(): int
    {
        return $this->durationMs;
    }

    public function total(): int
    {
        return $this->total;
    }

    /** @return array{critical: int, serious: int, moderate: int, minor: int} */
    public function byImpact(): array
    {
        return $this->byImpact;
    }

    /** @return list<Violation> */
    public function violations(): array
    {
        return $this->violations;
    }

    public function exitCode(): int
    {
        return $this->exitCode;
    }

    public function passed(): bool
    {
        return $this->exitCode === 0;
    }
}
