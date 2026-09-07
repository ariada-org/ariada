<?php

defined('C5_EXECUTE') or die('Access Denied.');

/**
 * All report, setting, and message strings are pre-escaped by DashboardPresenter.
 * Only framework-generated action URLs are escaped locally for attribute context.
 *
 * @var array<string, mixed> $settingsView
 * @var array<string, mixed>|null $reportView
 * @var string $safeError
 * @var string $safeSuccess
 * @var Concrete\Core\Page\View\PageView $view
 * @var Concrete\Core\Validation\CSRF\Token $token
 */
$attribute = static function ($value): string {
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
};
?>

<style>
    .ariada-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
    .ariada-card { border: 1px solid #d9dee3; border-radius: 6px; padding: 14px; background: #fff; }
    .ariada-card strong { display: block; font-size: 1.5rem; }
    .ariada-status { border-left: 6px solid #6c757d; padding: 18px; background: #f7f8f9; margin-bottom: 20px; }
    .ariada-status--pass { border-left-color: #198754; }
    .ariada-status--fail { border-left-color: #b02a37; }
    .ariada-meta { color: #5c6670; overflow-wrap: anywhere; }
    .ariada-settings { margin-top: 28px; }
    @media (max-width: 900px) { .ariada-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>

<?php if ($safeError !== '') { ?>
    <div class="alert alert-danger" role="alert" aria-live="assertive"><?= $safeError ?></div>
<?php } ?>
<?php if ($safeSuccess !== '') { ?>
    <div class="alert alert-success" role="status"><?= $safeSuccess ?></div>
<?php } ?>

<?php if ($reportView !== null) { ?>
    <section aria-labelledby="ariada-result-heading">
        <div class="ariada-status <?= $reportView['passed'] ? 'ariada-status--pass' : 'ariada-status--fail' ?>">
            <h2 id="ariada-result-heading"><?= t('Accessibility result') ?>: <?= $reportView['statusLabel'] ?></h2>
            <div class="ariada-meta"><?= $reportView['url'] ?></div>
            <div class="ariada-meta">
                <?= t('Completed') ?>: <?= $reportView['completedAt'] ?>,
                <?= (int) $reportView['durationMs'] ?> ms
                <?php if ($reportView['scanId'] !== '') { ?>
                    | <?= t('Scan ID') ?>: <?= $reportView['scanId'] ?>
                <?php } ?>
            </div>
        </div>

        <div class="ariada-grid" aria-label="<?= $attribute(t('Violation counts')) ?>">
            <div class="ariada-card"><span><?= t('Total') ?></span><strong><?= (int) $reportView['total'] ?></strong></div>
            <div class="ariada-card"><span><?= t('Critical') ?></span><strong><?= (int) $reportView['byImpact']['critical'] ?></strong></div>
            <div class="ariada-card"><span><?= t('Serious') ?></span><strong><?= (int) $reportView['byImpact']['serious'] ?></strong></div>
            <div class="ariada-card"><span><?= t('Moderate') ?></span><strong><?= (int) $reportView['byImpact']['moderate'] ?></strong></div>
            <div class="ariada-card"><span><?= t('Minor') ?></span><strong><?= (int) $reportView['byImpact']['minor'] ?></strong></div>
        </div>

        <h3><?= t('Top violations') ?></h3>
        <?php if ($reportView['violations'] === []) { ?>
            <p><?= t('No violations were reported.') ?></p>
        <?php } else { ?>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th scope="col"><?= t('Rule') ?></th>
                            <th scope="col"><?= t('Severity') ?></th>
                            <th scope="col"><?= t('Count') ?></th>
                            <th scope="col"><?= t('Message') ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($reportView['violations'] as $violation) { ?>
                            <tr>
                                <td><code><?= $violation['ruleId'] ?></code></td>
                                <td><?= $violation['severity'] ?></td>
                                <td><?= (int) $violation['count'] ?></td>
                                <td><?= $violation['message'] ?></td>
                            </tr>
                        <?php } ?>
                    </tbody>
                </table>
            </div>
        <?php } ?>
    </section>
<?php } else { ?>
    <div class="alert alert-info" role="status">
        <?= t('Save settings, then load a CI report or run the external Ariada CLI.') ?>
    </div>
<?php } ?>

<section class="ariada-settings" aria-labelledby="ariada-settings-heading">
    <h2 id="ariada-settings-heading"><?= t('Ariada settings') ?></h2>
    <form method="post" action="<?= $attribute($view->action('save')) ?>">
        <?php $token->output('concrete_ariada_save'); ?>

        <div class="form-group mb-3">
            <label class="form-label" for="ariada-mode"><?= t('Input mode') ?></label>
            <select class="form-select" id="ariada-mode" name="mode" required>
                <option value="report" <?= $settingsView['mode'] === 'report' ? 'selected' : '' ?>><?= t('CI report file (recommended)') ?></option>
                <option value="cli" <?= $settingsView['mode'] === 'cli' ? 'selected' : '' ?>><?= t('Run external Ariada CLI') ?></option>
            </select>
            <div class="form-text"><?= t('PHP never scans the site. It parses a report or starts the external CLI without a shell.') ?></div>
        </div>

        <div class="form-group mb-3">
            <label class="form-label" for="ariada-site-url"><?= t('Site URL') ?></label>
            <input class="form-control" id="ariada-site-url" name="site_url" type="url" maxlength="2048" required value="<?= $settingsView['siteUrl'] ?>">
        </div>

        <div class="form-group mb-3">
            <label class="form-label" for="ariada-report-filename"><?= t('CI report filename') ?></label>
            <input class="form-control" id="ariada-report-filename" name="report_filename" type="text" maxlength="128" required value="<?= $settingsView['reportFilename'] ?>">
            <div class="form-text"><?= t('The file must be inside the package-configured report directory and use the Ariada cli-scan.v1 schema.') ?></div>
        </div>

        <div class="row">
            <div class="col-md-4 mb-3">
                <label class="form-label" for="ariada-browser"><?= t('Browser') ?></label>
                <select class="form-select" id="ariada-browser" name="browser">
                    <?php foreach (['chromium', 'firefox', 'webkit'] as $browser) { ?>
                        <option value="<?= $browser ?>" <?= $settingsView['browser'] === $browser ? 'selected' : '' ?>><?= $browser ?></option>
                    <?php } ?>
                </select>
            </div>
            <div class="col-md-4 mb-3">
                <label class="form-label" for="ariada-threshold"><?= t('Failure threshold') ?></label>
                <select class="form-select" id="ariada-threshold" name="severity_threshold">
                    <?php foreach (['minor', 'moderate', 'serious', 'critical'] as $severity) { ?>
                        <option value="<?= $severity ?>" <?= $settingsView['severityThreshold'] === $severity ? 'selected' : '' ?>><?= $severity ?></option>
                    <?php } ?>
                </select>
            </div>
            <div class="col-md-4 mb-3">
                <label class="form-label" for="ariada-timeout"><?= t('Navigation timeout (ms)') ?></label>
                <input class="form-control" id="ariada-timeout" name="navigation_timeout_ms" type="number" min="1000" max="120000" required value="<?= (int) $settingsView['navigationTimeoutMs'] ?>">
            </div>
        </div>

        <button class="btn btn-primary" type="submit"><?= t('Save settings') ?></button>
    </form>

    <form class="mt-3" method="post" action="<?= $attribute($view->action('run_scan')) ?>">
        <?php $token->output('concrete_ariada_run'); ?>
        <button class="btn btn-secondary" type="submit">
            <?= $settingsView['mode'] === 'report' ? t('Load CI report') : t('Run Ariada CLI') ?>
        </button>
    </form>
</section>
