<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Contracts;

interface CliRunner
{
 /**
 * @param list<string> $command
 *
 * @return array{exitCode:int, stdout:string, stderr:string}
 */
 public function run(array $command, int $timeoutSeconds = 60): array;
}
