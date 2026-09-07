<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Loader;

Loader::registerAutoLoadClasses('bitrix.ariada', [
    Bitrix\Ariada\Config\ModuleConfig::class => 'lib/Config/ModuleConfig.php',
    Bitrix\Ariada\Exception\ModuleException::class => 'lib/Exception/ModuleException.php',
    Bitrix\Ariada\Process\CliRunner::class => 'lib/Process/CliRunner.php',
    Bitrix\Ariada\Report\ReportParser::class => 'lib/Report/ReportParser.php',
    Bitrix\Ariada\Report\ReportReader::class => 'lib/Report/ReportReader.php',
    Bitrix\Ariada\Report\ResultStore::class => 'lib/Report/ResultStore.php',
    Bitrix\Ariada\Report\ScanViewModel::class => 'lib/Report/ScanViewModel.php',
    Bitrix\Ariada\Security\PublicUrlValidator::class => 'lib/Security/PublicUrlValidator.php',
    Bitrix\Ariada\Service\AuditService::class => 'lib/Service/AuditService.php',
]);
