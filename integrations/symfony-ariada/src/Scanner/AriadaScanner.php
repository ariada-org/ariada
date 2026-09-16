<?php

declare(strict_types=1);

namespace Ariada\Symfony\Scanner;

interface AriadaScanner
{
    public function scan(string $url, ScanOptions $options): ScanResult;
}
