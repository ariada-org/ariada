<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);

$arComponentDescription = [
    'NAME' => Loc::getMessage('BITRIX_ARIADA_COMPONENT_NAME'),
    'DESCRIPTION' => Loc::getMessage('BITRIX_ARIADA_COMPONENT_DESCRIPTION'),
    'PATH' => ['ID' => 'service', 'NAME' => Loc::getMessage('BITRIX_ARIADA_COMPONENT_GROUP')],
];
