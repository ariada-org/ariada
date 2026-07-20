<?php
declare(strict_types=1);

namespace Ariada\Commerce\Block\Adminhtml\Scan;

use Ariada\Commerce\Model\ScanRunner;
use Magento\Backend\Block\Template;

final class Panel extends Template
{
    public function __construct(Template\Context $context, private readonly ScanRunner $scanRunner, array $data = [])
    {
        parent::__construct($context, $data);
    }

    /** @return list<string> */
    public function getTargets(): array
    {
        return $this->scanRunner->storefrontTargets((string) $this->getBaseUrl());
    }
}
