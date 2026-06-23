<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Laravel;

use Ariada\LaravelAccessibility\AriadaScanner;
use Illuminate\Console\Command;

final class ScanCommand extends Command
{
 protected $signature = 'ariada:scan
 {url?: URL to scan. Defaults to ariada.base_url}
 {--format=table: Output format: table or json}
 {--threshold=: Override severity threshold: minor, moderate, serious, critical}';

 protected $description = 'Run an Ariada accessibility scan against a Laravel route or URL.';

 public function handle(AriadaScanner $scanner): int
 {
 $url = (string) ($this->argument('url') ?: config('ariada.base_url'));
 $domains = array_values(array_filter((array) config('ariada.domains', ['accessibility'])));
 $threshold = (string) ($this->option('threshold') ?: config('ariada.severity_threshold', 'serious'));

 $result = $scanner->scan($url, [
 'domains' => $domains,
 'severityThreshold' => $threshold,
 ]);

 if ($this->option('format') === 'json') {
 $this->line((string) json_encode($result->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

 return $result->exitCode();
 }

 $this->info('Ariada scan: '.$url);
 $this->line('Domains: '.implode(', ', $domains));
 $this->line('Findings: '.$result->findingCount());
 $this->line('CLI exit code: '.$result->cliExitCode);

 if ($result->passed()) {
 $this->info('Accessibility gate passed.');
 } else {
 $this->warn('Accessibility gate found release-blocking evidence.');
 }

 return $result->exitCode();
 }
}
