<?php
declare(strict_types=1);

use Bitrix\Ariada\Config\ModuleConfig;
use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Ariada\Report\ResultStore;
use Bitrix\Ariada\Security\PublicUrlValidator;
use Bitrix\Ariada\Service\AuditService;
use Bitrix\Main\Context;
use Bitrix\Main\Loader;
use Bitrix\Main\Localization\Loc;

require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_admin_before.php';

Loc::loadMessages(__FILE__);
global $APPLICATION;
$APPLICATION->SetTitle((string)Loc::getMessage('BITRIX_ARIADA_ADMIN_TITLE'));

if (!Loader::includeModule(ModuleConfig::MODULE_ID)) {
    require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_admin_after.php';
    CAdminMessage::ShowMessage((string)Loc::getMessage('BITRIX_ARIADA_MODULE_UNAVAILABLE'));
    require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/epilog_admin.php';
    return;
}
if ($APPLICATION->GetGroupRight(ModuleConfig::MODULE_ID) < 'W') {
    $APPLICATION->AuthForm((string)Loc::getMessage('BITRIX_ARIADA_ACCESS_DENIED'));
}

$request = Context::getCurrent()->getRequest();
$notice = '';
$error = '';
$store = new ResultStore();
$result = null;

if ($request->isPost()) {
    if (!check_bitrix_sessid()) {
        $error = (string)Loc::getMessage('BITRIX_ARIADA_BAD_SESSION');
    } else {
        $action = $request->getPost('action');
        try {
            if ($action === 'save_config') {
                $input = [];
                foreach (array_keys(ModuleConfig::defaults()) as $key) {
                    $value = $request->getPost($key);
                    $input[$key] = is_string($value) || is_numeric($value) ? (string)$value : '';
                }
                ModuleConfig::save(ModuleConfig::validate($input, new PublicUrlValidator()));
                $notice = (string)Loc::getMessage('BITRIX_ARIADA_CONFIG_SAVED');
            } elseif ($action === 'run_audit') {
                $viewModel = (new AuditService())->run(ModuleConfig::load());
                $store->save($viewModel);
                $result = $viewModel->toArray();
                $notice = (string)Loc::getMessage('BITRIX_ARIADA_RESULT_LOADED');
            }
        } catch (ModuleException $exception) {
            $error = $exception->getMessage();
        } catch (Throwable $exception) {
            $error = (string)Loc::getMessage('BITRIX_ARIADA_GENERIC_ERROR');
        }
    }
}

$config = ModuleConfig::load();
if ($result === null) {
    try {
        $stored = $store->load();
        $result = $stored !== null ? $stored->toArray() : null;
    } catch (ModuleException $exception) {
        $error = $error !== '' ? $error : $exception->getMessage();
    }
}

require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/prolog_admin_after.php';

if ($notice !== '') {
    CAdminMessage::ShowMessage(['TYPE' => 'OK', 'MESSAGE' => htmlspecialcharsbx($notice)]);
}
if ($error !== '') {
    CAdminMessage::ShowMessage(['TYPE' => 'ERROR', 'MESSAGE' => htmlspecialcharsbx($error)]);
}

