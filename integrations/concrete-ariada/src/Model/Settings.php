<?php

namespace ConcreteAriada\Model;

defined('C5_EXECUTE') or die('Access Denied.');

use InvalidArgumentException;

final class Settings
{
    private const MODES = ['report', 'cli'];
    private const BROWSERS = ['chromium', 'firefox', 'webkit'];
    private const SEVERITIES = ['minor', 'moderate', 'serious', 'critical'];

    private string $mode;
    private string $siteUrl;
    private string $reportFilename;
    private string $browser;
    private string $severityThreshold;
    private int $navigationTimeoutMs;
    private string $reportDirectory;
    private bool $allowPrivateHosts;
    /** @var list<string> */
    private array $cliCommandPrefix;
    private int $processTimeoutSeconds;
    private int $maxProcessOutputBytes;
    private int $maxReportBytes;
    private int $topViolations;

    /**
     * @param array<string, mixed> $values
     */
    public static function fromArray(array $values, bool $requireSiteUrl = false): self
    {
        $settings = new self();
        $settings->mode = self::enumValue($values, 'mode', 'report', self::MODES, 'Input mode is invalid.');
        $settings->siteUrl = trim(self::stringValue($values, 'site_url', ''));
        $settings->reportFilename = trim(self::stringValue($values, 'report_filename', 'scan.json'));
        $settings->browser = self::enumValue($values, 'browser', 'chromium', self::BROWSERS, 'Browser is invalid.');
        $settings->severityThreshold = self::enumValue(
            $values,
            'severity_threshold',
            'moderate',
            self::SEVERITIES,
            'Severity threshold is invalid.'
        );
        $settings->navigationTimeoutMs = self::integerValue(
            $values,
            'navigation_timeout_ms',
            30000,
            1000,
            120000,
            'Navigation timeout must be between 1000 and 120000 milliseconds.'
        );
        $settings->reportDirectory = rtrim(
            self::stringValue($values, 'report_directory', ''),
            DIRECTORY_SEPARATOR
        );
        $settings->allowPrivateHosts = (bool) ($values['allow_private_hosts'] ?? false);
        $settings->cliCommandPrefix = self::commandPrefix($values['cli_command_prefix'] ?? []);
        $settings->processTimeoutSeconds = self::integerValue(
            $values,
            'process_timeout_seconds',
            60,
            5,
            300,
            'Process timeout must be between 5 and 300 seconds.'
        );
        $settings->maxProcessOutputBytes = self::integerValue(
            $values,
            'max_process_output_bytes',
            65536,
            1024,
            10485760,
            'Process output limit is invalid.'
        );
        $settings->maxReportBytes = self::integerValue(
            $values,
            'max_report_bytes',
            5242880,
            1024,
            20971520,
            'Report size limit is invalid.'
        );
        $settings->topViolations = self::integerValue(
            $values,
            'top_violations',
            10,
            1,
            100,
            'Top violations limit is invalid.'
        );

        self::validateReportFilename($settings->reportFilename);
        self::validateReportDirectory($settings->reportDirectory);

        if ($settings->siteUrl !== '') {
            self::validateSiteUrl($settings->siteUrl, $settings->allowPrivateHosts);
        } elseif ($requireSiteUrl) {
            throw new InvalidArgumentException('Site URL is required.');
        }

        return $settings;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'mode' => $this->mode,
            'site_url' => $this->siteUrl,
            'report_filename' => $this->reportFilename,
            'browser' => $this->browser,
            'severity_threshold' => $this->severityThreshold,
            'navigation_timeout_ms' => $this->navigationTimeoutMs,
            'report_directory' => $this->reportDirectory,
            'allow_private_hosts' => $this->allowPrivateHosts,
            'cli_command_prefix' => $this->cliCommandPrefix,
            'process_timeout_seconds' => $this->processTimeoutSeconds,
            'max_process_output_bytes' => $this->maxProcessOutputBytes,
            'max_report_bytes' => $this->maxReportBytes,
            'top_violations' => $this->topViolations,
        ];
    }

    public function mode(): string
    {
        return $this->mode;
    }

    public function siteUrl(): string
    {
        return $this->siteUrl;
    }

    public function reportFilename(): string
    {
        return $this->reportFilename;
    }

    public function browser(): string
    {
        return $this->browser;
    }

    public function severityThreshold(): string
    {
        return $this->severityThreshold;
    }

    public function navigationTimeoutMs(): int
    {
        return $this->navigationTimeoutMs;
    }

    public function reportDirectory(): string
    {
        return $this->reportDirectory;
    }

    public function allowPrivateHosts(): bool
    {
        return $this->allowPrivateHosts;
    }

    /** @return list<string> */
    public function cliCommandPrefix(): array
    {
        return $this->cliCommandPrefix;
    }

    public function processTimeoutSeconds(): int
    {
        return $this->processTimeoutSeconds;
    }

    public function maxProcessOutputBytes(): int
    {
        return $this->maxProcessOutputBytes;
    }

    public function maxReportBytes(): int
    {
        return $this->maxReportBytes;
    }

    public function topViolations(): int
    {
        return $this->topViolations;
    }

    /**
     * @param array<string, mixed> $values
     * @param list<string> $allowed
     */
    private static function enumValue(
        array $values,
        string $key,
        string $default,
        array $allowed,
        string $message
    ): string {
        $value = self::stringValue($values, $key, $default);
        if (!in_array($value, $allowed, true)) {
            throw new InvalidArgumentException($message);
        }

        return $value;
    }

    /** @param array<string, mixed> $values */
    private static function stringValue(array $values, string $key, string $default): string
    {
        if (!array_key_exists($key, $values)) {
            return $default;
        }

        if (!is_string($values[$key])) {
            throw new InvalidArgumentException('A settings value has an invalid type.');
        }

        return $values[$key];
    }

    /** @param array<string, mixed> $values */
    private static function integerValue(
        array $values,
        string $key,
        int $default,
        int $minimum,
        int $maximum,
        string $message
    ): int {
        $value = $values[$key] ?? $default;
        if (is_string($value) && preg_match('/^[0-9]+$/D', $value) === 1) {
            $value = (int) $value;
        }
        if (!is_int($value) || $value < $minimum || $value > $maximum) {
            throw new InvalidArgumentException($message);
        }

        return $value;
    }

    /**
     * @param mixed $value
     * @return list<string>
     */
    private static function commandPrefix($value): array
    {
        if (!is_array($value) || !array_is_list($value) || $value === [] || count($value) > 8) {
            throw new InvalidArgumentException('CLI command prefix is invalid.');
        }

        $containsAriadaPackage = false;
        foreach ($value as $argument) {
            if (!is_string($argument) || $argument === '' || strlen($argument) > 512 || strpos($argument, "\0") !== false) {
                throw new InvalidArgumentException('CLI command prefix is invalid.');
            }
            if (preg_match('/^@ariada-org\/cli(?:@[0-9A-Za-z._-]+)?$/D', $argument) === 1) {
                $containsAriadaPackage = true;
            }
        }

        $binaryName = basename(str_replace('\\', '/', $value[0]));
        if (!$containsAriadaPackage && $binaryName !== 'ariada' && $binaryName !== 'ariada.exe') {
            throw new InvalidArgumentException('CLI command must invoke @ariada-org/cli or the ariada binary.');
        }

        return array_values($value);
    }

    private static function validateReportFilename(string $filename): void
    {
        if (
            $filename === ''
            || strlen($filename) > 128
            || basename($filename) !== $filename
            || preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/D', $filename) !== 1
        ) {
            throw new InvalidArgumentException('Report filename must be a plain .json filename.');
        }
    }

    private static function validateReportDirectory(string $directory): void
    {
        $isUnixAbsolute = str_starts_with($directory, '/');
        $isWindowsAbsolute = preg_match('/^[A-Za-z]:[\\\\\/]/D', $directory) === 1
            || str_starts_with($directory, '\\\\');

        if ($directory === '' || (!$isUnixAbsolute && !$isWindowsAbsolute) || strpos($directory, "\0") !== false) {
            throw new InvalidArgumentException('Report directory must be an absolute path.');
        }
    }

    private static function validateSiteUrl(string $url, bool $allowPrivateHosts): void
    {
        if (strlen($url) > 2048 || filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('Site URL must be a valid http or https URL.');
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $user = parse_url($url, PHP_URL_USER);
        $password = parse_url($url, PHP_URL_PASS);
        $fragment = parse_url($url, PHP_URL_FRAGMENT);

        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('Site URL must use http or https and include a host.');
        }
        if ($user !== null || $password !== null) {
            throw new InvalidArgumentException('Site URL must not contain credentials.');
        }
        if ($fragment !== null) {
            throw new InvalidArgumentException('Site URL must not contain a fragment.');
        }

        if ($allowPrivateHosts) {
            return;
        }

        $privateName = $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.local')
            || str_ends_with($host, '.internal')
            || strpos($host, '.') === false;
        if ($privateName) {
            throw new InvalidArgumentException('Private or local site URLs are disabled by package configuration.');
        }

        if (
            filter_var($host, FILTER_VALIDATE_IP) !== false
            && filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false
        ) {
            throw new InvalidArgumentException('Private or reserved IP addresses are disabled by package configuration.');
        }
    }
}
