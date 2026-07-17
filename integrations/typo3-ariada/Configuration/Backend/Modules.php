<?php

declare(strict_types=1);

use Ariada\Typo3Ariada\Controller\BackendModuleController;

return [
    'web_ariada' => [
        'parent' => 'web',
        'position' => ['after' => 'web_info'],
        'access' => 'user',
        'workspaces' => 'live',
        'path' => '/module/web/ariada',
        'labels' => 'LLL:EXT:typo3_ariada/Resources/Private/Language/locallang_mod.xlf',
        'extensionName' => 'Typo3Ariada',
        'iconIdentifier' => 'actions-system-extension-configure',
        'routes' => [
            '_default' => [
                'target' => BackendModuleController::class . '::handleRequest',
            ],
        ],
    ],
];
