<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Report\ResultStore;
use Bitrix\Main\Loader;
use Bitrix\Main\Localization\Loc;

final class AriadaAuditComponent extends CBitrixComponent
{
    public function onPrepareComponentParams($arParams)
    {
        $limit = isset($arParams['TOP_LIMIT']) ? (int)$arParams['TOP_LIMIT'] : 5;
        $arParams['TOP_LIMIT'] = max(1, min(10, $limit));
        $arParams['SHOW_URL'] = ($arParams['SHOW_URL'] ?? 'Y') === 'N' ? 'N' : 'Y';
        return $arParams;
    }

    public function executeComponent()
    {
        Loc::loadMessages(__FILE__);
        $this->arResult = ['ERROR' => '', 'RESULT' => null, 'SHOW_URL' => $this->arParams['SHOW_URL']];
        if (!Loader::includeModule('bitrix.ariada')) {
            $this->arResult['ERROR'] = (string)Loc::getMessage('BITRIX_ARIADA_COMPONENT_MODULE_ERROR');
            $this->includeComponentTemplate();
            return;
        }

        try {
            $viewModel = (new ResultStore())->load();
            if ($viewModel !== null) {
                $result = $viewModel->toArray();
                $result['topViolations'] = array_slice($result['topViolations'], 0, $this->arParams['TOP_LIMIT']);
                $this->arResult['RESULT'] = $result;
            }
        } catch (ModuleException $exception) {
            $this->arResult['ERROR'] = (string)Loc::getMessage('BITRIX_ARIADA_COMPONENT_RESULT_ERROR');
        }
        $this->includeComponentTemplate();
    }
}
