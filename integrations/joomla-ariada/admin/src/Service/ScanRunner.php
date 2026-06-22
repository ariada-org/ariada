<?php
/**
 * Thin Ariada scan boundary for Joomla.
 */

declare(strict_types=1);

namespace Ariada\Component\Ariada\Administrator\Service;

defined('_JEXEC') or die;

use Joomla\CMS\Http\HttpFactory;
use Joomla\Registry\Registry;

class ScanRunner
{
	public function detectRuntime(): array
	{
		return [
			'procOpen' => function_exists('proc_open') && !in_array('proc_open', $this->disabledFunctions(), true),
			'node' => $this->commandSucceeds(['node', '--version']),
			'ariada' => $this->commandSucceeds(['ariada', '--version']),
		];
	}

	public function run(Registry $params): array
	{
		$url = $this->targetUrl($params);
		if ($url === '') {
			return ['ok' => false, 'error' => 'Configure a public http(s) target URL before scanning.'];
		}

		$mode = (string) $params->get('execution_mode', 'auto');
		$runtime = $this->detectRuntime();

		if (($mode === 'auto' || $mode === 'local') && $runtime['procOpen']) {
			$local = $this->runLocal($url, $params);
			if ($local['ok'] || $mode === 'local') {
				return $local;
			}
		}

		return $this->runHosted($url, $params);
	}

	private function runLocal(string $url, Registry $params): array
	{
		$outputDir = sys_get_temp_dir() . '/ariada-joomla-' . bin2hex(random_bytes(6));
		if (!mkdir($outputDir, 0700, true) && !is_dir($outputDir)) {
			return ['ok' => false, 'error' => 'Could not create temporary scan directory.'];
		}

		$command = [
			(string) $params->get('cli_binary', 'ariada'),
			'scan',
			$url,
			'--domains',
			$this->domains($params),
			'--format',
			'json',
			'--output-dir',
			$outputDir,
			'--severity-threshold',
			(string) $params->get('severity_threshold', 'serious'),
		];

		$exitCode = $this->procExitCode($command);
		$reportFile = $outputDir . '/report.json';
		$report = is_file($reportFile) ? (string) file_get_contents($reportFile) : '';
		$this->removeDirectory($outputDir);

		if (in_array($exitCode, [0, 1], true) && $report !== '') {
			return ['ok' => true, 'message' => 'Ariada local scan finished.', 'mode' => 'local', 'report' => $report];
		}

		return ['ok' => false, 'error' => 'Ariada CLI scan failed or produced no report.', 'mode' => 'local'];
	}

	private function runHosted(string $url, Registry $params): array
	{
		$endpoint = rtrim((string) $params->get('hosted_endpoint', ''), '/');
		$apiKey = (string) $params->get('api_key', '');
		if ($endpoint === '' || $apiKey === '') {
			return ['ok' => false, 'error' => 'Hosted mode requires an endpoint and API key.', 'mode' => 'hosted'];
		}

		$body = json_encode([
			'url' => $url,
			'domains' => explode(',', $this->domains($params)),
			'severityThreshold' => (string) $params->get('severity_threshold', 'serious'),
		], JSON_THROW_ON_ERROR);

		$response = HttpFactory::getHttp()->post(
			$endpoint . '/api/scan',
			$body,
			[
				'Content-Type' => 'application/json',
				'X-Ariada-Signature' => 'sha256=' . hash_hmac('sha256', $body, $apiKey),
			],
			30
		);

		if ($response->code < 200 || $response->code >= 300) {
			return ['ok' => false, 'error' => 'Hosted endpoint returned HTTP ' . $response->code . '.', 'mode' => 'hosted'];
		}

		return ['ok' => true, 'message' => 'Ariada hosted scan request finished.', 'mode' => 'hosted', 'report' => $response->body];
	}

	private function targetUrl(Registry $params): string
	{
		$url = trim((string) $params->get('target_url', ''));

		return filter_var($url, FILTER_VALIDATE_URL) && preg_match('/^https?:\/\//', $url) ? $url : '';
	}

	private function domains(Registry $params): string
	{
		$domains = array_filter(array_map('trim', explode(',', (string) $params->get('domains', 'accessibility,privacy,security'))));

		return implode(',', preg_grep('/^[a-z0-9-]+$/', $domains) ?: ['accessibility']);
	}

	private function procExitCode(array $command): int
	{
		$process = @proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
		if (!is_resource($process)) {
			return -1;
		}

		foreach ($pipes as $pipe) {
			stream_get_contents($pipe);
			fclose($pipe);
		}

		return proc_close($process);
	}

	private function commandSucceeds(array $command): bool
	{
		return function_exists('proc_open') && $this->procExitCode($command) === 0;
	}

	private function disabledFunctions(): array
	{
		return array_map('trim', explode(',', (string) ini_get('disable_functions')));
	}

	private function removeDirectory(string $dir): void
	{
		if (!is_dir($dir)) {
			return;
		}

		$items = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator($dir, \RecursiveDirectoryIterator::SKIP_DOTS),
			\RecursiveIteratorIterator::CHILD_FIRST
		);

		foreach ($items as $item) {
			$item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
		}

		rmdir($dir);
	}
}
