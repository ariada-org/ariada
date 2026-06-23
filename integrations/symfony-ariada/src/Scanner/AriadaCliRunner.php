<?php

declare(strict_types=1);

namespace Ariada\Symfony\Scanner;

use Symfony\Component\Process\Process;

final class AriadaCliRunner implements AriadaScanner
{
 /**
 * @param null|callable(list<string>): ProcessResult $processRunner
 */
 public function __construct(
 private mixed $processRunner = null,
) {
 }

 public function scan(string $url, ScanOptions $options): ScanResult
 {
 if (!is_dir($options->outputDir)) {
 mkdir($options->outputDir, 0775, true);
 }

 $command = [
...$this->splitCommand($options->cliCommand),
 'scan',
 $url,
 '--format',
 $options->format,
 '--output-dir',
 $options->outputDir,
 '--browser',
 $options->browser,
 '--severity-threshold',
 $options->severityThreshold,
 '--timeout-ms',
 (string) $options->timeoutMs,
 ];

 if ($options->domains !== []) {
 $command[] = '--domains';
 $command[] = implode(',', $options->domains);
 }

 $completed = $this->runProcess($command);
 [$reportPath, $totalFindings] = $this->readReportSummary($options->outputDir);

 return new ScanResult(
 target: $url,
 exitCode: $completed->exitCode,
 stdout: $completed->stdout,
 stderr: $completed->stderr,
 reportPath: $reportPath,
 totalFindings: $totalFindings,
);
 }

 /**
 * @param list<string> $command
 */
 private function runProcess(array $command): ProcessResult
 {
 if ($this->processRunner !== null) {
 return ($this->processRunner)($command);
 }

 $process = new Process($command);
 $process->run();

 return new ProcessResult(
 exitCode: $process->getExitCode() ?? 3,
 stdout: $process->getOutput(),
 stderr: $process->getErrorOutput(),
);
 }

 /**
 * @return list<string>
 */
 private function splitCommand(string $command): array
 {
 $parts = preg_split('/\s+/', trim($command));

 return array_values(array_filter($parts ?: ['ariada'], static fn (string $part): bool => $part !== ''));
 }

 /**
 * @return array{0: null|string, 1: int}
 */
 private function readReportSummary(string $outputDir): array
 {
 foreach (['multi-domain-report.json', 'scan.json'] as $name) {
 $path = rtrim($outputDir, DIRECTORY_SEPARATOR). DIRECTORY_SEPARATOR. $name;
 if (!is_file($path)) {
 continue;
 }
 $data = json_decode((string) file_get_contents($path), true);

 return [$path, is_array($data) ? $this->countFindings($data): 0];
 }

 return [null, 0];
 }

 /**
 * @param array<string, mixed> $data
 */
 private function countFindings(array $data): int
 {
 if (isset($data['summary']['total']) && is_int($data['summary']['total'])) {
 return $data['summary']['total'];
 }

 if (!isset($data['grid']) || !is_array($data['grid'])) {
 return 0;
 }

 $total = 0;
 foreach ($data['grid'] as $site) {
 if (!is_array($site)) {
 continue;
 }
 foreach ($site as $findings) {
 if (is_array($findings)) {
 $total += count($findings);
 }
 }
 }

 return $total;
 }
}
