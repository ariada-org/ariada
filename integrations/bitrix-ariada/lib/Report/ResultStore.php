<?php
declare(strict_types=1);

namespace Bitrix\Ariada\Report;

use Bitrix\Ariada\Config\ModuleConfig;
use Bitrix\Ariada\Exception\ModuleException;
use Bitrix\Main\Config\Option;

final class ResultStore
{
    private const OPTION_NAME = 'last_result';
    private const MAX_BYTES = 65536;

    public function save(ScanViewModel $viewModel): void
    {
        try {
            $json = json_encode($viewModel->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $exception) {
            throw ModuleException::report('The reduced scan result could not be stored.');
        }
        if (!is_string($json) || strlen($json) > self::MAX_BYTES) {
            throw ModuleException::report('The reduced scan result could not be stored.');
        }
        Option::set(ModuleConfig::MODULE_ID, self::OPTION_NAME, $json);
    }

    public function load(): ?ScanViewModel
    {
        $json = Option::get(ModuleConfig::MODULE_ID, self::OPTION_NAME, '');
        if ($json === '') {
            return null;
        }
        if (strlen($json) > self::MAX_BYTES) {
            throw ModuleException::report('The stored scan summary is invalid.');
        }
        try {
            $data = json_decode($json, true, 16, JSON_THROW_ON_ERROR);
            if (!is_array($data)) {
                throw new \InvalidArgumentException('Invalid stored result.');
            }
            return ScanViewModel::fromArray($data);
        } catch (\Throwable $exception) {
            throw ModuleException::report('The stored scan summary is invalid.');
        }
    }
}
