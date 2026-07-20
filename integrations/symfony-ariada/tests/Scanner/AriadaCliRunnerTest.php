<?php

declare(strict_types=1);

namespace Ariada\Symfony\Tests\Scanner;

use Ariada\Symfony\Scanner\AriadaCliRunner;
use Ariada\Symfony\Scanner\ProcessResult;
use Ariada\Symfony\Scanner\ScanOptions;
use PHPUnit\Framework\TestCase;

final class AriadaCliRunnerTest extends TestCase
{
    public function testItBuildsAriadaScanArgumentsAndCountsFindings(): void
    {
        $tmp = sys_get_temp_dir() . '/ariada-symfony-' . bin2hex(random_bytes(4));
        mkdir($tmp, 0775, true);
        file_put_contents($tmp . '/multi-domain-report.json', json_encode([
            'grid' => [
                'https://example.test' => [
                    'accessibility' => [['ruleId' => 'button-name']],
                    'privacy' => [],
                    'security' => [['ruleId' => 'mixed-content']],
                ],
            ],
        ], JSON_PRETTY_PRINT));

        $captured = null;
        $runner = new AriadaCliRunner(static function (array $command) use (&$captured): ProcessResult {
            $captured = $command;

            return new ProcessResult(1, 'Wrote report', '');
        });

        $result = $runner->scan('https://example.test', new ScanOptions(
            outputDir: $tmp,
            cliCommand: 'node ../../packages/ariada-cli/dist/bin.js',
            domains: ['accessibility', 'privacy'],
        ));

        self::assertSame(1, $result->exitCode);
        self::assertTrue($result->gateFailed());
        self::assertSame(2, $result->totalFindings);
        self::assertSame([
            'node',
            '../../packages/ariada-cli/dist/bin.js',
            'scan',
            'https://example.test',
            '--format',
            'json',
            '--output-dir',
            $tmp,
            '--browser',
            'chromium',
            '--severity-threshold',
            'moderate',
            '--timeout-ms',
            '30000',
            '--domains',
            'accessibility,privacy',
        ], $captured);
    }
}
