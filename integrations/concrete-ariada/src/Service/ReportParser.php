<?php

namespace ConcreteAriada\Service;

defined('C5_EXECUTE') or die('Access Denied.');

use ConcreteAriada\Model\AuditReport;
use ConcreteAriada\Model\Violation;
use DateTimeImmutable;
use JsonException;
use Throwable;

final class ReportParser
{
    public const SCHEMA = 'https://ariada.org/schemas/cli-scan.v1.json';
    private const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

    public function parse(string $json): AuditReport
    {
        try {
            $data = json_decode($json, true, 64, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw new AriadaException('The Ariada report is not valid JSON.', 0, $exception);
        }

        if (!is_array($data) || ($data !== [] && array_is_list($data))) {
            throw new AriadaException('The Ariada report root must be an object.');
        }

        $schema = $this->requiredString($data, '$schema', 200);
        if ($schema !== self::SCHEMA) {
            throw new AriadaException('The Ariada report schema is unsupported.');
        }

        $url = $this->requiredString($data, 'url', 2048);
        $this->validateHttpUrl($url);
        $scanId = $this->optionalString($data, 'scanId', 200);
        $startedAt = $this->requiredString($data, 'startedAt', 64);
        $completedAt = $this->requiredString($data, 'completedAt', 64);
        $this->validateTimestamp($startedAt, 'startedAt');
        $this->validateTimestamp($completedAt, 'completedAt');
        $durationMs = $this->requiredInteger($data, 'durationMs', 0, 86400000);
        $exitCode = $this->requiredInteger($data, 'exitCode', 0, 1);

        $summary = $this->requiredObject($data, 'summary');
        $total = $this->requiredInteger($summary, 'total', 0, 1000000);
        $declaredByImpact = $this->parseImpactCounts($this->requiredObject($summary, 'byImpact'));

        $report = $this->requiredObject($data, 'report');
        $reportUrl = $this->optionalString($report, 'url', 2048);
        if ($reportUrl !== '' && $reportUrl !== $url) {
            throw new AriadaException('The Ariada report contains conflicting target URLs.');
        }
        $reportScanId = $this->optionalString($report, 'scanId', 200);
        if ($scanId !== '' && $reportScanId !== '' && $scanId !== $reportScanId) {
            throw new AriadaException('The Ariada report contains conflicting scan identifiers.');
        }
        if ($scanId === '') {
            $scanId = $reportScanId;
        }

        [$violations, $actualByImpact, $actualTotal] = $this->parseFindings($report['findings'] ?? []);
        if ($actualTotal !== $total || $actualByImpact !== $declaredByImpact) {
            throw new AriadaException('The Ariada report summary does not match its findings.');
        }

        usort($violations, static function (Violation $left, Violation $right): int {
            $severity = $right->severityRank() <=> $left->severityRank();
            if ($severity !== 0) {
                return $severity;
            }
            $count = $right->count() <=> $left->count();
            if ($count !== 0) {
                return $count;
            }
            $rule = strcmp($left->ruleId(), $right->ruleId());
            return $rule !== 0 ? $rule : strcmp($left->message(), $right->message());
        });

        return new AuditReport(
            $url,
            $scanId,
            $startedAt,
            $completedAt,
            $durationMs,
            $total,
            $declaredByImpact,
            $violations,
            $exitCode
        );
    }

    /**
     * @param mixed $findings
     * @return array{0: list<Violation>, 1: array{critical: int, serious: int, moderate: int, minor: int}, 2: int}
     */
    private function parseFindings($findings): array
    {
        if (!is_array($findings)) {
            throw new AriadaException('The Ariada report findings must be an array or object.');
        }

        $groups = [];
        if ($findings === [] || array_is_list($findings)) {
            $groups[] = $findings;
        } else {
            foreach ($findings as $group) {
                if (!is_array($group) || ($group !== [] && !array_is_list($group))) {
                    throw new AriadaException('An Ariada findings group is invalid.');
                }
                $groups[] = $group;
            }
        }

        $counts = ['critical' => 0, 'serious' => 0, 'moderate' => 0, 'minor' => 0];
        /** @var array<string, array{ruleId: string, severity: string, message: string, count: int}> $aggregated */
        $aggregated = [];
        $total = 0;

        foreach ($groups as $group) {
            foreach ($group as $finding) {
                if (!is_array($finding) || $finding === [] || array_is_list($finding)) {
                    throw new AriadaException('An Ariada finding must be an object.');
                }
                $ruleId = $this->optionalString($finding, 'ruleId', 200);
                $severity = $this->optionalString($finding, 'severity', 20);
                $message = $this->optionalString($finding, 'message', 5000);
                $ruleId = $ruleId === '' ? 'unknown' : $ruleId;
                $severity = $severity === '' ? 'moderate' : $severity;
                if (!in_array($severity, self::IMPACTS, true)) {
                    throw new AriadaException('An Ariada finding has an invalid severity.');
                }

                ++$counts[$severity];
                ++$total;
                $key = $severity . "\0" . $ruleId . "\0" . $message;
                if (!isset($aggregated[$key])) {
                    $aggregated[$key] = [
                        'ruleId' => $ruleId,
                        'severity' => $severity,
                        'message' => $message,
                        'count' => 0,
                    ];
                }
                ++$aggregated[$key]['count'];
            }
        }

        $violations = [];
        foreach ($aggregated as $item) {
            $violations[] = new Violation($item['ruleId'], $item['severity'], $item['message'], $item['count']);
        }

        return [$violations, $counts, $total];
    }

    /**
     * @param array<string, mixed> $counts
     * @return array{critical: int, serious: int, moderate: int, minor: int}
     */
    private function parseImpactCounts(array $counts): array
    {
        foreach (array_keys($counts) as $key) {
            if (!in_array($key, self::IMPACTS, true)) {
                throw new AriadaException('The Ariada impact summary contains an unknown key.');
            }
        }

        return [
            'critical' => $this->requiredInteger($counts, 'critical', 0, 1000000),
            'serious' => $this->requiredInteger($counts, 'serious', 0, 1000000),
            'moderate' => $this->requiredInteger($counts, 'moderate', 0, 1000000),
            'minor' => $this->requiredInteger($counts, 'minor', 0, 1000000),
        ];
    }

    /** @param array<string, mixed> $object */
    private function requiredString(array $object, string $key, int $maximumLength): string
    {
        if (!array_key_exists($key, $object) || !is_string($object[$key])) {
            throw new AriadaException(sprintf('The Ariada report field "%s" must be a string.', $key));
        }
        if ($object[$key] === '' || strlen($object[$key]) > $maximumLength) {
            throw new AriadaException(sprintf('The Ariada report field "%s" is invalid.', $key));
        }

        return $object[$key];
    }

    /** @param array<string, mixed> $object */
    private function optionalString(array $object, string $key, int $maximumLength): string
    {
        if (!array_key_exists($key, $object)) {
            return '';
        }
        if (!is_string($object[$key]) || strlen($object[$key]) > $maximumLength) {
            throw new AriadaException(sprintf('The Ariada report field "%s" must be a bounded string.', $key));
        }

        return $object[$key];
    }

    /** @param array<string, mixed> $object */
    private function requiredInteger(array $object, string $key, int $minimum, int $maximum): int
    {
        if (!array_key_exists($key, $object) || !is_int($object[$key])) {
            throw new AriadaException(sprintf('The Ariada report field "%s" must be an integer.', $key));
        }
        if ($object[$key] < $minimum || $object[$key] > $maximum) {
            throw new AriadaException(sprintf('The Ariada report field "%s" is out of range.', $key));
        }

        return $object[$key];
    }

    /**
     * @param array<string, mixed> $object
     * @return array<string, mixed>
     */
    private function requiredObject(array $object, string $key): array
    {
        if (!array_key_exists($key, $object) || !is_array($object[$key])) {
            throw new AriadaException(sprintf('The Ariada report field "%s" must be an object.', $key));
        }
        if ($object[$key] !== [] && array_is_list($object[$key])) {
            throw new AriadaException(sprintf('The Ariada report field "%s" must be an object.', $key));
        }

        return $object[$key];
    }

    private function validateHttpUrl(string $url): void
    {
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        $host = (string) parse_url($url, PHP_URL_HOST);
        if (filter_var($url, FILTER_VALIDATE_URL) === false || !in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new AriadaException('The Ariada report target URL is invalid.');
        }
    }

    private function validateTimestamp(string $value, string $field): void
    {
        if (
            preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $value) !== 1
        ) {
            throw new AriadaException(sprintf('The Ariada report field "%s" is not an ISO-8601 timestamp.', $field));
        }
        try {
            new DateTimeImmutable($value);
        } catch (Throwable $exception) {
            throw new AriadaException(sprintf('The Ariada report field "%s" is invalid.', $field), 0, $exception);
        }
    }
}
