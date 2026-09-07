<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Report;

final class ScanViewModel
{
    private const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];

    private bool $passed;
    private string $url;
    private int $total;
    /** @var array<string, int> */
    private array $byImpact;
    /** @var array<int, array{ruleId:string,severity:string,count:int}> */
    private array $topViolations;
    private string $startedAt;
    private int $durationMs;

    /**
     * @param array<string, int> $byImpact
     * @param array<int, array{ruleId:string,severity:string,count:int}> $topViolations
     */
    public function __construct(
        bool $passed,
        string $url,
        int $total,
        array $byImpact,
        array $topViolations,
        string $startedAt,
        int $durationMs
    ) {
        if ($url === '' || $total < 0 || $durationMs < 0 || count($byImpact) !== 4) {
            throw new \InvalidArgumentException('Invalid scan view model.');
        }
        $sum = 0;
        foreach (self::IMPACTS as $impact) {
            if (!array_key_exists($impact, $byImpact) || !is_int($byImpact[$impact]) || $byImpact[$impact] < 0) {
                throw new \InvalidArgumentException('Invalid scan view model counts.');
            }
            $sum += $byImpact[$impact];
        }
        if ($sum !== $total || count($topViolations) > 10 || preg_match('/^\d{4}-\d{2}-\d{2}T/', $startedAt) !== 1) {
            throw new \InvalidArgumentException('Invalid scan view model summary.');
        }
        foreach ($topViolations as $violation) {
            if (!isset($violation['ruleId'], $violation['severity'], $violation['count'])
                || preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/', $violation['ruleId']) !== 1
                || !in_array($violation['severity'], self::IMPACTS, true)
                || !is_int($violation['count'])
                || $violation['count'] < 1) {
                throw new \InvalidArgumentException('Invalid top violation.');
            }
        }

        $this->passed = $passed;
        $this->url = $url;
        $this->total = $total;
        $this->byImpact = $byImpact;
        $this->topViolations = $topViolations;
        $this->startedAt = $startedAt;
        $this->durationMs = $durationMs;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'schemaVersion' => 1,
            'status' => $this->passed ? 'pass' : 'fail',
            'passed' => $this->passed,
            'url' => $this->url,
            'total' => $this->total,
            'byImpact' => $this->byImpact,
            'topViolations' => $this->topViolations,
            'startedAt' => $this->startedAt,
            'durationMs' => $this->durationMs,
        ];
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        if (($data['schemaVersion'] ?? null) !== 1
            || !is_bool($data['passed'] ?? null)
            || !is_string($data['status'] ?? null)
            || $data['status'] !== (($data['passed'] ?? false) ? 'pass' : 'fail')
            || !is_string($data['url'] ?? null)
            || !is_int($data['total'] ?? null)
            || !is_array($data['byImpact'] ?? null)
            || !is_array($data['topViolations'] ?? null)
            || !is_string($data['startedAt'] ?? null)
            || !is_int($data['durationMs'] ?? null)) {
            throw new \InvalidArgumentException('Invalid stored scan view model.');
        }

        return new self(
            $data['passed'],
            $data['url'],
            $data['total'],
            $data['byImpact'],
            $data['topViolations'],
            $data['startedAt'],
            $data['durationMs']
        );
    }
}
