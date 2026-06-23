<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Tests\Feature;

use Ariada\LaravelAccessibility\AriadaScanner;
use Ariada\LaravelAccessibility\Contracts\CliRunner;
use Ariada\LaravelAccessibility\Laravel\AriadaServiceProvider;
use Orchestra\Testbench\TestCase;

final class ScanCommandTest extends TestCase
{
 protected function getPackageProviders($app): array
 {
 return [AriadaServiceProvider::class];
 }

 public function testArtisanCommandPrintsFindingsFromInjectedScanner(): void
 {
 $runner = new class implements CliRunner {
 /**
 * @param list<string> $command
 *
 * @return array{exitCode:int, stdout:string, stderr:string}
 */
 public function run(array $command, int $timeoutSeconds = 60): array
 {
 $outputDir = $command[array_search('--output-dir', $command, true) + 1];
 file_put_contents($outputDir.'/scan.json', json_encode([
 'summary' => ['total' => 2],
 ], JSON_THROW_ON_ERROR));

 return ['exitCode' => 1, 'stdout' => '', 'stderr' => ''];
 }
 };

 $this->app->instance(AriadaScanner::class, new AriadaScanner($runner));
 config()->set('ariada.base_url', 'https://laravel.example.test');
 config()->set('ariada.domains', ['accessibility']);

 $this->artisan('ariada:scan')
 ->expectsOutput('Ariada scan: https://laravel.example.test')
 ->expectsOutput('Domains: accessibility')
 ->expectsOutput('Findings: 2')
 ->assertExitCode(1);
 }
}
