<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

namespace local_ariada\local;

/**
 * Parses the canonical Ariada MultiDomainReport.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class report_parser {
    /** @var array Severity ordering. */
    private const RANK = ['critical' => 4, 'serious' => 3, 'moderate' => 2, 'minor' => 1];

    /**
     * Parse and normalize a canonical report.
     *
     * @param string $json Ariada JSON.
     * @return report_model Parsed report.
     */
    public function parse(string $json): report_model {
        try {
            $report = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new \InvalidArgumentException('Ariada returned invalid JSON.', 0, $exception);
        }
        if (!is_array($report) || !is_array($report['sites'] ?? null) || !is_array($report['grid'] ?? null)) {
            throw new \InvalidArgumentException('Ariada report is missing sites or grid.');
        }
        $findings = [];
        foreach ($report['grid'] as $site => $domains) {
            if (!is_array($domains)) {
                continue;
            }
            foreach ($domains as $domain => $items) {
                foreach (is_array($items) ? $items : [] as $item) {
                    if (is_array($item)) {
                        $findings[] = $this->finding((string) $site, (string) $domain, $item);
                    }
                }
            }
        }
        usort($findings, static function (array $left, array $right): int {
            $rank = self::RANK[$right['severity']] <=> self::RANK[$left['severity']];
            return $rank !== 0 ? $rank : strcmp($left['ruleid'], $right['ruleid']);
        });
        $counts = array_fill_keys(array_keys(self::RANK), 0);
        foreach ($findings as $finding) {
            $counts[$finding['severity']]++;
        }
        return new report_model(array_values(array_map('strval', $report['sites'])), $findings, $counts);
    }

    /**
     * Normalize one finding from the report grid.
     *
     * @param string $site Site key.
     * @param string $domain Domain key.
     * @param array $item Raw finding.
     * @return array Normalized finding.
     */
    private function finding(string $site, string $domain, array $item): array {
        $severity = strtolower((string) ($item['severity'] ?? 'moderate'));
        $severity = isset(self::RANK[$severity]) ? $severity : 'moderate';
        $element = is_array($item['element'] ?? null) ? $item['element'] : [];
        $en = [];
        foreach ((array) ($item['regulatoryMapping'] ?? []) as $reference) {
            if (is_array($reference) && ($reference['framework'] ?? '') === 'EN 301 549') {
                $en[] = (string) ($reference['code'] ?? '');
            }
        }
        return [
            'site' => $site,
            'domain' => (string) ($item['domain'] ?? $domain),
            'severity' => $severity,
            'ruleid' => (string) ($item['ruleId'] ?? $item['id'] ?? 'unknown'),
            'message' => (string) ($item['message'] ?? ''),
            'selector' => (string) ($element['selector'] ?? ''),
            'criterion' => (string) ($item['criterion'] ?? ''),
            'wcag' => implode(', ', array_map('strval', (array) ($item['wcagMapping'] ?? []))),
            'en301549' => implode(', ', array_filter($en)),
        ];
    }
}
