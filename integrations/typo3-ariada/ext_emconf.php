<?php

declare(strict_types=1);

$EM_CONF[$_EXTKEY] = [
    'title' => 'Ariada Accessibility Scanner',
    'description' => 'TYPO3 backend module and CLI command for Ariada accessibility scans.',
    'category' => 'module',
    'author' => 'Alexander Brichkin (Agonist Development AB)',
    'author_email' => 'git@ariada.org',
    'state' => 'alpha',
    'clearCacheOnLoad' => true,
    'version' => '0.1.0',
    'constraints' => [
        'depends' => [
            'typo3' => '12.4.0-13.4.99',
            'php' => '8.1.0-8.4.99',
        ],
    ],
];
