<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\LaravelAccessibility\Tests\Unit;

use Ariada\LaravelAccessibility\AriadaScanner;
use Ariada\LaravelAccessibility\Contracts\CliRunner;
use PHPUnit\Framework\TestCase;

final class AriadaScannerTest extends TestCase
{
    /**
     * An address that begins with a dash is a flag, not a target.
     *
     * This method is the package's public entry point, so the value arrives from
     * an application — commonly straight from a request. The command is built as
     * an array, so nothing chains; what passes without the check is a value the
     * scanner reads as a flag, leaving the scan with no target at all. A scan
     * that never had a target reports what an empty scan reports, and an empty
     * scan looks exactly like a clean page.
     *
     * Remove the check in `AriadaScanner::scan` and this test fails while the
     * rest of the file passes.
     */
    public function testRefusesAnythingThatIsNotAnHttpUrl(): void
    {
        $runner = new class implements CliRunner {
            /** @var list<string> */
            public array $command = [];

            /**
             * @param list<string> $command
             *
             * @return array{exitCode:int, stdout:string, stderr:string}
             */
            public function run(array $command, int $timeoutSeconds = 60): array
            {
                $this->command = $command;

                return ['exitCode' => 0, 'stdout' => '', 'stderr' => ''];
            }
        };

        $scanner = new AriadaScanner($runner);

        foreach (['--output-dir=/etc', '-v', 'file:///etc/passwd', 'not an address', ''] as $bad) {
            try {
                $scanner->scan($bad);
                self::fail('expected a refusal for: ' . $bad);
            } catch (\RuntimeException $e) {
                self::assertStringContainsString('http(s)', $e->getMessage());
            }
        }

        // And nothing was handed to the scanner on any of those attempts.
        self::assertSame([], $runner->command);
    }

    public function testRunsSharedCliAndParsesScanJson(): void
    {
        $runner = new class implements CliRunner {
            /** @var list<string> */
            public array $command = [];

            /**
             * @param list<string> $command
             *
             * @return array{exitCode:int, stdout:string, stderr:string}
             */
            public function run(array $command, int $timeoutSeconds = 60): array
            {
                $this->command = $command;
                $outputDir = $command[array_search('--output-dir', $command, true) + 1];
                file_put_contents($outputDir.'/scan.json', json_encode([
                    'summary' => ['total' => 1],
                    'report' => ['findings' => [['ruleId' => 'image-alt']]],
                ], JSON_THROW_ON_ERROR));

                return ['exitCode' => 1, 'stdout' => 'Wrote scan.json', 'stderr' => ''];
            }
        };

        $scanner = new AriadaScanner($runner, 'ariada', 5);
        $result = $scanner->scan('https://example.test/dashboard', [
            'domains' => ['accessibility'],
            'severityThreshold' => 'serious',
        ]);

        self::assertSame(1, $result->findingCount());
        self::assertSame('ariada', $runner->command[0]);
        self::assertContains('scan', $runner->command);
        self::assertContains('https://example.test/dashboard', $runner->command);
        self::assertContains('--domains', $runner->command);
        self::assertContains('accessibility', $runner->command);
        self::assertContains('--severity-threshold', $runner->command);
        self::assertContains('serious', $runner->command);
    }

    /**
     * The cleanup removes a symlink; it does not walk through one.
     *
     * The scanner makes a temporary directory, lets the shared command write
     * into it, and deletes it afterwards. The delete recursed on anything
     * `is_dir()` called a directory — and `is_dir()` answers for the target, not
     * the link. A link left in that directory therefore pointed the recursion at
     * whatever it named, and everything found there was deleted.
     *
     * The directory is ours, randomly named and mode 0700, so this is not an
     * easy thing to arrange. It is also one line to make impossible, and a
     * recursive delete is the wrong place to rely on an attack being awkward.
     *
     * Remove the `is_link()` branch in `AriadaScanner::removeDirectory` and this
     * test fails: the sentinel file below is deleted through the link.
     */
    public function testCleanupDoesNotFollowASymlinkOutOfItsOwnDirectory(): void
    {
        $storonnij = sys_get_temp_dir().'/ariada-storonnij-'.bin2hex(random_bytes(6));
        mkdir($storonnij, 0700, true);
        $svidetel = $storonnij.'/ne-udalyat.txt';
        file_put_contents($svidetel, 'this file is outside the scan output directory');

        $runner = new class($storonnij) implements CliRunner {
            public function __construct(private readonly string $storonnij) {}

            /**
             * @param list<string> $command
             *
             * @return array{exitCode:int, stdout:string, stderr:string}
             */
            public function run(array $command, int $timeoutSeconds = 60): array
            {
                $outputDir = $command[array_search('--output-dir', $command, true) + 1];
                symlink($this->storonnij, $outputDir.'/naruzhu');
                file_put_contents($outputDir.'/scan.json', json_encode([
                    'summary' => ['total' => 0],
                    'report' => ['findings' => []],
                ], JSON_THROW_ON_ERROR));

                return ['exitCode' => 0, 'stdout' => '', 'stderr' => ''];
            }
        };

        (new AriadaScanner($runner, 'ariada', 5))->scan('https://example.test/page');

        self::assertFileExists($svidetel, 'the cleanup followed a symlink and deleted outside its own directory');

        unlink($svidetel);
        rmdir($storonnij);
    }
}
