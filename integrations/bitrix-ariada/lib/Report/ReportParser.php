<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Report;

use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Security\PublicUrlValidator;

final class ReportParser
{
    private const SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';
    private const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
    private const RANK = ['critical' => 4, 'serious' => 3, 'moderate' => 2, 'minor' => 1];
    private const MAX_FINDINGS = 10000;

    private PublicUrlValidator $urlValidator;

    public function __construct(?PublicUrlValidator $urlValidator = null)
    {
        $this->urlValidator = $urlValidator ?? new PublicUrlValidator();
    }

    public function parse(string $json, ?string $expectedUrl = null): ScanViewModel
    {
        if (strlen($json) < 2 || strlen($json) > ReportReader::MAX_BYTES) {
            throw ModuleException::report();
        }

        try {
            $document = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw ModuleException::report();
        }
        if (!is_array($document) || ($document['$schema'] ?? null) !== self::SCHEMA) {
            throw ModuleException::report();
        }

        try {
            if (!is_string($document['url'] ?? null)) {
                throw ModuleException::report();
            }
            $url = $this->urlValidator->validate($document['url'], false);
            if ($expectedUrl !== null && $url !== $this->urlValidator->validate($expectedUrl, false)) {
                throw ModuleException::report('The report URL does not match the configured public URL.');
            }

            $startedAt = $this->timestamp($document['startedAt'] ?? null);
            $completedAt = $this->timestamp($document['completedAt'] ?? null);
            if ($completedAt < $startedAt || !is_int($document['durationMs'] ?? null)
                || $document['durationMs'] < 0 || $document['durationMs'] > 86400000) {
                throw ModuleException::report();
            }

            $summary = $document['summary'] ?? null;
            if (!is_array($summary) || !is_int($summary['total'] ?? null) || $summary['total'] < 0
                || $summary['total'] > self::MAX_FINDINGS || !is_array($summary['byImpact'] ?? null)) {
                throw ModuleException::report();
            }
            $declaredCounts = $this->counts($summary['byImpact']);

            $report = $document['report'] ?? null;
            if (!is_array($report)) {
                throw ModuleException::report();
            }
            if (isset($report['url'])) {
                if (!is_string($report['url']) || $this->urlValidator->validate($report['url'], false) !== $url) {
                    throw ModuleException::report();
                }
            }

            $findings = $this->flattenFindings($report['findings'] ?? []);
            if (count($findings) !== $summary['total']) {
                throw ModuleException::report();
            }

            $computedCounts = array_fill_keys(self::IMPACTS, 0);
            $groups = [];
            foreach ($findings as $finding) {
                if (!is_array($finding)
                    || !is_string($finding['ruleId'] ?? null)
                    || preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/', $finding['ruleId']) !== 1
                    || !is_string($finding['severity'] ?? null)
                    || !in_array($finding['severity'], self::IMPACTS, true)) {
                    throw ModuleException::report();
                }
                if (isset($finding['message']) && !is_string($finding['message'])) {
                    throw ModuleException::report();
                }
                $severity = $finding['severity'];
                $ruleId = $finding['ruleId'];
                $computedCounts[$severity]++;
                $key = $severity . "\x1F" . $ruleId;
                if (!isset($groups[$key])) {
                    $groups[$key] = ['ruleId' => $ruleId, 'severity' => $severity, 'count' => 0];
                }
                $groups[$key]['count']++;
            }
            if ($computedCounts !== $declaredCounts) {
                throw ModuleException::report();
            }

            $exitCode = $document['exitCode'] ?? null;
            if (!is_int($exitCode) || !in_array($exitCode, [0, 1], true)) {
                throw ModuleException::report();
            }

            $top = array_values($groups);
            usort($top, static function (array $left, array $right): int {
                $severityOrder = self::RANK[$right['severity']] <=> self::RANK[$left['severity']];
                if ($severityOrder !== 0) {
                    return $severityOrder;
                }
                $countOrder = $right['count'] <=> $left['count'];
                return $countOrder !== 0 ? $countOrder : strcmp($left['ruleId'], $right['ruleId']);
            });

            return new ScanViewModel(
                $exitCode === 0,
                $url,
                $summary['total'],
                $computedCounts,
                array_slice($top, 0, 10),
                $document['startedAt'],
                $document['durationMs']
            );
        } catch (ModuleException $exception) {
            throw $exception;
        } catch (\Throwable $exception) {
            throw ModuleException::report();
        }
    }

    /** @param mixed $value */
    private function timestamp($value): \DateTimeImmutable
    {
        if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/', $value) !== 1) {
            throw ModuleException::report();
        }
        try {
            return new \DateTimeImmutable($value);
        } catch (\Exception $exception) {
            throw ModuleException::report();
        }
    }

    /**
     * @param array<string, mixed> $input
     * @return array<string, int>
     */
    private function counts(array $input): array
    {
        if (count($input) !== 4) {
            throw ModuleException::report();
        }
        $output = [];
        foreach (self::IMPACTS as $impact) {
            if (!array_key_exists($impact, $input) || !is_int($input[$impact]) || $input[$impact] < 0) {
                throw ModuleException::report();
            }
            $output[$impact] = $input[$impact];
        }
        return $output;
    }

    /**
     * @param mixed $value
     * @return array<int, mixed>
     */
    private function flattenFindings($value): array
    {
        if (!is_array($value)) {
            throw ModuleException::report();
        }
        if ($value === [] || $this->isList($value)) {
            return $value;
        }

        $output = [];
        foreach ($value as $category) {
            if (!is_array($category) || !$this->isList($category)) {
                throw ModuleException::report();
            }
            foreach ($category as $finding) {
                $output[] = $finding;
                if (count($output) > self::MAX_FINDINGS) {
                    throw ModuleException::report();
                }
            }
        }
        return $output;
    }

    private function isList(array $value): bool
    {
        $expected = 0;
        foreach ($value as $key => $_item) {
            if ($key !== $expected) {
                return false;
            }
            $expected++;
        }
        return true;
    }
}
