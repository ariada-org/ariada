<?php
/**
 * Scan model for administrator view state.
 */

declare(strict_types=1);

namespace Ariada\Component\Ariada\Administrator\Model;

defined('_JEXEC') or die;

use Ariada\Component\Ariada\Administrator\Service\ScanRunner;
use Joomla\CMS\Component\ComponentHelper;
use Joomla\CMS\Factory;
use Joomla\CMS\MVC\Model\BaseDatabaseModel;

class ScanModel extends BaseDatabaseModel
{
	public function getResult(): array
	{
		return (array) Factory::getApplication()->getUserState('com_ariada.scan.result', []);
	}

	public function getRuntime(): array
	{
		return (new ScanRunner())->detectRuntime();
	}

	public function runScan(): array
	{
		$params = ComponentHelper::getParams('com_ariada');
		$result = (new ScanRunner())->run($params);

		Factory::getApplication()->setUserState('com_ariada.scan.result', $result);

		return $result;
	}
}
