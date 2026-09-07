<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

$bitrix_ariada_default_option = [
    'public_url' => '',
    'execution_mode' => 'report',
    'cli_binary' => '/usr/local/bin/ariada',
    'report_path' => '/var/lib/bitrix-ariada/scan.json',
    'browser' => 'chromium',
    'severity_threshold' => 'moderate',
    'scan_timeout_ms' => '30000',
    'process_timeout_seconds' => '45',
    'last_result' => '',
];
