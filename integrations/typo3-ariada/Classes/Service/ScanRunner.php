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
        if ($target === '' || filter_var($target, FILTER_VALIDATE_URL) === false) {
            return $this->failure('cli', $target, 'Enter a valid absolute URL.');
        }

        $apiUrl = getenv('ARIADA_API_URL') ?: '';
        if ($apiUrl !== '') {
            return $this->scanViaHttp($apiUrl, $target);
        }

        $binary = getenv('ARIADA_CLI') ?: 'ariada';
        $command = sprintf('%s scan %s --format=%s', escapeshellcmd($binary), escapeshellarg($target), escapeshellarg($format));
        $output = [];
        $exitCode = 1;
        exec($command . ' 2>&1', $output, $exitCode);

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
