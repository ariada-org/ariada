<?php
/**
 * Controller that runs an Ariada scan from Joomla administrator.
 */

declare(strict_types=1);

namespace Ariada\Component\Ariada\Administrator\Controller;

defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;
use Joomla\CMS\Router\Route;

class ScanController extends BaseController
{
	public function run(): void
	{
		$this->checkToken();

		if (!$this->app->getIdentity()->authorise('core.manage', 'com_ariada')) {
			$this->setRedirect(Route::_('index.php?option=com_ariada', false), 'Permission denied.', 'error');

			return;
		}

		/** @var \Ariada\Component\Ariada\Administrator\Model\ScanModel $model */
		$model = $this->getModel('Scan');
		$result = $model->runScan();
		$type = !empty($result['ok']) ? 'message' : 'error';
		$message = (string) ($result['message'] ?? $result['error'] ?? 'Scan finished.');

		$this->setRedirect(Route::_('index.php?option=com_ariada&view=scan', false), $message, $type);
	}
}
