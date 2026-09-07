<?php

namespace ConcreteAriada\Model;

defined('C5_EXECUTE') or die('Access Denied.');

final class Violation
{
    private string $ruleId;
    private string $severity;
    private string $message;
    private int $count;

    public function __construct(string $ruleId, string $severity, string $message, int $count)
    {
        $this->ruleId = $ruleId;
        $this->severity = $severity;
        $this->message = $message;
        $this->count = $count;
    }

    public function ruleId(): string
    {
        return $this->ruleId;
    }

    public function severity(): string
    {
        return $this->severity;
    }

    public function message(): string
    {
        return $this->message;
    }

    public function count(): int
    {
        return $this->count;
    }

    public function severityRank(): int
    {
        return [
            'minor' => 1,
            'moderate' => 2,
            'serious' => 3,
            'critical' => 4,
        ][$this->severity] ?? 0;
    }
}
