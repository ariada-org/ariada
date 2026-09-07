<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

namespace local_ariada\local;

/**
 * Executes the fixed packaged Ariada CLI without a shell.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class cli_runner {
    /** Maximum report bytes retained. */
    private const MAX_REPORT_BYTES = 10485760;
    /** Maximum bytes retained per stream. */
    private const MAX_STREAM_BYTES = 1048576;

    /**
     * Return the immutable packaged CLI path.
     *
     * @return string Fixed CLI path.
     */
    public static function cli_path(): string {
        return dirname(__DIR__, 2) . '/runtime/node_modules/@ariada-org/cli/dist/bin.js';
    }

    /**
     * Run one accessibility scan.
     *
     * @param string $url Validated URL.
     * @param string $severity Threshold.
     * @return array Process result.
     */
    public function scan(string $url, string $severity): array {
        global $CFG;
        if (!function_exists('proc_open')) {
            throw new \RuntimeException('PHP proc_open is unavailable.');
        }
        $clipath = self::cli_path();
        if (!is_file($clipath)) {
            throw new \RuntimeException('Packaged Ariada CLI is missing.');
        }
        $timeoutms = max(5000, min(300000, (int) (get_config('local_ariada', 'timeoutms') ?: 30000)));
        $severity = in_array($severity, ['minor', 'moderate', 'serious', 'critical'], true)
            ? $severity : 'moderate';
        $outputdir = $CFG->tempdir . '/local_ariada/' . bin2hex(random_bytes(12));
        if (!make_writable_directory($outputdir, true)) {
            throw new \RuntimeException('Could not create an Ariada output directory.');
        }
        $command = [
            (string) (get_config('local_ariada', 'nodebinary') ?: 'node'),
            $clipath,
            'scan',
            $url,
            '--domains',
            'accessibility',
            '--format',
            'json',
            '--output-dir',
            $outputdir,
            '--severity-threshold',
            $severity,
            '--timeout-ms',
            (string) $timeoutms,
        ];
        if (get_config('local_ariada', 'allowprivate')) {
            $command[] = '--allow-private';
        }
        $environment = getenv();
        $environment = is_array($environment) ? $environment : [];
        $environment['NO_COLOR'] = '1';
        $environment['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
        $browserpath = trim((string) get_config('local_ariada', 'browserspath'));
        if ($browserpath !== '') {
            $environment['PLAYWRIGHT_BROWSERS_PATH'] = $browserpath;
        }
        try {
            $result = $this->execute($command, $environment, (int) ceil($timeoutms / 1000) + 20);
            $reportpath = $outputdir . '/multi-domain-report.json';
            if (!in_array($result['exitcode'], [0, 1], true)) {
                throw new \RuntimeException(trim($result['stderr']) ?: 'Ariada process failed.');
            }
            if (!is_file($reportpath) || filesize($reportpath) > self::MAX_REPORT_BYTES) {
                throw new \RuntimeException('Ariada did not write a bounded report.');
            }
            $json = file_get_contents($reportpath);
            if (!is_string($json) || $json === '') {
                throw new \RuntimeException('Ariada report is empty.');
            }
            $result['reportjson'] = $json;
            return $result;
        } finally {
            $this->remove_directory($outputdir);
        }
    }

    /**
     * Execute a command with bounded output and time.
     *
     * @param array $command Argument vector.
     * @param array $environment Child environment.
     * @param int $timeoutseconds Wall-clock timeout.
     * @return array Process result.
     */
    private function execute(array $command, array $environment, int $timeoutseconds): array {
        $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = proc_open($command, $descriptors, $pipes, null, $environment);
        if (!is_resource($process)) {
            throw new \RuntimeException('Could not start the Ariada process.');
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $stdout = '';
        $stderr = '';
        $deadline = microtime(true) + $timeoutseconds;
        $status = proc_get_status($process);
        while ($status['running']) {
            $stdout = $this->append_bounded($stdout, stream_get_contents($pipes[1]) ?: '');
            $stderr = $this->append_bounded($stderr, stream_get_contents($pipes[2]) ?: '');
            if (microtime(true) >= $deadline) {
                proc_terminate($process);
                fclose($pipes[1]);
                fclose($pipes[2]);
                proc_close($process);
                throw new \RuntimeException('Ariada process exceeded its wall-clock timeout.');
            }
            usleep(100000);
            $status = proc_get_status($process);
        }
        $stdout = $this->append_bounded($stdout, stream_get_contents($pipes[1]) ?: '');
        $stderr = $this->append_bounded($stderr, stream_get_contents($pipes[2]) ?: '');
        fclose($pipes[1]);
        fclose($pipes[2]);
        $closecode = proc_close($process);
        $exitcode = $status['exitcode'] >= 0 ? $status['exitcode'] : $closecode;
        return ['exitcode' => $exitcode, 'stdout' => $stdout, 'stderr' => $stderr];
    }

    /**
     * Append a process output chunk within the memory limit.
     *
     * @param string $existing Existing output.
     * @param string $chunk New output.
     * @return string Bounded output.
     */
    private function append_bounded(string $existing, string $chunk): string {
        return substr($existing . $chunk, 0, self::MAX_STREAM_BYTES);
    }

    /**
     * Remove the private per-scan output directory.
     *
     * @param string $directory Private temporary directory.
     */
    private function remove_directory(string $directory): void {
        if (!is_dir($directory)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $entry) {
            $entry->isDir() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        }
        rmdir($directory);
    }
}
