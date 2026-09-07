<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Config;

use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Security\PublicUrlValidator;
use Bitrix\Main\Config\Option;

final class ModuleConfig
{
    public const MODULE_ID = 'bitrix.ariada';
    public const MODE_CLI = 'cli';
    public const MODE_REPORT = 'report';

    /** @return array<string, string|int> */
    public static function defaults(): array
    {
        return [
            'public_url' => '',
            'execution_mode' => self::MODE_REPORT,
            'cli_binary' => '/usr/local/bin/ariada',
            'report_path' => '/var/lib/bitrix-ariada/scan.json',
            'browser' => 'chromium',
            'severity_threshold' => 'moderate',
            'scan_timeout_ms' => 30000,
            'process_timeout_seconds' => 45,
        ];
    }

    /** @return array<string, string|int> */
    public static function load(): array
    {
        $defaults = self::defaults();
        $config = [];
        foreach ($defaults as $key => $default) {
            $value = Option::get(self::MODULE_ID, $key, (string)$default);
            $config[$key] = is_int($default) ? (int)$value : $value;
        }
        return $config;
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, string|int>
     */
    public static function validate(array $input, PublicUrlValidator $urlValidator): array
    {
        $publicUrl = $urlValidator->validate(self::stringValue($input, 'public_url'), true);
        $mode = self::stringValue($input, 'execution_mode');
        if (!in_array($mode, [self::MODE_CLI, self::MODE_REPORT], true)) {
            throw ModuleException::configuration('Execution mode must be CLI or CI report.');
        }

        $binary = self::stringValue($input, 'cli_binary');
        if (!self::isAbsolutePath($binary) || preg_match('/[\x00-\x1F\x7F]/', $binary) === 1) {
            throw ModuleException::configuration('CLI executable must be an absolute path.');
        }
        if ($mode === self::MODE_CLI && (!is_file($binary) || !is_executable($binary))) {
            throw ModuleException::configuration('CLI executable is not an executable file.');
        }

        $reportPath = self::stringValue($input, 'report_path');
        if (!self::isAbsolutePath($reportPath) || strtolower((string)pathinfo($reportPath, PATHINFO_EXTENSION)) !== 'json') {
            throw ModuleException::configuration('CI report path must be an absolute .json file path.');
        }

        $browser = self::stringValue($input, 'browser');
        if (!in_array($browser, ['chromium', 'firefox', 'webkit'], true)) {
            throw ModuleException::configuration('Browser must be chromium, firefox, or webkit.');
        }

        $severity = self::stringValue($input, 'severity_threshold');
        if (!in_array($severity, ['minor', 'moderate', 'serious', 'critical'], true)) {
            throw ModuleException::configuration('Severity threshold is invalid.');
        }

        $scanTimeout = self::intValue($input, 'scan_timeout_ms');
        $processTimeout = self::intValue($input, 'process_timeout_seconds');
        if ($scanTimeout < 5000 || $scanTimeout > 120000) {
            throw ModuleException::configuration('Scan timeout must be between 5000 and 120000 milliseconds.');
        }
        if ($processTimeout < 10 || $processTimeout > 180 || ($processTimeout * 1000) < ($scanTimeout + 5000)) {
            throw ModuleException::configuration('Process timeout must exceed the scan timeout by at least five seconds.');
        }

        return [
            'public_url' => $publicUrl,
            'execution_mode' => $mode,
            'cli_binary' => $binary,
            'report_path' => $reportPath,
            'browser' => $browser,
            'severity_threshold' => $severity,
            'scan_timeout_ms' => $scanTimeout,
            'process_timeout_seconds' => $processTimeout,
        ];
    }

    /** @param array<string, string|int> $config */
    public static function save(array $config): void
    {
        foreach (array_keys(self::defaults()) as $key) {
            if (array_key_exists($key, $config)) {
                Option::set(self::MODULE_ID, $key, (string)$config[$key]);
            }
        }
    }

    /** @param array<string, mixed> $input */
    private static function stringValue(array $input, string $key): string
    {
        $value = $input[$key] ?? '';
        return is_string($value) || is_numeric($value) ? trim((string)$value) : '';
    }

    /** @param array<string, mixed> $input */
    private static function intValue(array $input, string $key): int
    {
        $value = $input[$key] ?? null;
        if (filter_var($value, FILTER_VALIDATE_INT) === false) {
            return 0;
        }
        return (int)$value;
    }

    private static function isAbsolutePath(string $path): bool
    {
        return $path !== '' && ($path[0] === '/' || preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1);
    }
}
