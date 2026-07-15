<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Service;

use Drupal\Core\Config\ConfigFactoryInterface;

/**
 * Chooses the configured Ariada scan boundary.
 */
final class AriadaScanner {

  public function __construct(
    private readonly ConfigFactoryInterface $configFactory,
    private readonly LocalAriadaRunner $localRunner,
    private readonly HostedAriadaRunner $hostedRunner,
  ) {
  }

  /**
   * Runs a scan for the supplied URL.
   *
   * @return array<string,mixed>
   */
  public function scan(string $url, ?array $overrideConfig = NULL): array {
    $url = trim($url);
    if (!$this->isValidHttpUrl($url)) {
      return [
        'ok' => FALSE,
        'source' => 'validation',
        'error' => 'Enter a valid http(s) URL.',
      ];
    }

    $config = $overrideConfig ?? $this->settings();
    $mode = (string) ($config['execution_mode'] ?? 'auto');

    if ($mode === 'hosted') {
      return $this->hostedRunner->scan($url, $config);
    }

    if ($mode === 'local') {
      return $this->localRunner->scan($url, $config);
    }

    if ($this->localRunner->canRun((string) ($config['ariada_binary'] ?? 'ariada'))) {
      return $this->localRunner->scan($url, $config);
    }

    return $this->hostedRunner->scan($url, $config);
  }

  /**
   * Returns a status summary for Drupal's status report.
   *
   * @return array{available: bool, message: string}
   */
  public function status(): array {
    $config = $this->settings();
    $mode = (string) ($config['execution_mode'] ?? 'auto');
    $binary = (string) ($config['ariada_binary'] ?? 'ariada');
    $local = $this->localRunner->canRun($binary);
    $hosted = $this->hostedRunner->hasConfig($config);

    if ($mode === 'hosted') {
      return [
        'available' => $hosted,
        'message' => $hosted
          ? 'Hosted scan endpoint is configured.'
          : 'Hosted mode requires an endpoint and API key.',
      ];
    }

    if ($mode === 'local') {
      return [
        'available' => $local,
        'message' => $local
          ? 'Local Ariada CLI is callable.'
          : 'Local mode requires proc_open and the Ariada CLI binary.',
      ];
    }

    return [
      'available' => $local || $hosted,
      'message' => $local
        ? 'Auto mode will use the local Ariada CLI.'
        : ($hosted
          ? 'Auto mode will use the hosted scan endpoint.'
          : 'Auto mode needs either a local Ariada CLI or hosted endpoint settings.'),
    ];
  }

  /**
   * Returns module settings as a plain array.
   *
   * @return array<string,mixed>
   */
  public function settings(): array {
    return $this->configFactory->get('ariada_drupal.settings')->getRawData();
  }

  /**
   * Formats a short one-line scan summary.
   */
  public function formatSummary(array $result): string {
    return AriadaReportNormalizer::formatSummary($result);
  }

  /**
   * Validates URL input.
   */
  private function isValidHttpUrl(string $url): bool {
    $parts = parse_url($url);
    return is_array($parts)
      && isset($parts['scheme'], $parts['host'])
      && in_array($parts['scheme'], ['http', 'https'], TRUE);
  }

}
