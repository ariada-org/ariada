<?php
/**
 * Administrator scan view.
 */

declare(strict_types=1);

namespace Ariada\Component\Ariada\Administrator\View\Scan;

defined('_JEXEC') or die;

use Joomla\CMS\MVC\View\HtmlView as BaseHtmlView;

class HtmlView extends BaseHtmlView
{
	public array $result = [];
	public array $runtime = [];

	public function display($tpl = null): void
	{
		$this->result = (array) $this->get('Result');
		$this->runtime = (array) $this->get('Runtime');

		parent::display($tpl);
	}
}
