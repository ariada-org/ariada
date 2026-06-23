<?php

declare(strict_types=1);

namespace Ariada\Symfony\Scanner;

final readonly class ScanOptions
{
 /**
 * @param list<string> $domains
 */
 public function __construct(
 public string $outputDir,
 public string $cliCommand = 'ariada',
 public string $browser = 'chromium',
 public string $format = 'json',
 public string $severityThreshold = 'moderate',
 public int $timeoutMs = 30000,
 public array $domains = [],
) {
 }
}
