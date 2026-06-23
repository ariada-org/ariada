<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Tests\Unit;

use Ariada\LaravelAccessibility\AriadaScanner;
use Ariada\LaravelAccessibility\Contracts\CliRunner;
use PHPUnit\Framework\TestCase;

final class AriadaScannerTest extends TestCase
{
 public function testRunsSharedCliAndParsesScanJson(): void
 {
 $runner = new class implements CliRunner {
 /** @var list<string> */
 public array $command = [];

 /**
 * @param list<string> $command
 *
 * @return array{exitCode:int, stdout:string, stderr:string}
 */
 public function run(array $command, int $timeoutSeconds = 60): array
 {
 $this->command = $command;
 $outputDir = $command[array_search('--output-dir', $command, true) + 1];
 file_put_contents($outputDir.'/scan.json', json_encode([
 'summary' => ['total' => 1],
 'report' => ['findings' => [['ruleId' => 'image-alt']]],
 ], JSON_THROW_ON_ERROR));

 return ['exitCode' => 1, 'stdout' => 'Wrote scan.json', 'stderr' => ''];
 }
 };

 $scanner = new AriadaScanner($runner, 'ariada', 5);
 $result = $scanner->scan('https://example.test/dashboard', [
 'domains' => ['accessibility'],
 'severityThreshold' => 'serious',
 ]);

 self::assertSame(1, $result->findingCount());
 self::assertSame('ariada', $runner->command[0]);
 self::assertContains('scan', $runner->command);
 self::assertContains('https://example.test/dashboard', $runner->command);
 self::assertContains('--domains', $runner->command);
 self::assertContains('accessibility', $runner->command);
 self::assertContains('--severity-threshold', $runner->command);
 self::assertContains('serious', $runner->command);
 }
}
