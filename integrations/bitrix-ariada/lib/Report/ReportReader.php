<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Report;

use Bitrix\Ariada\Exception\ModuleException;

final class ReportReader
{
    public const MAX_BYTES = 1048576;

    public function read(string $path): string
    {
        if ($path === '' || strpos($path, "\0") !== false || is_link($path)) {
            throw ModuleException::report();
        }

        $realPath = realpath($path);
        if ($realPath === false || !is_file($realPath) || !is_readable($realPath)) {
            throw ModuleException::report();
        }

        $handle = @fopen($realPath, 'rb');
        if (!is_resource($handle)) {
            throw ModuleException::report();
        }

        try {
            $stat = fstat($handle);
            if (!is_array($stat) || !isset($stat['size']) || $stat['size'] < 2 || $stat['size'] > self::MAX_BYTES) {
                throw ModuleException::report();
            }

            $contents = stream_get_contents($handle, self::MAX_BYTES + 1);
            if (!is_string($contents) || strlen($contents) < 2 || strlen($contents) > self::MAX_BYTES) {
                throw ModuleException::report();
            }
            return $contents;
        } finally {
            fclose($handle);
        }
    }
}
