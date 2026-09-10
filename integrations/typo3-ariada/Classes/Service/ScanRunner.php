<?php

declare(strict_types=1);

namespace Ariada\Typo3Ariada\Service;

final class ScanRunner
{
    /**
     * @return array{mode:string,target:string,exitCode:int,findings:array<int,array<string,mixed>>,raw:string,error:string}
     */
    public function scan(string $target, string $format = 'json'): array
    {
        $target = trim($target);
        // The scheme is required, not just a parseable address. FILTER_VALIDATE_URL
        // alone accepts file:// and ftp:// among others, so a target every other
        // Ariada integration refuses was handed to the scanner here — five of them
        // require http or https explicitly, and this one did not.
        $parts = parse_url($target);
        if (
            $target === ''
            || filter_var($target, FILTER_VALIDATE_URL) === false
            || !is_array($parts)
            || !isset($parts['scheme'], $parts['host'])
            || !in_array($parts['scheme'], ['http', 'https'], true)
        ) {
            return $this->failure('cli', $target, 'Ariada can only scan an http or https URL.');
        }

        $apiUrl = getenv('ARIADA_API_URL') ?: '';
        if ($apiUrl !== '') {
            return $this->scanViaHttp($apiUrl, $target);
        }

        $binary = getenv('ARIADA_CLI') ?: 'ariada';
        // An argument vector, which is what every other integration here hands
        // over, and the whole of the defence. Given an array, proc_open runs the
        // program directly and passes each element as one argument — there is no
        // shell to interpret anything, so an address cannot become part of a
        // command however it is spelled.
        //
        // This one built a string instead and leaned on escaping. The address
        // went through escapeshellarg, which is sound; the program path went
        // through escapeshellcmd, which is the weaker of the two and was applied
        // to a value read from the environment. Escaping correctly is a thing to
        // get right on every line that touches it. Not having a shell is a thing
        // to get right once.
        $command = [$binary, 'scan', $target, '--format=' . $format];
        $descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
        $process = @proc_open($command, $descriptors, $pipes);
        if (!is_resource($process)) {
            return $this->failure('cli', $target, 'Could not start the Ariada process.');
        }
        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exitCode = proc_close($process);
        $output = explode("\n", rtrim($stdout === '' ? $stderr : $stdout, "\n"));

        return $this->normalise('cli', $target, $exitCode, implode("\n", $output));
    }

    /**
     * @return array{mode:string,target:string,exitCode:int,findings:array<int,array<string,mixed>>,raw:string,error:string}
     */
    private function scanViaHttp(string $apiUrl, string $target): array
    {
        if (!function_exists('curl_init')) {
            return $this->failure('http', $target, 'PHP cURL is required for ARIADA_API_URL mode.');
        }

        $handle = curl_init(rtrim($apiUrl, '/') . '/scan');
        $headers = ['Content-Type: application/json'];
        $token = getenv('ARIADA_API_TOKEN') ?: '';
        if ($token !== '') {
            $headers[] = 'Authorization: Bearer ' . $token;
        }

        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode(['url' => $target], JSON_THROW_ON_ERROR),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 90,
        ]);

        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($raw === false || $status >= 400) {
            return $this->failure('http', $target, $error !== '' ? $error : 'HTTP scan request failed.');
        }

        return $this->normalise('http', $target, 0, (string) $raw);
    }

    /**
     * @return array{mode:string,target:string,exitCode:int,findings:array<int,array<string,mixed>>,raw:string,error:string}
     */
    private function normalise(string $mode, string $target, int $exitCode, string $raw): array
    {
        $decoded = json_decode($raw, true);
        $findings = [];
        if (is_array($decoded)) {
            $candidate = $decoded['findings'] ?? $decoded['violations'] ?? $decoded['issues'] ?? [];
            $findings = is_array($candidate) ? array_values($candidate) : [];
        }

        return [
            'mode' => $mode,
            'target' => $target,
            'exitCode' => $exitCode,
            'findings' => $findings,
            'raw' => $raw,
            'error' => $exitCode === 0 ? '' : ($raw !== '' ? $raw : 'Ariada scan failed.'),
        ];
    }

    /**
     * @return array{mode:string,target:string,exitCode:int,findings:array<int,array<string,mixed>>,raw:string,error:string}
     */
    private function failure(string $mode, string $target, string $message): array
    {
        return ['mode' => $mode, 'target' => $target, 'exitCode' => 1, 'findings' => [], 'raw' => '', 'error' => $message];
    }
}
