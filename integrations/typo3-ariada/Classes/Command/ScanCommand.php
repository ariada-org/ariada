<?php

declare(strict_types=1);

namespace Ariada\Typo3Ariada\Command;

use Ariada\Typo3Ariada\Service\ScanRunner;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'ariada:scan', description: 'Run an Ariada accessibility scan for a URL.')]
final class ScanCommand extends Command
{
    public function __construct(private readonly ScanRunner $scanRunner)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('url', InputArgument::REQUIRED, 'Absolute URL to scan');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $result = $this->scanRunner->scan((string)$input->getArgument('url'));
        if ($result['error'] !== '') {
            $output->writeln('<error>' . $result['error'] . '</error>');
        }
        $output->writeln(json_encode([
            'mode' => $result['mode'],
            'target' => $result['target'],
            'exitCode' => $result['exitCode'],
            'findings' => $result['findings'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $result['exitCode'] === 0 ? Command::SUCCESS : Command::FAILURE;
    }
}
