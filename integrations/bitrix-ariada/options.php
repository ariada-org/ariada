<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);

global $APPLICATION;

if ($APPLICATION->GetGroupRight('bitrix.ariada') < 'R') {
    $APPLICATION->AuthForm(Loc::getMessage('BITRIX_ARIADA_OPTIONS_ACCESS_DENIED'));
}

$adminUrl = '/bitrix/admin/bitrix_ariada.php?lang=' . rawurlencode((string)LANGUAGE_ID);
?>
<div class="adm-info-message-wrap">
    <div class="adm-info-message">
        <?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_OPTIONS_TEXT'))?>
        <br><br>
        <a class="adm-btn adm-btn-save" href="<?=htmlspecialcharsbx($adminUrl)?>">
            <?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_OPTIONS_OPEN'))?>
        </a>
    </div>
</div>
