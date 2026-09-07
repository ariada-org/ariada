<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

return [
    /*
    |--------------------------------------------------------------------------
    | Ariada CLI binary
    |--------------------------------------------------------------------------
    |
    | Install the shared scanner CLI separately, for example:
    |   pnpm add -g @ariada-org/cli
    | or point this value at a repository build such as:
    |   node /path/to/ariada/packages/ariada-cli/dist/bin.js
    |
    */
    'binary' => env('ARIADA_CLI_BINARY', 'ariada'),

    /*
    |--------------------------------------------------------------------------
    | Default application URL
    |--------------------------------------------------------------------------
    |
    | Used when the Artisan command is called without an explicit URL.
    |
    */
    'base_url' => env('ARIADA_BASE_URL', env('APP_URL', 'http://127.0.0.1:8000')),

    /*
    |--------------------------------------------------------------------------
    | Scan domains
    |--------------------------------------------------------------------------
    |
    | This integration is a thin channel adapter. Domain logic stays in the
    | shared @ariada-org CLI. Narrow this list if a Laravel release gate should
    | start with accessibility only.
    |
    */
    'domains' => array_filter(explode(',', env('ARIADA_DOMAINS', 'accessibility'))),

    /*
    |--------------------------------------------------------------------------
    | Gate threshold
    |--------------------------------------------------------------------------
    |
    | Same values as the CLI: minor, moderate, serious, critical.
    |
    */
    'severity_threshold' => env('ARIADA_SEVERITY_THRESHOLD', 'serious'),

    /*
    |--------------------------------------------------------------------------
    | Process timeout
    |--------------------------------------------------------------------------
    */
    'timeout_seconds' => (int) env('ARIADA_TIMEOUT_SECONDS', 60),
];
