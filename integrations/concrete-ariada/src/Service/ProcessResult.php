<?php

namespace ConcreteAriada\Service;

defined('C5_EXECUTE') or die('Access Denied.');

final class ProcessResult
{
    private int $exitCode;
    private string $stdout;
    private string $stderr;

    public function __construct(int $exitCode, string $stdout, string $stderr)
    {
        $this->exitCode = $exitCode;
        $this->stdout = $stdout;
        $this->stderr = $stderr;
    }

    public function exitCode(): int
    {
        return $this->exitCode;
    }

    public function stdout(): string
    {
        return $this->stdout;
    }

    public function stderr(): string
    {
        return $this->stderr;
    }
}
