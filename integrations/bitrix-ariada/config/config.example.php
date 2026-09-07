<?php
declare(strict_types=1);

// Example values corresponding to the module administration form.
// This file is documentation only and is never loaded automatically.
return [
    'public_url' => 'https://shop.example.com/',
    'execution_mode' => 'report', // "report" or "cli"
    'cli_binary' => '/usr/local/bin/ariada',
    'report_path' => '/var/lib/bitrix-ariada/scan.json',
    'browser' => 'chromium',
    'severity_threshold' => 'moderate',
    'scan_timeout_ms' => 30000,
    'process_timeout_seconds' => 45,
];
