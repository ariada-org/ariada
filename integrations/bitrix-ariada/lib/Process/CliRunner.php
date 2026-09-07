<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Process;

use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Report\ReportReader;

final class CliRunner
{
    private const MAX_PROCESS_OUTPUT_BYTES = 262144;

    private string $binary;
    private string $browser;
    private string $severityThreshold;
    private int $scanTimeoutMs;
    private int $processTimeoutSeconds;
    private ReportReader $reader;

    public function __construct(
        string $binary,
        string $browser,
        string $severityThreshold,
        int $scanTimeoutMs,
        int $processTimeoutSeconds,
        ?ReportReader $reader = null
    ) {
        $this->binary = $binary;
        $this->browser = $browser;
        $this->severityThreshold = $severityThreshold;
        $this->scanTimeoutMs = $scanTimeoutMs;
        $this->processTimeoutSeconds = $processTimeoutSeconds;
        $this->reader = $reader ?? new ReportReader();
    }

    /** @return string[] */
    public function buildCommand(string $url, string $outputDirectory): array
    {
        return [
            $this->binary,
            'scan',
            $url,
            '--format',
            'json',
            '--output-dir',
            $outputDirectory,
            '--browser',
            $this->browser,
            '--severity-threshold',
            $this->severityThreshold,
            '--timeout-ms',
            (string)$this->scanTimeoutMs,
        ];
    }

    public function run(string $url): string
    {
        if (!function_exists('proc_open')) {
            throw ModuleException::process('Shell-free process execution is unavailable in this PHP installation.');
        }
        if (!$this->isAbsolutePath($this->binary) || !is_file($this->binary) || !is_executable($this->binary)) {
            throw ModuleException::process('The configured Ariada CLI executable is unavailable.');
        }

        $directory = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'bitrix-ariada-' . bin2hex(random_bytes(16));
        if (!@mkdir($directory, 0700, false)) {
            throw ModuleException::process('A private temporary directory could not be created.');
        }

        try {
            $exitCode = $this->execute($this->buildCommand($url, $directory), $directory);
            if (!in_array($exitCode, [0, 1], true)) {
                throw ModuleException::process('The Ariada CLI returned an execution error.');
            }
            return $this->reader->read($directory . DIRECTORY_SEPARATOR . 'scan.json');
        } finally {
            $this->removeDirectory($directory);
        }
    }

    /** @param string[] $command */
    private function execute(array $command, string $temporaryHome): int
    {
        $specification = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $path = dirname($this->binary) . PATH_SEPARATOR . '/usr/local/bin:/usr/bin:/bin';
        $environment = [
            'PATH' => $path,
            'HOME' => $temporaryHome,
            'TMPDIR' => $temporaryHome,
            'LANG' => 'C',
            'LC_ALL' => 'C',
            'NO_COLOR' => '1',
        ];
        if (DIRECTORY_SEPARATOR === '\\' && is_string(getenv('SystemRoot'))) {
            $environment['SystemRoot'] = (string)getenv('SystemRoot');
        }

        $pipes = [];
        $process = @proc_open(
            $command,
            $specification,
            $pipes,
            null,
            $environment,
            ['bypass_shell' => true, 'suppress_errors' => true]
        );
        if (!is_resource($process)) {
            throw ModuleException::process();
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $started = microtime(true);
        $capturedBytes = 0;
        $timedOut = false;
        $outputExceeded = false;
        $status = proc_get_status($process);

        while (is_array($status) && $status['running']) {
            foreach ([1, 2] as $index) {
                $chunk = stream_get_contents($pipes[$index]);
                if (is_string($chunk)) {
                    $capturedBytes += strlen($chunk);
                }
            }
            if ($capturedBytes > self::MAX_PROCESS_OUTPUT_BYTES) {
                $outputExceeded = true;
                $this->terminate($process);
                break;
            }
            if ((microtime(true) - $started) > $this->processTimeoutSeconds) {
                $timedOut = true;
                $this->terminate($process);
                break;
            }
            usleep(20000);
            $status = proc_get_status($process);
        }

        foreach ([1, 2] as $index) {
            $chunk = stream_get_contents($pipes[$index]);
            if (is_string($chunk)) {
                $capturedBytes += strlen($chunk);
            }
            fclose($pipes[$index]);
        }
        $status = proc_get_status($process);
        $closeCode = proc_close($process);

        if ($timedOut) {
            throw ModuleException::process('The Ariada CLI exceeded the configured process timeout.');
        }
        if ($outputExceeded || $capturedBytes > self::MAX_PROCESS_OUTPUT_BYTES) {
            throw ModuleException::process('The Ariada CLI produced excessive process output.');
        }

        if (is_array($status) && isset($status['exitcode']) && $status['exitcode'] >= 0) {
            return (int)$status['exitcode'];
        }
        return (int)$closeCode;
    }

    /** @param resource $process */
    private function terminate($process): void
    {
        @proc_terminate($process);
        usleep(100000);
        $status = proc_get_status($process);
        if (is_array($status) && $status['running']) {
            @proc_terminate($process, 9);
        }
    }

    private function removeDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $entry) {
            if ($entry->isDir() && !$entry->isLink()) {
                @rmdir($entry->getPathname());
            } else {
                @unlink($entry->getPathname());
            }
        }
        @rmdir($directory);
    }

    private function isAbsolutePath(string $path): bool
    {
        return $path !== '' && ($path[0] === '/' || preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1);
    }
}
