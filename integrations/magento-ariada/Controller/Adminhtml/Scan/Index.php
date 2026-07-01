<?php
declare(strict_types=1);

namespace Ariada\Commerce\Controller\Adminhtml\Scan;

use Magento\Backend\App\Action;
use Magento\Framework\Controller\ResultInterface;
use Magento\Framework\View\Result\PageFactory;

final class Index extends Action
{
    public const ADMIN_RESOURCE = 'Ariada_Commerce::scan';

    public function __construct(Action\Context $context, private readonly PageFactory $pageFactory)
    {
        parent::__construct($context);
    }

    public function execute(): ResultInterface
    {
        $page = $this->pageFactory->create();
        $page->getConfig()->getTitle()->prepend(__('Ariada Magento Scan'));
        return $page;
    }
}
