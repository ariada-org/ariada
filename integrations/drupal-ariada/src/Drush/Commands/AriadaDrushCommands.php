<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Drush\Commands;

use Drupal\ariada_drupal\Service\AriadaScanner;
use Drupal\Core\State\StateInterface;
use Drush\Attributes as CLI;
use Drush\Boot\DrupalBootLevels;
use Drush\Commands\AutowireTrait;
use Drush\Commands\DrushCommands;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Drush commands for Ariada scans.
 */
final class AriadaDrushCommands extends DrushCommands {

  use AutowireTrait;

  /**
   * Severity ordering used for CI threshold exit codes.
   */
  private const SEVERITY_ORDER = [
    'minor' => 0,
    'moderate' => 1,
    'serious' => 2,
    'critical' => 3,
  ];

  public function __construct(
    #[Autowire('ariada_drupal.scanner')]
    private readonly AriadaScanner $scanner,
    #[Autowire('state')]
    private readonly StateInterface $state,
  ) {
    parent::__construct();
  }

  /**
   * Runs an Ariada accessibility scan for a URL.
   */
  #[CLI\Command(name: 'ariada:scan', aliases: ['ariada-scan'])]
  #[CLI\Bootstrap(level: DrupalBootLevels::FULL)]
  #[CLI\Argument(name: 'url', description: 'The http(s) URL to scan.')]
  #[CLI\Option(name: 'severity-threshold', description: 'Minimum severity that returns exit code 1.', suggestedValues: ['minor', 'moderate', 'serious', 'critical'])]
  #[CLI\Option(name: 'format', description: 'Output format.', suggestedValues: ['summary', 'json'])]
  #[CLI\Usage(name: 'drush ariada:scan https://example.com', description: 'Scan a URL with the configured Ariada boundary.')]
  #[CLI\Usage(name: 'drush ariada:scan https://example.com --severity-threshold=critical --format=json', description: 'Emit JSON and fail only on critical findings.')]
  public function scan(string $url, array $options = [
    'severity-threshold' => 'serious',
    'format' => 'summary',
  ]): int {
    $threshold = (string) ($options['severity-threshold'] ?? 'serious');
    $format = (string) ($options['format'] ?? 'summary');

    if (!isset(self::SEVERITY_ORDER[$threshold])) {
      $this->logger()->error('Invalid severity threshold: {threshold}', [
        'threshold' => $threshold,
      ]);
      return 2;
    }

    if (!in_array($format, ['summary', 'json'], TRUE)) {
      $this->logger()->error('Invalid output format: {format}', [
        'format' => $format,
      ]);
      return 2;
    }

    $config = $this->scanner->settings();
    $config['severity_threshold'] = $threshold;

    $result = $this->scanner->scan($url, $config);
    $summary = $this->scanner->formatSummary($result);
    $this->state->set('ariada_drupal.last_scan_result', $result);
    $this->state->set('ariada_drupal.last_scan_summary', $summary);

    if ($format === 'json') {
      $this->output()->writeln(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?: '{}');
    }
    else {
      $this->io()->writeln(sprintf('Ariada scan: %s', $url));
      $this->io()->writeln($summary);
      $this->renderFindingTable((array) ($result['findings'] ?? []));
    }

    if (empty($result['ok'])) {
      return 3;
    }

    return $this->countAtOrAboveThreshold((array) ($result['findings'] ?? []), $threshold) > 0 ? 1 : 0;
  }

  /**
   * Prints a compact finding table for summary output.
   */
  private function renderFindingTable(array $findings): void {
    $rows = [];
    foreach (array_slice($findings, 0, 25) as $finding) {
      $finding = (array) $finding;
      $rows[] = [
        (string) ($finding['severity'] ?? ''),
        (string) ($finding['rule'] ?? ''),
        (string) ($finding['message'] ?? ''),
        (string) ($finding['target'] ?? ''),
      ];
    }

    if ($rows === []) {
      $this->io()->writeln('No findings returned.');
      return;
    }

    $this->io()->table(['Severity', 'Rule', 'Finding', 'Target'], $rows);
  }

  /**
   * Counts findings whose severity breaches the selected threshold.
   */
  private function countAtOrAboveThreshold(array $findings, string $threshold): int {
    $minimum = self::SEVERITY_ORDER[$threshold] ?? self::SEVERITY_ORDER['serious'];
    $count = 0;

    foreach ($findings as $finding) {
      $finding = (array) $finding;
      $severity = (string) ($finding['severity'] ?? 'moderate');
      if ((self::SEVERITY_ORDER[$severity] ?? self::SEVERITY_ORDER['moderate']) >= $minimum) {
        $count++;
      }
    }

    return $count;
  }

}
