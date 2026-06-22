<?php
/**
 * Default administrator controller.
 */

declare(strict_types=1);

namespace Ariada\Component\Ariada\Administrator\Controller;

defined('_JEXEC') or die;

use Joomla\CMS\MVC\Controller\BaseController;

class DisplayController extends BaseController
{
	protected $default_view = 'scan';
}
