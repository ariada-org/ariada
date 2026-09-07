<?php

namespace ConcreteAriada\Service;

defined('C5_EXECUTE') or die('Access Denied.');

use ConcreteAriada\Model\AuditReport;
use ConcreteAriada\Model\Settings;
use FilesystemIterator;
use JsonException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;

final class AriadaService
{
    private ReportParser $parser;
    private ProcessRunner $processRunner;

    public function __construct(ReportParser $parser, ProcessRunner $processRunner)
    {
        $this->parser = $parser;
        $this->processRunner = $processRunner;
    }

    public function getReport(Settings $settings): AuditReport
    {
        if ($settings->siteUrl() === '') {
            throw new AriadaException('Site URL is required.');
        }

        if ($settings->mode() === 'report') {
            $report = $this->loadReportFile($settings);
        } else {
            $report = $this->runCli($settings);
        }

        if ($report->url() !== $settings->siteUrl()) {
            throw new AriadaException('The Ariada report URL does not exactly match the configured site URL.');
        }

        return $report;
    }

    private function loadReportFile(Settings $settings): AuditReport
    {
        $path = $this->resolveReportPath($settings->reportDirectory(), $settings->reportFilename());
        return $this->parser->parse($this->readLimitedFile($path, $settings->maxReportBytes()));
    }

    private function runCli(Settings $settings): AuditReport
    {
        $outputDirectory = $this->createTemporaryDirectory();

        try {
            $command = array_merge($settings->cliCommandPrefix(), [
                'scan',
                $settings->siteUrl(),
                '--format',
                'json',
                '--output-dir',
                $outputDirectory,
                '--browser',
                $settings->browser(),
                '--severity-threshold',
                $settings->severityThreshold(),
                '--timeout-ms',
                (string) $settings->navigationTimeoutMs(),
            ]);

            try {
                $result = $this->processRunner->run(
                    $command,
                    $settings->processTimeoutSeconds(),
                    $settings->maxProcessOutputBytes(),
                    $outputDirectory
                );
            } catch (RuntimeException $exception) {
                throw new AriadaException('The Ariada CLI could not be executed safely.', 0, $exception);
            }

            if (!in_array($result->exitCode(), [0, 1], true)) {
                throw new AriadaException($this->safeCliFailure($result->exitCode(), $result->stderr()));
            }

            $reportPath = $this->resolveReportPath($outputDirectory, 'scan.json');
            $report = $this->parser->parse($this->readLimitedFile($reportPath, $settings->maxReportBytes()));
            if ($report->exitCode() !== $result->exitCode()) {
                throw new AriadaException('The Ariada CLI exit code does not match the generated report.');
            }

            return $report;
        } finally {
            $this->removeDirectory($outputDirectory);
        }
    }

    private function resolveReportPath(string $directory, string $filename): string
    {
        $base = realpath($directory);
        if ($base === false || !is_dir($base)) {
            throw new AriadaException('The configured Ariada report directory is unavailable.');
        }

        $path = realpath($base . DIRECTORY_SEPARATOR . $filename);
        if ($path === false || !is_file($path)) {
            throw new AriadaException('The configured Ariada report file is unavailable.');
        }

        $prefix = rtrim($base, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (!str_starts_with($path, $prefix)) {
            throw new AriadaException('The configured Ariada report file is outside the allowed directory.');
        }

        return $path;
    }

    private function readLimitedFile(string $path, int $maximumBytes): string
    {
        $handle = @fopen($path, 'rb');
        if (!is_resource($handle)) {
            throw new AriadaException('The Ariada report could not be opened.');
        }

        $contents = '';
        try {
            while (!feof($handle)) {
                $remaining = $maximumBytes + 1 - strlen($contents);
                if ($remaining <= 0) {
                    throw new AriadaException('The Ariada report exceeds the configured size limit.');
                }
                $chunk = fread($handle, min(8192, $remaining));
                if ($chunk === false) {
                    throw new AriadaException('The Ariada report could not be read.');
                }
                $contents .= $chunk;
                if (strlen($contents) > $maximumBytes) {
                    throw new AriadaException('The Ariada report exceeds the configured size limit.');
                }
            }
        } finally {
            fclose($handle);
        }

        return $contents;
    }

    private function createTemporaryDirectory(): string
    {
        for ($attempt = 0; $attempt < 3; ++$attempt) {
            try {
                $suffix = bin2hex(random_bytes(16));
            } catch (Throwable $exception) {
                throw new AriadaException('A secure temporary directory could not be created.', 0, $exception);
            }
            $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
                . DIRECTORY_SEPARATOR
                . 'concrete-ariada-'
                . $suffix;
            if (@mkdir($path, 0700)) {
                return $path;
            }
        }

        throw new AriadaException('A secure temporary directory could not be created.');
    }

    private function safeCliFailure(int $exitCode, string $stderr): string
    {
        $knownMessages = [
            'E_INVALID_URL' => 'Ariada rejected the configured site URL.',
            'E_INVALID_OPTION' => 'Ariada rejected a configured scan option.',
            'E_NAVIGATION_TIMEOUT' => 'Ariada timed out while loading the configured site.',
            'E_NAVIGATION_FAILED' => 'Ariada could not load the configured site.',
            'E_BROWSER_LAUNCH' => 'Ariada could not start its configured browser.',
            'E_BROWSER_CRASH' => 'The Ariada browser process stopped unexpectedly.',
            'E_OUTPUT_WRITE' => 'Ariada could not write its report.',
            'E_INTERNAL' => 'Ariada reported an internal error.',
        ];

        foreach (preg_split('/\R/', trim($stderr)) ?: [] as $line) {
            try {
                $payload = json_decode($line, true, 16, JSON_THROW_ON_ERROR);
            } catch (JsonException $exception) {
                continue;
            }
            if (is_array($payload) && is_string($payload['code'] ?? null) && isset($knownMessages[$payload['code']])) {
                return $knownMessages[$payload['code']];
            }
        }

        return sprintf('The Ariada CLI exited with code %d.', $exitCode);
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $item) {
            if ($item->isDir() && !$item->isLink()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($directory);
    }
}
