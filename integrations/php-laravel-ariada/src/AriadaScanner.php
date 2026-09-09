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
     * Refuses an address this must not hand to the scanner.
     *
     * This method is the package's public entry point, so the value arrives from
     * an application — commonly straight from a request — and until now nothing
     * looked at it.
     *
     * The command is built as an array, so no shell is involved and nothing
     * chains. What passes without this is a value beginning with a dash: the
     * scanner reads it as a flag rather than as an address. The dangerous part is
     * not the flags this builder sets again afterwards, but the ones it never
     * sets — and the address itself, which is then simply missing. A scan that
     * never had a target reports what an empty scan reports, and an empty scan
     * looks exactly like a clean page.
     *
     * Requiring a scheme and a host settles it: a dash can be neither.
     */
    private function assertScannableUrl(string $url): void
    {
        $parts = parse_url($url);

        if (
            ! is_array($parts)
            || ! isset($parts['scheme'], $parts['host'])
            || ! in_array($parts['scheme'], ['http', 'https'], true)
        ) {
            throw new RuntimeException('Ariada can only scan an http(s) URL; received: ' . $url);
        }
    }

    /**
     * @param array{domains?:list<string>, severityThreshold?:string, outputDir?:string} $options
     */
    public function scan(string $url, array $options = []): ScanResult
    {
        $this->assertScannableUrl($url);

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
            // A symlink is removed as a link, never followed. `is_dir()` answers
            // for the target, so a link to a directory would have sent this
            // recursion outside the temporary directory it is supposed to be
            // clearing, and everything it found there would have been deleted.
            // The directory is ours, randomly named and mode 0700, so planting a
            // link in it is not easy — but "not easy" is a poor thing to rest a
            // recursive delete on when the alternative is one line.
            if (is_link($path)) {
                unlink($path);

                continue;
            }

            is_dir($path) ? $this->removeDirectory($path) : unlink($path);
        }

        rmdir($dir);
    }
}
