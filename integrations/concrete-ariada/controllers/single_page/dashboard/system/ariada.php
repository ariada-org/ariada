<?php

namespace Concrete\Package\ConcreteAriada\Controller\SinglePage\Dashboard\System;

defined('C5_EXECUTE') or die('Access Denied.');

use Concrete\Core\Package\Package;
use Concrete\Core\Page\Controller\DashboardPageController;
use ConcreteAriada\Model\AuditReport;
use ConcreteAriada\Model\Settings;
use ConcreteAriada\Service\AriadaException;
use ConcreteAriada\Service\AriadaService;
use ConcreteAriada\Service\DashboardPresenter;
use ConcreteAriada\Service\ProcessRunner;
use ConcreteAriada\Service\ReportParser;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

final class Ariada extends DashboardPageController
{
    private const SAVE_TOKEN = 'concrete_ariada_save';
    private const RUN_TOKEN = 'concrete_ariada_run';

    public function view()
    {
        $this->renderDashboard($this->loadSettings(false));
    }

    public function save()
    {
        $current = $this->loadSettings(false);
        if (!$this->validateToken(self::SAVE_TOKEN)) {
            $this->renderDashboard($current, null, t('The security token is invalid. Please try again.'));
            return;
        }

        try {
            $values = $current->toArray();
            $values['mode'] = $this->postString('mode');
            $values['site_url'] = $this->postString('site_url');
            $values['report_filename'] = $this->postString('report_filename');
            $values['browser'] = $this->postString('browser');
            $values['severity_threshold'] = $this->postString('severity_threshold');
            $values['navigation_timeout_ms'] = $this->postString('navigation_timeout_ms');
            $settings = Settings::fromArray($values, true);
            $this->persistSettings($settings);
            $this->renderDashboard($settings, null, null, t('Ariada settings saved.'));
        } catch (InvalidArgumentException $exception) {
            $this->renderDashboard($current, null, $exception->getMessage());
        } catch (Throwable $exception) {
            $this->renderDashboard($current, null, t('Settings could not be saved. Check the Concrete log.'));
        }
    }

    public function run_scan()
    {
        $settings = $this->loadSettings(false);
        if (!$this->validateToken(self::RUN_TOKEN)) {
            $this->renderDashboard($settings, null, t('The security token is invalid. Please try again.'));
            return;
        }

        try {
            $settings = Settings::fromArray($settings->toArray(), true);
            $service = new AriadaService(new ReportParser(), new ProcessRunner());
            $report = $service->getReport($settings);
            $this->renderDashboard($settings, $report);
        } catch (InvalidArgumentException | AriadaException $exception) {
            $this->renderDashboard($settings, null, $exception->getMessage());
        } catch (Throwable $exception) {
            $this->renderDashboard($settings, null, t('The Ariada operation failed. Check the Concrete log.'));
        }
    }

    private function renderDashboard(
        Settings $settings,
        ?AuditReport $report = null,
        ?string $error = null,
        ?string $success = null
    ): void {
        $presenter = new DashboardPresenter();
        $this->set('settingsView', $presenter->settings($settings));
        $this->set('reportView', $report === null ? null : $presenter->report($report, $settings->topViolations()));
        $this->set('safeError', $error === null ? '' : $presenter->safeError($error));
        $this->set('safeSuccess', $success === null ? '' : $presenter->escape($success));
    }

    private function loadSettings(bool $requireSiteUrl): Settings
    {
        $package = Package::getByHandle('concrete_ariada');
        if (!is_object($package)) {
            throw new RuntimeException('Concrete Ariada package is unavailable.');
        }

        $database = $package->getConfig();
        $file = $package->getFileConfig();
        $values = [];
        foreach (
            ['mode', 'site_url', 'report_filename', 'browser', 'severity_threshold', 'navigation_timeout_ms']
            as $key
        ) {
            $configKey = 'ariada.' . $key;
            $values[$key] = $database->has($configKey)
                ? $database->get($configKey)
                : $file->get($configKey);
        }

        foreach (
            [
                'report_directory',
                'allow_private_hosts',
                'cli_command_prefix',
                'process_timeout_seconds',
                'max_process_output_bytes',
                'max_report_bytes',
                'top_violations',
            ] as $key
        ) {
            $values[$key] = $file->get('ariada.' . $key);
        }

        return Settings::fromArray($values, $requireSiteUrl);
    }

    private function persistSettings(Settings $settings): void
    {
        $package = Package::getByHandle('concrete_ariada');
        if (!is_object($package)) {
            throw new RuntimeException('Concrete Ariada package is unavailable.');
        }

        $config = $package->getConfig();
        $values = $settings->toArray();
        foreach (
            ['mode', 'site_url', 'report_filename', 'browser', 'severity_threshold', 'navigation_timeout_ms']
            as $key
        ) {
            $config->save('ariada.' . $key, $values[$key]);
        }
    }

    private function validateToken(string $action): bool
    {
        return $this->app->make('token')->validate($action);
    }

    private function postString(string $key): string
    {
        $value = $this->request->request->get($key, '');
        return is_string($value) ? trim($value) : '';
    }
}
