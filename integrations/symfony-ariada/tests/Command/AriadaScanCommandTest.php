<?php

declare(strict_types=1);

namespace Ariada\Symfony\Tests\Command;

use Ariada\Symfony\Command\AriadaScanCommand;
use Ariada\Symfony\Scanner\AriadaScanner;
use Ariada\Symfony\Scanner\ScanOptions;
use Ariada\Symfony\Scanner\ScanResult;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Tester\CommandTester;

final class AriadaScanCommandTest extends TestCase
{
    public function testItRunsTheConfiguredDefaultUrl(): void
    {
        $scanner = new RecordingScanner(new ScanResult(
            target: 'https://app.test',
            exitCode: 1,
            stdout: 'ariada multi-domain scan',
            stderr: '',
            reportPath: '/tmp/report.json',
            totalFindings: 3,
        ));

        $command = new AriadaScanCommand($scanner, 'https://app.test', domains: ['accessibility']);
        $tester = new CommandTester($command);

        $exitCode = $tester->execute(['--no-fail' => true]);

        self::assertSame(Command::SUCCESS, $exitCode);
        self::assertSame('https://app.test', $scanner->target);
        self::assertInstanceOf(ScanOptions::class, $scanner->options);
        self::assertSame(['accessibility'], $scanner->options->domains);
        self::assertStringContainsString('Ariada Symfony scan', $tester->getDisplay());
        self::assertStringContainsString('Findings', $tester->getDisplay());
    }

    public function testItRequiresAUrlOrDefaultUrl(): void
    {
        $command = new AriadaScanCommand(new RecordingScanner(new ScanResult('', 0, '', '', null, 0)));
        $tester = new CommandTester($command);

        self::assertSame(Command::INVALID, $tester->execute([]));
        self::assertStringContainsString('Provide a URL argument', $tester->getDisplay());
    }
}

final class RecordingScanner implements AriadaScanner
{
    public ?string $target = null;
    public ?ScanOptions $options = null;

    public function __construct(private readonly ScanResult $result)
    {
    }

    public function scan(string $url, ScanOptions $options): ScanResult
    {
        $this->target = $url;
        $this->options = $options;

        return $this->result;
    }
}
