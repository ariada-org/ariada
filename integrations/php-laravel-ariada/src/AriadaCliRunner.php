<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility;

use Ariada\LaravelAccessibility\Contracts\CliRunner;
use RuntimeException;

final class AriadaCliRunner implements CliRunner
{
    /**
     * @param list<string> $command
     *
     * @return array{exitCode:int, stdout:string, stderr:string}
     */
    public function run(array $command, int $timeoutSeconds = 60): array
    {
        if (! function_exists('proc_open')) {
            throw new RuntimeException('proc_open is disabled; Ariada CLI cannot be executed.');
        }

        $descriptorSpec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        // The array form is deliberate and is the whole defence here: given an
        // array, PHP executes the program directly and passes each element as a
        // separate argument, with no shell in between. A scanned address arrives
        // as one of those arguments and cannot become part of a command, however
        // it is spelled. Passing a string instead would hand the same value to a
        // shell, which is the thing this must never do.
        //
        // The scanner is flagged here for executing a command it does not know at
        // compile time, which is true and is what a runner is for. The program
        // itself comes from configuration, so whoever can rewrite the
        // application config can choose the binary — that is the same authority
        // as being able to rewrite the application.
        // nosemgrep: php.lang.security.exec-use.exec-use
        $process = proc_open($command, $descriptorSpec, $pipes);
        if (! is_resource($process)) {
            throw new RuntimeException('Unable to start Ariada CLI process.');
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $startedAt = time();

        while (true) {
            $stdout .= stream_get_contents($pipes[1]) ?: '';
            $stderr .= stream_get_contents($pipes[2]) ?: '';

            $status = proc_get_status($process);
            if (! $status['running']) {
                break;
            }

            if ((time() - $startedAt) > $timeoutSeconds) {
                proc_terminate($process);
                throw new RuntimeException('Ariada CLI timed out after '.$timeoutSeconds.' seconds.');
            }

            usleep(10000);
        }

        $stdout .= stream_get_contents($pipes[1]) ?: '';
        $stderr .= stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);

        $exitCode = proc_close($process);

        return [
            'exitCode' => is_int($exitCode) ? $exitCode : 1,
            'stdout' => $stdout,
            'stderr' => $stderr,
        ];
    }
}
