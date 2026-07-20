<?php
declare(strict_types=1);

namespace Ariada\Commerce\Model;

final class ScanRunner
{
    /** @return list<string> */
    public function storefrontTargets(string $baseUrl): array
    {
        $base = rtrim($baseUrl, '/');
        return [$base . '/', $base . '/gear.html', $base . '/checkout/cart', $base . '/checkout'];
    }

    public function cliCommand(string $url, string $outputDir, string $binary = 'ariada'): string
    {
        $parts = [$binary, 'scan', $url, '--domains', 'accessibility', '--format', 'json', '--output-dir', $outputDir];
        return implode(' ', array_map('escapeshellarg', $parts));
    }

    /** @return array<string, mixed> */
    public function hostedPayload(string $url, string $severity = 'serious'): array
    {
        return ['url' => $url, 'domains' => ['accessibility'], 'severityThreshold' => $severity];
    }

    /** @return array<string, mixed> */
    public function fixtureReport(string $url): array
    {
        return [
            'url' => $url,
            'status' => 'fixture',
            'findings' => [
                ['rule' => 'link-name', 'severity' => 'serious', 'target' => '.product-item a'],
                ['rule' => 'form-field-label', 'severity' => 'critical', 'target' => '#checkout-payment-method-load input'],
            ],
        ];
    }
}
