<?php

defined('C5_EXECUTE') or die('Access Denied.');

return [
    'mode' => 'report',
    'site_url' => '',
    'report_filename' => 'scan.json',
    'browser' => 'chromium',
    'severity_threshold' => 'moderate',
    'navigation_timeout_ms' => 30000,

    // Filesystem and process settings are intentionally not editable in the dashboard.
    'report_directory' => DIR_APPLICATION . DIRECTORY_SEPARATOR . 'files' . DIRECTORY_SEPARATOR . 'ariada',
    'allow_private_hosts' => false,
    'cli_command_prefix' => ['npx', '--yes', '@ariada-org/cli@0.1.0'],
    'process_timeout_seconds' => 60,
    'max_process_output_bytes' => 65536,
    'max_report_bytes' => 5242880,
    'top_violations' => 10,
];
