<?php

declare(strict_types=1);

namespace Ariada\Typo3Ariada\Controller;

use Ariada\Typo3Ariada\Service\ScanRunner;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Attribute\AsController;
use TYPO3\CMS\Backend\Template\ModuleTemplateFactory;

#[AsController]
final readonly class BackendModuleController
{
    public function __construct(
        private ModuleTemplateFactory $moduleTemplateFactory,
        private ScanRunner $scanRunner,
    ) {
    }

    public function handleRequest(ServerRequestInterface $request): ResponseInterface
    {
        $query = $request->getQueryParams();
        $body = $request->getParsedBody();
        $form = is_array($body) ? $body : [];
        $target = (string)($form['target'] ?? $query['target'] ?? '');
        $result = null;

        if (($form['scan'] ?? '') === '1') {
            $result = $this->scanRunner->scan($target);
        }

        $view = $this->moduleTemplateFactory->create($request);
        $view->setTitle('Ariada Accessibility Scanner');
        $view->assignMultiple([
            'target' => $target,
            'result' => $result,
            'findings' => is_array($result) ? $result['findings'] : [],
        ]);

        return $view->renderResponse('Backend/Index');
    }
}
