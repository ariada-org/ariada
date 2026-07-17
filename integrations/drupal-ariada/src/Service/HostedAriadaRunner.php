<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Service;

use Drupal\Component\Serialization\Json;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Runs scans through a configured hosted endpoint.
 */
final class HostedAriadaRunner {

  private const LOGGER_CHANNEL = 'ariada_drupal';

  public function __construct(
    private readonly ClientInterface $httpClient,
    private readonly LoggerChannelFactoryInterface $loggerFactory,
    private readonly AriadaReportNormalizer $normalizer,
  ) {
  }

  /**
   * Runs a hosted scan.
   *
   * @return array<string,mixed>
   */
  public function scan(string $url, array $config): array {
    if (!$this->hasConfig($config)) {
      return $this->error('Hosted scanning requires an endpoint and API key.');
    }

    $endpoint = rtrim((string) $config['hosted_endpoint'], '/');
    $apiKey = (string) $config['api_key'];

    try {
      $response = $this->httpClient->post($endpoint . '/api/scan', [
        'headers' => [
          'Authorization' => 'Bearer ' . $apiKey,
          'Accept' => 'application/json',
        ],
        'json' => [
          'url' => $url,
          'severityThreshold' => (string) ($config['severity_threshold'] ?? 'serious'),
        ],
        'timeout' => 30,
      ]);

      $body = Json::decode((string) $response->getBody());
      if (is_array($body) && isset($body['id']) && !isset($body['report'])) {
        return $this->poll($endpoint, $apiKey, (string) $body['id']);
      }

      return $this->normalizer->normalize($body, 'hosted', 0);
    }
    catch (GuzzleException $exception) {
      $this->loggerFactory->get(self::LOGGER_CHANNEL)->warning('Hosted Ariada scan failed: @message', [
        '@message' => $exception->getMessage(),
      ]);
      return $this->error($exception->getMessage());
    }
  }

  /**
   * Checks whether hosted settings are complete.
   */
  public function hasConfig(array $config): bool {
    return !empty($config['hosted_endpoint']) && !empty($config['api_key']);
  }

  /**
   * Polls an asynchronous hosted scan.
   *
   * @return array<string,mixed>
   */
  private function poll(string $endpoint, string $apiKey, string $scanId): array {
    try {
      for ($attempt = 0; $attempt < 12; $attempt++) {
        sleep(2);
        $response = $this->httpClient->get($endpoint . '/api/scan/' . rawurlencode($scanId), [
          'headers' => [
            'Authorization' => 'Bearer ' . $apiKey,
            'Accept' => 'application/json',
          ],
          'timeout' => 15,
        ]);
        $body = Json::decode((string) $response->getBody());

        if (($body['status'] ?? '') === 'done') {
          return $this->normalizer->normalize((array) ($body['report'] ?? $body), 'hosted', 0);
        }

        if (($body['status'] ?? '') === 'error') {
          return $this->error((string) ($body['message'] ?? 'Hosted scan returned an error.'));
        }
      }
    }
    catch (GuzzleException $exception) {
      return $this->error($exception->getMessage());
    }

    return $this->error('Hosted scan did not finish before the polling timeout.');
  }

  /**
   * Builds a hosted-runner error result.
   *
   * @return array<string,mixed>
   */
  private function error(string $message): array {
    return [
      'ok' => FALSE,
      'source' => 'hosted',
      'error' => $message,
    ];
  }

}
