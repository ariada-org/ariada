<?php
/**
 * Ariada administrator scan page.
 */

declare(strict_types=1);

defined('_JEXEC') or die;

use Joomla\CMS\Factory;
use Joomla\CMS\HTML\HTMLHelper;
use Joomla\CMS\Language\Text;
use Joomla\CMS\Router\Route;
use Joomla\CMS\Uri\Uri;

$document = Factory::getApplication()->getDocument();
$document->getWebAssetManager()->registerAndUseStyle('com_ariada.admin', Uri::root(true) . '/media/com_ariada/admin.css');

$result = $this->result;
$runtime = $this->runtime;
?>
<div class="com-ariada">
	<h1><?php echo Text::_('COM_ARIADA_TITLE'); ?></h1>

	<section class="com-ariada__panel">
		<h2><?php echo Text::_('COM_ARIADA_SCAN_HEADING'); ?></h2>
		<p><?php echo Text::_('COM_ARIADA_SCAN_INTRO'); ?></p>
		<form action="<?php echo Route::_('index.php?option=com_ariada&task=scan.run'); ?>" method="post">
			<button class="btn btn-primary" type="submit"><?php echo Text::_('COM_ARIADA_RUN_SCAN'); ?></button>
			<?php echo HTMLHelper::_('form.token'); ?>
		</form>
		<p>
			<a href="<?php echo Route::_('index.php?option=com_config&view=component&component=com_ariada'); ?>">
				<?php echo Text::_('COM_ARIADA_OPEN_OPTIONS'); ?>
			</a>
		</p>
	</section>

	<section class="com-ariada__runtime" aria-labelledby="com-ariada-runtime">
		<h2 id="com-ariada-runtime"><?php echo Text::_('COM_ARIADA_RUNTIME_HEADING'); ?></h2>
		<ul>
			<li><?php echo Text::_('COM_ARIADA_RUNTIME_PROC_OPEN'); ?>: <?php echo !empty($runtime['procOpen']) ? Text::_('JYES') : Text::_('JNO'); ?></li>
			<li><?php echo Text::_('COM_ARIADA_RUNTIME_NODE'); ?>: <?php echo !empty($runtime['node']) ? Text::_('JYES') : Text::_('JNO'); ?></li>
			<li><?php echo Text::_('COM_ARIADA_RUNTIME_CLI'); ?>: <?php echo !empty($runtime['ariada']) ? Text::_('JYES') : Text::_('JNO'); ?></li>
		</ul>
	</section>

	<?php if (!empty($result)) : ?>
		<section class="com-ariada__report" aria-labelledby="com-ariada-report">
			<h2 id="com-ariada-report"><?php echo Text::_('COM_ARIADA_REPORT_HEADING'); ?></h2>
			<p><?php echo Text::sprintf('COM_ARIADA_REPORT_MODE', htmlspecialchars((string) ($result['mode'] ?? 'unknown'), ENT_QUOTES, 'UTF-8')); ?></p>
			<?php if (!empty($result['report'])) : ?>
				<pre><?php echo htmlspecialchars($result['report'], ENT_QUOTES, 'UTF-8'); ?></pre>
			<?php else : ?>
				<p><?php echo htmlspecialchars((string) ($result['error'] ?? 'No report returned.'), ENT_QUOTES, 'UTF-8'); ?></p>
			<?php endif; ?>
		</section>
	<?php endif; ?>
</div>
