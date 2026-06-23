<?php

declare(strict_types=1);

namespace Ariada\Symfony\Command;

use Ariada\Symfony\Scanner\AriadaScanner;
use Ariada\Symfony\Scanner\ScanOptions;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'ariada:scan', description: 'Run an Ariada accessibility scan for a Symfony surface.')]
final class AriadaScanCommand extends Command
{
 /**
 * @param list<string> $domains
 */
 public function __construct(
 private readonly AriadaScanner $scanner,
 private readonly ?string $defaultUrl = null,
 private readonly string $outputDir = 'var/ariada-output',
 private readonly string $cliCommand = 'ariada',
 private readonly string $browser = 'chromium',
 private readonly string $severityThreshold = 'moderate',
 private readonly int $timeoutMs = 30000,
 private readonly array $domains = [],
) {
 parent::__construct();
 }

 protected function configure(): void
 {
 $this
 ->addArgument('url', InputArgument::OPTIONAL, 'HTTP or HTTPS URL to scan.')
 ->addOption('output-dir', null, InputOption::VALUE_REQUIRED, 'Directory for Ariada JSON artifacts.')
 ->addOption('cli-command', null, InputOption::VALUE_REQUIRED, 'Ariada CLI command.')
 ->addOption('browser', null, InputOption::VALUE_REQUIRED, 'Browser engine: chromium, firefox or webkit.')
 ->addOption('domains', null, InputOption::VALUE_REQUIRED, 'Comma-separated Ariada domains.')
 ->addOption('severity-threshold', null, InputOption::VALUE_REQUIRED, 'Minimum severity that fails the command.')
 ->addOption('timeout-ms', null, InputOption::VALUE_REQUIRED, 'Per-URL navigation timeout in milliseconds.')
 ->addOption('no-fail', null, InputOption::VALUE_NONE, 'Return zero for scanner findings while preserving runtime failures.');
 }

 protected function execute(InputInterface $input, OutputInterface $output): int
 {
 $io = new SymfonyStyle($input, $output);
 $target = $input->getArgument('url') ?: $this->defaultUrl;
 if (!is_string($target) || trim($target) === '') {
 $io->error('Provide a URL argument or configure ariada_symfony.default_url.');

 return Command::INVALID;
 }

 $options = new ScanOptions(
 outputDir: $this->stringOption($input, 'output-dir', $this->outputDir),
 cliCommand: $this->stringOption($input, 'cli-command', $this->cliCommand),
 browser: $this->stringOption($input, 'browser', $this->browser),
 severityThreshold: $this->stringOption($input, 'severity-threshold', $this->severityThreshold),
 timeoutMs: $this->intOption($input, 'timeout-ms', $this->timeoutMs),
 domains: $this->domainOption($input),
);

 $result = $this->scanner->scan($target, $options);

 $io->title('Ariada Symfony scan');
 $io->definitionList(
 ['Target' => $result->target],
 ['Exit code' => (string) $result->exitCode],
 ['Findings' => (string) $result->totalFindings],
 ['Report' => $result->reportPath ?? 'not written'],
);

 if ($result->stdout !== '') {
 $output->writeln($result->stdout);
 }
 if ($result->stderr !== '') {
 $io->warning($result->stderr);
 }

 if ($input->getOption('no-fail') && $result->gateFailed()) {
 return Command::SUCCESS;
 }

 return $result->exitCode;
 }

 private function stringOption(InputInterface $input, string $name, string $fallback): string
 {
 $value = $input->getOption($name);

 return is_string($value) && $value !== '' ? $value: $fallback;
 }

 private function intOption(InputInterface $input, string $name, int $fallback): int
 {
 $value = $input->getOption($name);

 return is_numeric($value) ? (int) $value: $fallback;
 }

 /**
 * @return list<string>
 */
 private function domainOption(InputInterface $input): array
 {
 $value = $input->getOption('domains');
 if (!is_string($value) || trim($value) === '') {
 return $this->domains;
 }

 return array_values(array_filter(array_map('trim', explode(',', $value))));
 }
}
