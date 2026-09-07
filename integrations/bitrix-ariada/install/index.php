<?php
declare(strict_types=1);

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);

class bitrix_ariada extends CModule
{
    public $MODULE_ID = 'bitrix.ariada';
    public $MODULE_VERSION;
    public $MODULE_VERSION_DATE;
    public $MODULE_NAME;
    public $MODULE_DESCRIPTION;
    public $PARTNER_NAME;
    public $PARTNER_URI;
    public $MODULE_GROUP_RIGHTS = 'Y';

    public function __construct()
    {
        $version = [];
        include __DIR__ . '/version.php';
        if (isset($arModuleVersion) && is_array($arModuleVersion)) {
            $version = $arModuleVersion;
        }
        $this->MODULE_VERSION = (string)($version['VERSION'] ?? '1.0.0');
        $this->MODULE_VERSION_DATE = (string)($version['VERSION_DATE'] ?? '2026-07-14 00:00:00');
        $this->MODULE_NAME = (string)Loc::getMessage('BITRIX_ARIADA_MODULE_NAME');
        $this->MODULE_DESCRIPTION = (string)Loc::getMessage('BITRIX_ARIADA_MODULE_DESCRIPTION');
        $this->PARTNER_NAME = 'Ariada';
        $this->PARTNER_URI = 'https://ariada.org';
    }

    public function DoInstall(): bool
    {
        global $APPLICATION;
        if (!CheckVersion(PHP_VERSION, '7.4.0')) {
            $APPLICATION->ThrowException((string)Loc::getMessage('BITRIX_ARIADA_PHP_REQUIRED'));
            return false;
        }
        RegisterModule($this->MODULE_ID);
        if (!$this->InstallFiles()) {
            UnRegisterModule($this->MODULE_ID);
            $APPLICATION->ThrowException((string)Loc::getMessage('BITRIX_ARIADA_INSTALL_FILES_FAILED'));
            return false;
        }
        return true;
    }

    public function DoUninstall(): bool
    {
        $this->UnInstallFiles();
        COption::RemoveOption($this->MODULE_ID);
        UnRegisterModule($this->MODULE_ID);
        return true;
    }

    public function InstallFiles(): bool
    {
        $documentRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
        if ($documentRoot === '') {
            return false;
        }
        $adminCopied = CopyDirFiles(__DIR__ . '/admin', $documentRoot . '/bitrix/admin', true, true);
        $componentCopied = CopyDirFiles(
            __DIR__ . '/components/bitrix/ariada.audit',
            $documentRoot . '/bitrix/components/bitrix/ariada.audit',
            true,
            true
        );
        return $adminCopied && $componentCopied;
    }

    public function UnInstallFiles(): bool
    {
        $documentRoot = rtrim((string)($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
        if ($documentRoot === '') {
            return false;
        }
        DeleteDirFiles(__DIR__ . '/admin', $documentRoot . '/bitrix/admin');
        DeleteDirFilesEx('/bitrix/components/bitrix/ariada.audit');
        return true;
    }
}
