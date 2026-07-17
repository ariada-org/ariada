<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Service;

use Drupal\Core\File\FileSystemInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;

/**
 * Runs the local Ariada CLI subprocess.
 */
final class LocalAriadaRunner {

  private const LOGGER_CHANNEL = 'ariada_drupal';

  public function __construct(
    private readonly FileSystemInterface $fileSystem,
    private readonly LoggerChannelFactoryInterface $loggerFactory,
    private readonly AriadaReportNormalizer $normalizer,
  ) {
  }

  /**
   * Runs a local CLI scan.
   *
   * @return array<string,mixed>
   */
  public function scan(string $url, array $config): array {
    if (!function_exists('proc_open')) {
      return $this->error('proc_open is not available.');
    }

    $outputDir = $this->createOutputDirectory();
    if ($outputDir === NULL) {
      return $this->error('Could not create a temporary Ariada output directory.');
    }

    $process = @proc_open(
      $this->buildCommand($url, $config, $outputDir),
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );

    if (!is_resource($process)) {
      $this->deleteDirectory($outputDir);
      return $this->error('Could not start the Ariada CLI process.');
    }

    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]) ?: '';
    $stderr = stream_get_contents($pipes[2]) ?: '';
    fclose($pipes[1]);
    fclose($pipes[2]);
    $exitCode = proc_close($process);

    $scanFile = $outputDir . DIRECTORY_SEPARATOR . 'scan.json';
    $json = is_file($scanFile) ? file_get_contents($scanFile) : FALSE;
    $this->deleteDirectory($outputDir);

    if (in_array($exitCode, [0, 1], TRUE) && is_string($json) && $json !== '') {
      return $this->normalizer->normalizeJson($json, 'local', $exitCode);
    }

    $message = trim($stderr) !== '' ? trim($stderr) : trim($stdout);
    $this->loggerFactory->get(self::LOGGER_CHANNEL)->warning('Ariada CLI failed with code @code: @message', [
      '@code' => (string) $exitCode,
      '@message' => $message,
    ]);
    return $this->error($message !== '' ? $message : sprintf('Ariada CLI exited with code %d.', $exitCode), $exitCode);
  }

  /**
   * Checks the local CLI boundary.
   */
  public function canRun(string $binary): bool {
    if (!function_exists('proc_open')) {
      return FALSE;
    }

    $process = @proc_open(
      [$binary, 'version'],
      [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
      $pipes,
    );

    if (!is_resource($process)) {
      return FALSE;
    }

    fclose($pipes[0]);
    stream_get_contents($pipes[1]);
    stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return proc_close($process) === 0;
  }

  /**
   * Builds the Ariada CLI command.
   *
   * @return array<int,string>
   */
  private function buildCommand(string $url, array $config, string $outputDir): array {
    return [
      (string) ($config['ariada_binary'] ?? 'ariada'),
      'scan',
      $url,
      '--format',
      'json',
      '--output-dir',
      $outputDir,
      '--severity-threshold',
      $this->normalizeThreshold((string) ($config['severity_threshold'] ?? 'serious')),
      '--timeout-ms',
      (string) max(1000, (int) ($config['timeout_ms'] ?? 30000)),
    ];
  }

  /**
   * Creates a temporary directory for CLI output.
   */
  private function createOutputDirectory(): ?string {
    $base = $this->fileSystem->getTempDirectory() ?: sys_get_temp_dir();
    $dir = $base . DIRECTORY_SEPARATOR . 'ariada-drupal-' . bin2hex(random_bytes(6));

    if (!mkdir($dir, 0700, TRUE) && !is_dir($dir)) {
      return NULL;
    }

    return $dir;
  }

  /**
   * Removes a temporary output directory.
   */
  private function deleteDirectory(string $dir): void {
    if (!is_dir($dir)) {
      return;
    }

    $files = new \RecursiveIteratorIterator(
      new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
      \RecursiveIteratorIterator::CHILD_FIRST,
    );
    foreach ($files as $file) {
      $path = $file->getRealPath();
      if ($path !== FALSE) {
        $file->isDir() ? rmdir($path) : unlink($path);
      }
    }
    rmdir($dir);
  }

  /**
   * Normalizes an unsupported threshold to the default CI-safe level.
   */
  private function normalizeThreshold(string $threshold): string {
    return in_array($threshold, ['minor', 'moderate', 'serious', 'critical'], TRUE) ? $threshold : 'serious';
  }

  /**
   * Builds a local-runner error result.
   *
   * @return array<string,mixed>
   */
  private function error(string $message, int $exitCode = 3): array {
    return [
      'ok' => FALSE,
      'source' => 'local',
      'exit_code' => $exitCode,
      'error' => $message,
    ];
  }

}
