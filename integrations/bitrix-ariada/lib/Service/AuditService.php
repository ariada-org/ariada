<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Service;

use Bitrix\Ariada\Config\ModuleConfig;
use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Process\CliRunner;
use Bitrix\Ariada\Report\ReportParser;
use Bitrix\Ariada\Report\ReportReader;
use Bitrix\Ariada\Report\ScanViewModel;
use Bitrix\Ariada\Security\PublicUrlValidator;

final class AuditService
{
    private PublicUrlValidator $urlValidator;
    private ReportReader $reader;
    private ReportParser $parser;

    public function __construct(
        ?PublicUrlValidator $urlValidator = null,
        ?ReportReader $reader = null,
        ?ReportParser $parser = null
    ) {
        $this->urlValidator = $urlValidator ?? new PublicUrlValidator();
        $this->reader = $reader ?? new ReportReader();
        $this->parser = $parser ?? new ReportParser($this->urlValidator);
    }

    /** @param array<string, string|int> $config */
    public function run(array $config): ScanViewModel
    {
        $validated = ModuleConfig::validate($config, $this->urlValidator);
        $url = (string)$validated['public_url'];

        if ($validated['execution_mode'] === ModuleConfig::MODE_CLI) {
            $runner = new CliRunner(
                (string)$validated['cli_binary'],
                (string)$validated['browser'],
                (string)$validated['severity_threshold'],
                (int)$validated['scan_timeout_ms'],
                (int)$validated['process_timeout_seconds'],
                $this->reader
            );
            $json = $runner->run($url);
        } elseif ($validated['execution_mode'] === ModuleConfig::MODE_REPORT) {
            $json = $this->reader->read((string)$validated['report_path']);
        } else {
            throw ModuleException::configuration('Execution mode is invalid.');
        }

        return $this->parser->parse($json, $url);
    }
}
