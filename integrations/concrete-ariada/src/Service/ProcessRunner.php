<?php

namespace ConcreteAriada\Service;

defined('C5_EXECUTE') or die('Access Denied.');

use RuntimeException;
use Throwable;

final class ProcessRunner
{
    /**
     * proc_open receives an argument list, not a command string. PHP therefore
     * starts the executable directly and does not ask a shell to parse input.
     *
     * @param list<string> $command
     */
    public function run(
        array $command,
        int $timeoutSeconds,
        int $maxOutputBytes,
        ?string $workingDirectory = null
    ): ProcessResult {
        $this->validateCommand($command);
        if (!function_exists('proc_open')) {
            throw new RuntimeException('The PHP process API is unavailable.');
        }
        if ($timeoutSeconds < 1 || $maxOutputBytes < 1) {
            throw new RuntimeException('Process limits are invalid.');
        }
        if ($workingDirectory !== null && !is_dir($workingDirectory)) {
            throw new RuntimeException('Process working directory is unavailable.');
        }

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $pipes = [];
        $process = @proc_open(
            $command,
            $descriptors,
            $pipes,
            $workingDirectory,
            null,
            ['bypass_shell' => true, 'suppress_errors' => true]
        );
        if (!is_resource($process)) {
            throw new RuntimeException('The Ariada process could not be started.');
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $exitCode = -1;
        $started = microtime(true);

        try {
            while (true) {
                $stdout .= $this->readAvailable($pipes[1]);
                $stderr .= $this->readAvailable($pipes[2]);
                if (strlen($stdout) + strlen($stderr) > $maxOutputBytes) {
                    throw new RuntimeException('The Ariada process exceeded its output limit.');
                }

                $status = proc_get_status($process);
                if (!is_array($status)) {
                    throw new RuntimeException('The Ariada process status is unavailable.');
                }
                if (!$status['running']) {
                    $exitCode = (int) $status['exitcode'];
                    break;
                }
                if ((microtime(true) - $started) >= $timeoutSeconds) {
                    throw new RuntimeException('The Ariada process timed out.');
                }

                usleep(10000);
            }

            $stdout .= $this->readAvailable($pipes[1]);
            $stderr .= $this->readAvailable($pipes[2]);
            if (strlen($stdout) + strlen($stderr) > $maxOutputBytes) {
                throw new RuntimeException('The Ariada process exceeded its output limit.');
            }

            fclose($pipes[1]);
            fclose($pipes[2]);
            $closedExitCode = proc_close($process);
            if ($exitCode < 0) {
                $exitCode = $closedExitCode;
            }
            if ($exitCode < 0) {
                throw new RuntimeException('The Ariada process exit status is unavailable.');
            }

            return new ProcessResult($exitCode, $stdout, $stderr);
        } catch (Throwable $exception) {
            $status = proc_get_status($process);
            if (is_array($status) && $status['running']) {
                @proc_terminate($process);
                usleep(50000);
                $status = proc_get_status($process);
                if (is_array($status) && $status['running']) {
                    @proc_terminate($process, 9);
                }
            }
            foreach ([1, 2] as $pipeIndex) {
                if (isset($pipes[$pipeIndex]) && is_resource($pipes[$pipeIndex])) {
                    fclose($pipes[$pipeIndex]);
                }
            }
            @proc_close($process);

            throw $exception;
        }
    }

    /** @param resource $pipe */
    private function readAvailable($pipe): string
    {
        $contents = stream_get_contents($pipe);
        return is_string($contents) ? $contents : '';
    }

    /** @param list<string> $command */
    private function validateCommand(array $command): void
    {
        if ($command === [] || !array_is_list($command)) {
            throw new RuntimeException('Process command is invalid.');
        }
        foreach ($command as $argument) {
            if (!is_string($argument) || $argument === '' || strpos($argument, "\0") !== false) {
                throw new RuntimeException('Process command is invalid.');
            }
        }
    }
}
