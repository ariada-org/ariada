<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);

global $APPLICATION;
if ($APPLICATION->GetGroupRight('bitrix.ariada') < 'R') {
    return false;
}

return [
    'parent_menu' => 'global_menu_services',
    'section' => 'bitrix_ariada',
    'sort' => 100,
    'text' => Loc::getMessage('BITRIX_ARIADA_MENU_TEXT'),
    'title' => Loc::getMessage('BITRIX_ARIADA_MENU_TITLE'),
    'url' => 'bitrix_ariada.php?lang=' . rawurlencode((string)LANGUAGE_ID),
    'icon' => 'sys_menu_icon',
    'page_icon' => 'sys_page_icon',
    'items_id' => 'menu_bitrix_ariada',
];
