<?php

declare(strict_types=1);

namespace Ariada\Symfony\Scanner;

final readonly class ProcessResult
{
 public function __construct(
 public int $exitCode,
 public string $stdout,
 public string $stderr,
) {
 }
}
