<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility;

use Ariada\LaravelAccessibility\Contracts\CliRunner;
use RuntimeException;

final class AriadaScanner
{
    public function __construct(
        private readonly CliRunner $runner,
        private readonly string $binary = 'ariada',
        private readonly int $timeoutSeconds = 60,
    ) {
    }

    /**
     * @param array{domains?:list<string>, severityThreshold?:string, outputDir?:string} $options
     */
    public function scan(string $url, array $options = []): ScanResult
    {
        $outputDir = $options['outputDir'] ?? $this->makeOutputDirectory();
        $domains = $options['domains'] ?? ['accessibility'];
        $severityThreshold = $options['severityThreshold'] ?? 'serious';

        $command = [
            $this->binary,
            'scan',
            $url,
            '--domains',
            implode(',', $domains),
            '--format',
            'json',
            '--output-dir',
            $outputDir,
            '--severity-threshold',
            $severityThreshold,
        ];

        $process = $this->runner->run($command, $this->timeoutSeconds);
        $jsonPath = rtrim($outputDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'scan.json';
        $json = is_readable($jsonPath) ? file_get_contents($jsonPath) : false;

        if (! is_string($json) || $json === '') {
            throw new RuntimeException(
                'Ariada CLI did not write scan.json. Stderr: '.trim($process['stderr'])
            );
        }

        $decoded = json_decode($json, true);
        if (! is_array($decoded)) {
            throw new RuntimeException('Ariada CLI wrote invalid JSON to scan.json.');
        }

        $this->removeDirectory($outputDir);

        return new ScanResult(
            url: $url,
            report: $decoded,
            cliExitCode: $process['exitCode'],
            stdout: $process['stdout'],
            stderr: $process['stderr'],
        );
    }

    private function makeOutputDirectory(): string
    {
        $dir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'ariada-laravel-'.bin2hex(random_bytes(8));
        if (! mkdir($dir, 0700, true) && ! is_dir($dir)) {
            throw new RuntimeException('Unable to create temporary Ariada output directory.');
        }

        return $dir;
    }

    private function removeDirectory(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        foreach (glob(rtrim($dir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'*') ?: [] as $path) {
            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }

        rmdir($dir);
    }
}
