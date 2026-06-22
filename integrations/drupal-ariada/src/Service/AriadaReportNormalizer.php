<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Service;

use Drupal\Component\Serialization\Json;

/**
 * Normalizes Ariada CLI/API report shapes for Drupal rendering.
 */
final class AriadaReportNormalizer {

  /**
   * Formats a short one-line scan summary.
   */
  public static function formatSummary(array $result): string {
    if (empty($result['ok'])) {
      return 'Scan failed: ' . (string) ($result['error'] ?? 'unknown error');
    }

    $summary = (array) ($result['summary'] ?? []);
    $byImpact = (array) ($summary['byImpact'] ?? []);

    return sprintf(
      '%d findings (%d critical, %d serious, %d moderate, %d minor)',
      (int) ($summary['total'] ?? 0),
      (int) ($byImpact['critical'] ?? 0),
      (int) ($byImpact['serious'] ?? 0),
      (int) ($byImpact['moderate'] ?? 0),
      (int) ($byImpact['minor'] ?? 0),
    );
  }

  /**
   * Normalizes a JSON report string.
   *
   * @return array<string,mixed>
   */
  public function normalizeJson(string $json, string $source, int $exitCode): array {
    return $this->normalize(Json::decode($json), $source, $exitCode);
  }

  /**
   * Normalizes the CLI/API response into a form-friendly result.
   *
   * @return array<string,mixed>
   */
  public function normalize(mixed $report, string $source, int $exitCode): array {
    if (!is_array($report)) {
      return [
        'ok' => FALSE,
        'source' => $source,
        'exit_code' => $exitCode,
        'error' => 'Scan returned invalid JSON.',
      ];
    }

    $findings = $this->flattenFindings($report);
    $summary = (array) ($report['summary'] ?? []);
    $summary['total'] = (int) ($summary['total'] ?? count($findings));
    $summary['byImpact'] = (array) ($summary['byImpact'] ?? $this->countByImpact($findings));

    return [
      'ok' => TRUE,
      'source' => $source,
      'exit_code' => $exitCode,
      'summary' => $summary,
      'findings' => $findings,
      'report' => $report,
    ];
  }

  /**
   * Extracts displayable findings from known Ariada report shapes.
   *
   * @return array<int,array<string,mixed>>
   */
  private function flattenFindings(array $report): array {
    $raw = $report['findings'] ?? ($report['report']['findings'] ?? NULL);
    if (is_array($raw)) {
      return $this->normalizeFindingList($this->flattenList($raw));
    }

    $grid = $report['grid'] ?? ($report['report']['grid'] ?? NULL);
    return is_array($grid) ? $this->normalizeFindingList($this->flattenList($grid)) : [];
  }

  /**
   * Flattens nested associative finding buckets.
   *
   * @return array<int,mixed>
   */
  private function flattenList(array $items): array {
    $out = [];
    foreach ($items as $item) {
      if (is_array($item) && $this->looksLikeFinding($item)) {
        $out[] = $item;
      }
      elseif (is_array($item)) {
        $out = array_merge($out, $this->flattenList($item));
      }
    }
    return $out;
  }

  /**
   * Returns normalized finding rows for render arrays and Drush output.
   *
   * @return array<int,array<string,mixed>>
   */
  private function normalizeFindingList(array $findings): array {
    $rows = [];
    foreach ($findings as $finding) {
      if (!is_array($finding)) {
        continue;
      }
      $target = $finding['selector'] ?? $finding['target'] ?? $finding['element'] ?? '';
      $rows[] = [
        'severity' => (string) ($finding['severity'] ?? $finding['impact'] ?? 'moderate'),
        'rule' => (string) ($finding['ruleId'] ?? $finding['rule_id'] ?? $finding['id'] ?? 'unknown'),
        'message' => (string) ($finding['message'] ?? $finding['description'] ?? $finding['help'] ?? ''),
        'target' => is_array($target) ? implode(', ', array_map('strval', $target)) : (string) $target,
      ];
    }
    return $rows;
  }

  /**
   * Counts findings by normalized impact.
   *
   * @return array<string,int>
   */
  private function countByImpact(array $findings): array {
    $counts = ['critical' => 0, 'serious' => 0, 'moderate' => 0, 'minor' => 0];
    foreach ($findings as $finding) {
      $severity = (string) ($finding['severity'] ?? 'moderate');
      if (isset($counts[$severity])) {
        $counts[$severity]++;
      }
    }
    return $counts;
  }

  /**
   * Detects whether an array resembles a finding.
   */
  private function looksLikeFinding(array $item): bool {
    return isset($item['ruleId'])
      || isset($item['rule_id'])
      || isset($item['severity'])
      || isset($item['impact'])
      || isset($item['message']);
  }

}
