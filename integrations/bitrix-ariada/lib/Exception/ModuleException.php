<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Exception;

final class ModuleException extends \RuntimeException
{
    public static function configuration(string $message): self
    {
        return new self($message);
    }

    public static function process(string $message = 'The Ariada CLI could not complete the scan.'): self
    {
        return new self($message);
    }

    public static function report(string $message = 'The Ariada JSON report is missing or invalid.'): self
    {
        return new self($message);
    }
}