$tabs = new CAdminTabControl('bitrixAriadaTabs', [
    ['DIV' => 'config', 'TAB' => Loc::getMessage('BITRIX_ARIADA_TAB_CONFIG'), 'TITLE' => Loc::getMessage('BITRIX_ARIADA_TAB_CONFIG_TITLE')],
    ['DIV' => 'result', 'TAB' => Loc::getMessage('BITRIX_ARIADA_TAB_RESULT'), 'TITLE' => Loc::getMessage('BITRIX_ARIADA_TAB_RESULT_TITLE')],
]);
?>
<form method="post" action="<?=htmlspecialcharsbx($APPLICATION->GetCurPageParam('', []))?>">
    <?=bitrix_sessid_post()?>
    <?php $tabs->Begin(); ?>
    <?php $tabs->BeginNextTab(); ?>
    <tr>
        <td width="40%"><label for="public_url"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_PUBLIC_URL'))?></label></td>
        <td width="60%"><input type="url" size="70" maxlength="2048" id="public_url" name="public_url" value="<?=htmlspecialcharsbx((string)$config['public_url'])?>" required></td>
    </tr>
    <tr>
        <td><label for="execution_mode"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_MODE'))?></label></td>
        <td>
            <select id="execution_mode" name="execution_mode">
                <option value="report" <?=$config['execution_mode'] === 'report' ? 'selected' : ''?>><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_MODE_REPORT'))?></option>
                <option value="cli" <?=$config['execution_mode'] === 'cli' ? 'selected' : ''?>><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_MODE_CLI'))?></option>
            </select>
        </td>
    </tr>
    <tr class="heading"><td colspan="2"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_CLI_HEADING'))?></td></tr>
    <tr>
        <td><label for="cli_binary"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_CLI_BINARY'))?></label></td>
        <td><input type="text" size="70" maxlength="1024" id="cli_binary" name="cli_binary" value="<?=htmlspecialcharsbx((string)$config['cli_binary'])?>"></td>
    </tr>
    <tr>
        <td><label for="browser"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_BROWSER'))?></label></td>
        <td><select id="browser" name="browser">
            <?php foreach (['chromium', 'firefox', 'webkit'] as $browser): ?>
                <option value="<?=htmlspecialcharsbx($browser)?>" <?=$config['browser'] === $browser ? 'selected' : ''?>><?=htmlspecialcharsbx($browser)?></option>
            <?php endforeach; ?>
        </select></td>
    </tr>
    <tr>
        <td><label for="severity_threshold"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_SEVERITY'))?></label></td>
        <td><select id="severity_threshold" name="severity_threshold">
            <?php foreach (['minor', 'moderate', 'serious', 'critical'] as $severity): ?>
                <option value="<?=htmlspecialcharsbx($severity)?>" <?=$config['severity_threshold'] === $severity ? 'selected' : ''?>><?=htmlspecialcharsbx($severity)?></option>
            <?php endforeach; ?>
        </select></td>
    </tr>
    <tr>
        <td><label for="scan_timeout_ms"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_SCAN_TIMEOUT'))?></label></td>
        <td><input type="number" min="5000" max="120000" id="scan_timeout_ms" name="scan_timeout_ms" value="<?=htmlspecialcharsbx((string)$config['scan_timeout_ms'])?>"></td>
    </tr>
    <tr>
        <td><label for="process_timeout_seconds"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_PROCESS_TIMEOUT'))?></label></td>
        <td><input type="number" min="10" max="180" id="process_timeout_seconds" name="process_timeout_seconds" value="<?=htmlspecialcharsbx((string)$config['process_timeout_seconds'])?>"></td>
    </tr>
    <tr class="heading"><td colspan="2"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_REPORT_HEADING'))?></td></tr>
    <tr>
        <td><label for="report_path"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_REPORT_PATH'))?></label></td>
        <td><input type="text" size="70" maxlength="1024" id="report_path" name="report_path" value="<?=htmlspecialcharsbx((string)$config['report_path'])?>"></td>
    </tr>
    <?php $tabs->BeginNextTab(); ?>
    <tr><td colspan="2">
        <?php if ($result === null): ?>
            <p><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_NO_RESULT'))?></p>
        <?php else: ?>
            <table class="adm-list-table" style="width:100%">
                <thead><tr class="adm-list-table-header"><td class="adm-list-table-cell"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_FIELD'))?></td><td class="adm-list-table-cell"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_VALUE'))?></td></tr></thead>
                <tbody>
                    <tr><td><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_STATUS'))?></td><td><strong><?=htmlspecialcharsbx($result['passed'] ? (string)Loc::getMessage('BITRIX_ARIADA_PASS') : (string)Loc::getMessage('BITRIX_ARIADA_FAIL'))?></strong></td></tr>
                    <tr><td><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_PUBLIC_URL'))?></td><td><?=htmlspecialcharsbx((string)$result['url'])?></td></tr>
                    <tr><td><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TOTAL'))?></td><td><?=htmlspecialcharsbx((string)$result['total'])?></td></tr>
                    <?php foreach (['critical', 'serious', 'moderate', 'minor'] as $impact): ?>
                        <tr><td><?=htmlspecialcharsbx(ucfirst($impact))?></td><td><?=htmlspecialcharsbx((string)$result['byImpact'][$impact])?></td></tr>
                    <?php endforeach; ?>
                    <tr><td><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_STARTED'))?></td><td><?=htmlspecialcharsbx((string)$result['startedAt'])?></td></tr>
                    <tr><td><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_DURATION'))?></td><td><?=htmlspecialcharsbx((string)$result['durationMs'])?></td></tr>
                </tbody>
            </table>
            <h3><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_TOP_VIOLATIONS'))?></h3>
            <?php if ($result['topViolations'] === []): ?>
                <p><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_NONE'))?></p>
            <?php else: ?>
                <table class="adm-list-table" style="width:100%">
                    <thead><tr class="adm-list-table-header"><td class="adm-list-table-cell">Rule</td><td class="adm-list-table-cell">Severity</td><td class="adm-list-table-cell">Count</td></tr></thead>
                    <tbody><?php foreach ($result['topViolations'] as $violation): ?>
                        <tr><td><?=htmlspecialcharsbx((string)$violation['ruleId'])?></td><td><?=htmlspecialcharsbx((string)$violation['severity'])?></td><td><?=htmlspecialcharsbx((string)$violation['count'])?></td></tr>
                    <?php endforeach; ?></tbody>
                </table>
            <?php endif; ?>
        <?php endif; ?>
    </td></tr>
    <?php $tabs->Buttons(); ?>
    <button type="submit" class="adm-btn adm-btn-save" name="action" value="save_config"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_SAVE'))?></button>
    <button type="submit" class="adm-btn" name="action" value="run_audit"><?=htmlspecialcharsbx((string)Loc::getMessage('BITRIX_ARIADA_RUN'))?></button>
    <?php $tabs->End(); ?>
</form>
<?php require_once $_SERVER['DOCUMENT_ROOT'] . '/bitrix/modules/main/include/epilog_admin.php'; ?>
