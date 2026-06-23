<?php

declare(strict_types=1);

namespace Ariada\Symfony\DependencyInjection;

use Symfony\Component\Config\Definition\Builder\TreeBuilder;
use Symfony\Component\Config\Definition\ConfigurationInterface;

final class Configuration implements ConfigurationInterface
{
 public function getConfigTreeBuilder(): TreeBuilder
 {
 $treeBuilder = new TreeBuilder('ariada_symfony');
 $root = $treeBuilder->getRootNode();

 $root
 ->children()
 ->scalarNode('default_url')->defaultNull()->end()
 ->scalarNode('cli_command')->defaultValue('ariada')->end()
 ->scalarNode('output_dir')->defaultValue('%kernel.project_dir%/var/ariada-output')->end()
 ->scalarNode('browser')->defaultValue('chromium')->end()
 ->scalarNode('severity_threshold')->defaultValue('moderate')->end()
 ->integerNode('timeout_ms')->defaultValue(30000)->end()
 ->arrayNode('domains')
 ->scalarPrototype()->end()
 ->defaultValue([])
 ->end()
 ->end();

 return $treeBuilder;
 }
}
