<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: GPL-2.0-or-later

namespace Drupal\ariada_drupal\Form;

use Drupal\ariada_drupal\Service\AriadaScanner;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Form\ConfigFormBase;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\State\StateInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Configuration and manual scan form for Ariada.
 */
final class AriadaSettingsForm extends ConfigFormBase {

  public function __construct(
    ConfigFactoryInterface $config_factory,
    private readonly AriadaScanner $scanner,
    private readonly StateInterface $state,
  ) {
    parent::__construct($config_factory);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('config.factory'),
      $container->get('ariada_drupal.scanner'),
      $container->get('state'),
    );
  }

  /**
   * {@inheritdoc}
   */
  public function getFormId(): string {
    return 'ariada_drupal_settings_form';
  }

  /**
   * {@inheritdoc}
   */
  protected function getEditableConfigNames(): array {
    return ['ariada_drupal.settings'];
  }

  /**
   * {@inheritdoc}
   */
  public function buildForm(array $form, FormStateInterface $form_state): array {
    $config = $this->config('ariada_drupal.settings');

    $form['scan_url'] = [
      '#type' => 'url',
      '#title' => $this->t('Default scan URL'),
      '#default_value' => $config->get('scan_url') ?: '',
      '#description' => $this->t('Used by the manual admin scan when no other URL is supplied.'),
      '#maxlength' => 2048,
    ];

    $form['execution_mode'] = [
      '#type' => 'select',
      '#title' => $this->t('Execution mode'),
      '#default_value' => $config->get('execution_mode') ?: 'auto',
      '#options' => [
        'auto' => $this->t('Auto: local CLI, then hosted endpoint'),
        'local' => $this->t('Local Ariada CLI'),
        'hosted' => $this->t('Hosted scan endpoint'),
      ],
      '#required' => TRUE,
    ];

    $form['ariada_binary'] = [
      '#type' => 'textfield',
      '#title' => $this->t('Ariada CLI binary'),
      '#default_value' => $config->get('ariada_binary') ?: 'ariada',
      '#description' => $this->t('Binary name or absolute path. Install with npm install -g @ariada-org/cli, or point to a built local binary.'),
      '#maxlength' => 512,
    ];

    $form['severity_threshold'] = [
      '#type' => 'select',
      '#title' => $this->t('Severity threshold'),
      '#default_value' => $config->get('severity_threshold') ?: 'serious',
      '#options' => [
        'minor' => $this->t('Minor'),
        'moderate' => $this->t('Moderate'),
        'serious' => $this->t('Serious'),
        'critical' => $this->t('Critical'),
      ],
      '#required' => TRUE,
    ];

    $form['timeout_ms'] = [
      '#type' => 'number',
      '#title' => $this->t('Local scan timeout'),
      '#default_value' => (int) ($config->get('timeout_ms') ?: 30000),
      '#min' => 1000,
      '#step' => 1000,
      '#field_suffix' => $this->t('milliseconds'),
    ];

    $form['hosted'] = [
      '#type' => 'details',
      '#title' => $this->t('Hosted scan endpoint'),
      '#open' => (bool) $config->get('hosted_endpoint'),
    ];

    $form['hosted']['hosted_endpoint'] = [
      '#type' => 'url',
      '#title' => $this->t('Endpoint base URL'),
      '#default_value' => $config->get('hosted_endpoint') ?: '',
      '#description' => $this->t('Optional hosted scanner base URL. The module calls /api/scan below this URL.'),
      '#maxlength' => 2048,
    ];

    $form['hosted']['api_key'] = [
      '#type' => 'password',
      '#title' => $this->t('API key'),
      '#description' => $this->t('Leave blank to keep the existing key.'),
      '#maxlength' => 512,
    ];

    $result = $form_state->get('ariada_result');
    if (!is_array($result)) {
      $result = $this->state->get('ariada_drupal.last_scan_result');
    }

    if (is_array($result)) {
      $form['latest_result'] = [
        '#type' => 'details',
        '#title' => $this->t('Latest scan result'),
        '#open' => TRUE,
      ];
      $form['latest_result']['summary'] = [
        '#plain_text' => $this->scanner->formatSummary($result),
      ];
      $form['latest_result']['findings'] = $this->buildFindingsTable($result);
    }

    $form = parent::buildForm($form, $form_state);
    $form['actions']['run_scan'] = [
      '#type' => 'submit',
      '#value' => $this->t('Save and scan'),
      '#submit' => ['::scanSubmit'],
      '#button_type' => 'primary',
    ];

    return $form;
  }

  /**
   * {@inheritdoc}
   */
  public function validateForm(array &$form, FormStateInterface $form_state): void {
    parent::validateForm($form, $form_state);

    $timeout = (int) $form_state->getValue('timeout_ms');
    if ($timeout < 1000) {
      $form_state->setErrorByName('timeout_ms', $this->t('Timeout must be at least 1000 milliseconds.'));
    }
  }

  /**
   * {@inheritdoc}
   */
  public function submitForm(array &$form, FormStateInterface $form_state): void {
    $this->saveSettings($form_state);
    parent::submitForm($form, $form_state);
  }

  /**
   * Saves settings and immediately runs a scan.
   */
  public function scanSubmit(array &$form, FormStateInterface $form_state): void {
    $this->saveSettings($form_state);

    $url = (string) $form_state->getValue('scan_url');
    if ($url === '') {
      $url = \Drupal::request()->getSchemeAndHttpHost();
    }

    $result = $this->scanner->scan($url);
    $summary = $this->scanner->formatSummary($result);
    $this->state->set('ariada_drupal.last_scan_result', $result);
    $this->state->set('ariada_drupal.last_scan_summary', $summary);

    if (!empty($result['ok'])) {
      $this->messenger()->addStatus($this->t('Ariada scan completed: @summary', [
        '@summary' => $summary,
      ]));
    }
    else {
      $this->messenger()->addError($this->t('Ariada scan failed: @message', [
        '@message' => (string) ($result['error'] ?? 'unknown error'),
      ]));
    }

    $form_state->set('ariada_result', $result);
    $form_state->setRebuild(TRUE);
  }

  /**
   * Persists form values.
   */
  private function saveSettings(FormStateInterface $form_state): void {
    $config = $this->config('ariada_drupal.settings');
    $apiKey = (string) $form_state->getValue('api_key');

    $config
      ->set('execution_mode', (string) $form_state->getValue('execution_mode'))
      ->set('scan_url', (string) $form_state->getValue('scan_url'))
      ->set('ariada_binary', (string) $form_state->getValue('ariada_binary'))
      ->set('hosted_endpoint', (string) $form_state->getValue('hosted_endpoint'))
      ->set('severity_threshold', (string) $form_state->getValue('severity_threshold'))
      ->set('timeout_ms', (int) $form_state->getValue('timeout_ms'));

    if ($apiKey !== '') {
      $config->set('api_key', $apiKey);
    }

    $config->save();
  }

  /**
   * Builds a render array table for normalized findings.
   *
   * @return array<string,mixed>
   */
  private function buildFindingsTable(array $result): array {
    $findings = array_slice((array) ($result['findings'] ?? []), 0, 50);
    if ($findings === []) {
      return [
        '#plain_text' => $this->t('No findings were returned.'),
      ];
    }

    $rows = [];
    foreach ($findings as $finding) {
      $finding = (array) $finding;
      $rows[] = [
        (string) ($finding['severity'] ?? ''),
        (string) ($finding['rule'] ?? ''),
        (string) ($finding['message'] ?? ''),
        (string) ($finding['target'] ?? ''),
      ];
    }

    return [
      '#type' => 'table',
      '#header' => [
        $this->t('Severity'),
        $this->t('Rule'),
        $this->t('Finding'),
        $this->t('Target'),
      ],
      '#rows' => $rows,
      '#empty' => $this->t('No findings were returned.'),
    ];
  }

}
