<?php

namespace Concrete\Package\ConcreteAriada;

defined('C5_EXECUTE') or die('Access Denied.');

use Concrete\Core\Package\Package;
use Concrete\Core\Page\Single as SinglePage;

final class Controller extends Package
{
    protected $pkgHandle = 'concrete_ariada';
    protected $appVersionRequired = '9.0.0';
    protected $pkgVersion = '1.0.0';

    protected $pkgAutoloaderRegistries = [
        'src' => 'ConcreteAriada',
    ];

    public function getPackageName()
    {
        return t('Ariada Accessibility');
    }

    public function getPackageDescription()
    {
        return t('Displays strict Ariada accessibility scan results in the Concrete dashboard.');
    }

    public function install()
    {
        $package = parent::install();
        $page = SinglePage::add('/dashboard/system/ariada', $package);

        if (is_object($page)) {
            $page->updateCollectionName(t('Ariada Accessibility'));
        }

        return $package;
    }
}
