<?php

declare(strict_types=1);

namespace Ariada\Symfony\Tests\Command;

use Ariada\Symfony\Tests\Fixtures\Kernel;
use PHPUnit\Framework\TestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;

final class AriadaBundleKernelTest extends TestCase
{
 public function testBundleRegistersTheConsoleCommandInAMinimalKernel(): void
 {
 $kernel = new Kernel('test', true);
 $kernel->boot();

 try {
 $application = new Application($kernel);

 self::assertTrue($application->has('ariada:scan'));
 } finally {
 $kernel->shutdown();
 }
 }
}
