<?php

declare(strict_types=1);

namespace Ariada\Symfony\DependencyInjection;

use Ariada\Symfony\Command\AriadaScanCommand;
use Ariada\Symfony\Scanner\AriadaCliRunner;
use Ariada\Symfony\Scanner\AriadaScanner;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use Symfony\Component\DependencyInjection\Definition;
use Symfony\Component\DependencyInjection\Extension\Extension;
use Symfony\Component\DependencyInjection\Reference;

final class AriadaSymfonyExtension extends Extension
{
    /**
     * @param array<int, array<string, mixed>> $configs
     */
    public function load(array $configs, ContainerBuilder $container): void
    {
        $configuration = new Configuration();
        $config = $this->processConfiguration($configuration, $configs);

        $container->setParameter('ariada_symfony.default_url', $config['default_url']);
        $container->setParameter('ariada_symfony.cli_command', $config['cli_command']);
        $container->setParameter('ariada_symfony.output_dir', $config['output_dir']);
        $container->setParameter('ariada_symfony.browser', $config['browser']);
        $container->setParameter('ariada_symfony.severity_threshold', $config['severity_threshold']);
        $container->setParameter('ariada_symfony.timeout_ms', $config['timeout_ms']);
        $container->setParameter('ariada_symfony.domains', $config['domains']);

        $runner = new Definition(AriadaCliRunner::class);
        $runner->setAutowired(true)->setAutoconfigured(true);
        $container->setDefinition(AriadaCliRunner::class, $runner);
        $container->setAlias(AriadaScanner::class, AriadaCliRunner::class)->setPublic(false);

        $command = new Definition(AriadaScanCommand::class);
        $command
            ->setArguments([
                new Reference(AriadaScanner::class),
                '%ariada_symfony.default_url%',
                '%ariada_symfony.output_dir%',
                '%ariada_symfony.cli_command%',
                '%ariada_symfony.browser%',
                '%ariada_symfony.severity_threshold%',
                '%ariada_symfony.timeout_ms%',
                '%ariada_symfony.domains%',
            ])
            ->addTag('console.command')
            ->setAutowired(false)
            ->setAutoconfigured(false);
        $container->setDefinition(AriadaScanCommand::class, $command);
    }
}
