<?php
declare(strict_types=1);

defined('B_PROLOG_INCLUDED') || die();

use Bitrix\Main\Localization\Loc;

Loc::loadMessages(__FILE__);
?>
<section class="ariada-audit" aria-labelledby="ariada-audit-title">
    <h2 id="ariada-audit-title"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_TITLE'))?></h2>
    <?php if ($arResult['ERROR'] !== ''): ?>
        <p role="status"><?=htmlspecialcharsbx((string)$arResult['ERROR'])?></p>
    <?php elseif ($arResult['RESULT'] === null): ?>
        <p><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_EMPTY'))?></p>
    <?php else: ?>
        <?php $result = $arResult['RESULT']; ?>
        <p><strong><?=htmlspecialcharsbx($result['passed'] ? (string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_PASS') : (string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_FAIL'))?></strong></p>
        <?php if ($arResult['SHOW_URL'] === 'Y'): ?>
            <p><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_URL'))?>: <?=htmlspecialcharsbx((string)$result['url'])?></p>
        <?php endif; ?>
        <dl>
            <dt><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_TOTAL'))?></dt><dd><?=htmlspecialcharsbx((string)$result['total'])?></dd>
            <?php foreach (['critical', 'serious', 'moderate', 'minor'] as $impact): ?>
                <dt><?=htmlspecialcharsbx(ucfirst($impact))?></dt><dd><?=htmlspecialcharsbx((string)$result['byImpact'][$impact])?></dd>
            <?php endforeach; ?>
        </dl>
        <?php if ($result['topViolations'] !== []): ?>
            <h3><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TEMPLATE_TOP'))?></h3>
            <ol>
                <?php foreach ($result['topViolations'] as $violation): ?>
                    <li><code><?=htmlspecialcharsbx((string)$violation['ruleId'])?></code> (<?=htmlspecialcharsbx((string)$violation['severity'])?>, <?=htmlspecialcharsbx((string)$violation['count'])?>)</li>
                <?php endforeach; ?>
            </ol>
        <?php endif; ?>
    <?php endif; ?>
</section>
