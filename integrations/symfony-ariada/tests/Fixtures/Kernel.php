<?php

declare(strict_types=1);

namespace Ariada\Symfony\Tests\Fixtures;

use Ariada\Symfony\AriadaSymfonyBundle;
use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Component\Config\Loader\LoaderInterface;
use Symfony\Component\HttpKernel\Kernel as BaseKernel;

final class Kernel extends BaseKernel
{
 public function registerBundles(): iterable
 {
 return [
 new FrameworkBundle(),
 new AriadaSymfonyBundle(),
 ];
 }

 public function registerContainerConfiguration(LoaderInterface $loader): void
 {
 $loader->load(static function ($container): void {
 $container->loadFromExtension('framework', [
 'test' => true,
 'secret' => 'ariada-test',
 ]);
 $container->loadFromExtension('ariada_symfony', [
 'default_url' => 'https://symfony.example.test',
 'output_dir' => sys_get_temp_dir(). '/ariada-symfony-output',
 'domains' => ['accessibility'],
 ]);
 });
 }
}
