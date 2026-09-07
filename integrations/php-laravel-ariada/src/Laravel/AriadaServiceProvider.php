<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Laravel;

use Ariada\LaravelAccessibility\AriadaCliRunner;
use Ariada\LaravelAccessibility\AriadaScanner;
use Ariada\LaravelAccessibility\Contracts\CliRunner;
use Illuminate\Support\ServiceProvider;

final class AriadaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../../config/ariada.php', 'ariada');

        $this->app->singleton(CliRunner::class, AriadaCliRunner::class);
        $this->app->singleton(AriadaScanner::class, function ($app): AriadaScanner {
            return new AriadaScanner(
                runner: $app->make(CliRunner::class),
                binary: (string) config('ariada.binary', 'ariada'),
                timeoutSeconds: (int) config('ariada.timeout_seconds', 60),
            );
        });
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../../config/ariada.php' => config_path('ariada.php'),
        ], 'ariada-config');

        if ($this->app->runningInConsole()) {
            $this->commands([
                ScanCommand::class,
            ]);
        }
    }
}
