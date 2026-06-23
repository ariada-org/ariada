<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Tests\Unit;

use Ariada\LaravelAccessibility\ScanResult;
use PHPUnit\Framework\TestCase;

final class ScanResultTest extends TestCase
{
 public function testCountsSummaryFindings(): void
 {
 $result = new ScanResult(
 url: 'https://example.test',
 report: ['summary' => ['total' => 3]],
 cliExitCode: 1,
 stdout: '',
 stderr: '',
);

 self::assertSame(3, $result->findingCount());
 self::assertFalse($result->passed());
 self::assertSame(1, $result->exitCode());
 }

 public function testCountsBucketedFindingsWhenSummaryIsAbsent(): void
 {
 $result = new ScanResult(
 url: 'https://example.test',
 report: [
 'findings' => [
 'accessibility' => [
 ['ruleId' => 'image-alt'],
 ['ruleId' => 'button-name'],
 ],
 ],
 ],
 cliExitCode: 0,
 stdout: '',
 stderr: '',
);

 self::assertSame(2, $result->findingCount());
 self::assertTrue($result->passed());
 self::assertSame(0, $result->exitCode());
 }
}
