<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);

$arComponentParameters = [
    'PARAMETERS' => [
        'TOP_LIMIT' => [
            'PARENT' => 'BASE',
            'NAME' => Loc::getMessage('BITRIX_ARIADA_PARAMETER_TOP_LIMIT'),
            'TYPE' => 'STRING',
            'DEFAULT' => '5',
        ],
        'SHOW_URL' => [
            'PARENT' => 'BASE',
            'NAME' => Loc::getMessage('BITRIX_ARIADA_PARAMETER_SHOW_URL'),
            'TYPE' => 'CHECKBOX',
            'DEFAULT' => 'Y',
        ],
        'CACHE_TIME' => ['DEFAULT' => 300],
    ],
];
