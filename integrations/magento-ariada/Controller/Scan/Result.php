<?php
declare(strict_types=1);

namespace Ariada\Commerce\Controller\Scan;

use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Action\Context;
use Magento\Framework\Controller\ResultInterface;
use Magento\Framework\View\Result\PageFactory;

final class Result extends Action
{
    public function __construct(Context $context, private readonly PageFactory $pageFactory)
    {
        parent::__construct($context);
    }

    public function execute(): ResultInterface
    {
        $page = $this->pageFactory->create();
        $page->getConfig()->getTitle()->prepend(__('Ariada storefront scan result'));
        return $page;
    }
}
