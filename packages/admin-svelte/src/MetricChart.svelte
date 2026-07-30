<script lang="ts">
  // SPDX-FileCopyrightText: 2026 Agonist Development AB
  // SPDX-License-Identifier: EUPL-1.2
  //
  // <MetricChart> — a declarable, dependency-free chart. A board declares an
  // AdminChartSpec the same way it declares columns, and this shared renderer
  // draws column / line / funnel from the SAME rows, or a `graph` relationship
  // map from nodes + edges. Inline SVG: no chart library in the dependency graph.
  // The spec is the stable seam, so a heavier backend can swap in behind it.
  import type { AdminChartSpec } from '@ariada-org/admin-surface';

  import {
    CHART_PADDING,
    chartColor,
    chartValueKeys,
    graphLayout,
    plotLayout,
  } from './chart';
  import { formatInteger, type AdminGridRow } from './format';
  import { resolveI18n, type AdminSvelteI18n } from './i18n';
  import { DEFAULT_ACCENT } from './theme';

  let {
    spec,
    rows = [],
    accent = DEFAULT_ACCENT,
    i18n: i18nOverrides,
  }: {
    spec: AdminChartSpec;
    /** the same rows the grid renders; ignored for `type: 'graph'`. */
    rows?: readonly AdminGridRow[];
    accent?: string;
    i18n?: AdminSvelteI18n;
  } = $props();

  const i18n = $derived(resolveI18n(i18nOverrides));
  const valueKeys = $derived(chartValueKeys(spec));
  const isGraph = $derived(spec.type === 'graph');
  const plot = $derived(isGraph ? null : plotLayout(spec, rows));
  const graph = $derived(isGraph ? graphLayout(spec, accent) : null);
  const width = $derived(isGraph ? (graph?.width ?? 300) : (plot?.width ?? 300));
  const height = $derived(isGraph ? (graph?.height ?? 200) : (plot?.height ?? 200));
  const isEmpty = $derived(isGraph ? (graph?.nodes.length ?? 0) === 0 : (plot?.categories.length ?? 0) === 0);

  let hover = $state<number | null>(null);
  // Unique per instance so two charts on one board cannot share a gradient id.
  const uid = `adm-chart-${Math.random().toString(36).slice(2, 8)}`;
  const color = (index: number) => chartColor(spec, index, accent);
</script>

<div class="adm-chart">
  {#if spec.title || valueKeys.length > 1 || spec.unit}
    <div class="adm-chart-head">
      {#if spec.title}<span class="adm-chart-title">{spec.title}</span>{/if}
      {#if valueKeys.length > 1}
        <span class="adm-chart-legend">
          {#each valueKeys as key, index (key)}
            <span><span class="adm-swatch" style="background:{color(index)}"></span>{key}</span>
          {/each}
        </span>
      {/if}
      {#if spec.unit}<span class="adm-chart-unit">{spec.unit}</span>{/if}
    </div>
  {/if}

  {#if isEmpty}
    <div class="adm-chart-empty" style="height:{height}px">{i18n.noData}</div>
  {:else}
    <svg
      width="100%"
      {height}
      viewBox="0 0 {width} {height}"
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={spec.title ?? spec.type}
      onmouseleave={() => (hover = null)}
    >
      <defs>
        {#each valueKeys as key, index (key)}
          <linearGradient id="{uid}-{index}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={color(index)} stop-opacity="1" />
            <stop offset="100%" stop-color={color(index)} stop-opacity="0.55" />
          </linearGradient>
        {/each}
      </defs>

      {#if isGraph && graph}
        {#each graph.edges as edge, index (index)}
          <line
            x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
            stroke="var(--adm-border-strong)" stroke-width="1.2"
          ><title>{edge.label}</title></line>
        {/each}
        {#each graph.nodes as node (node.id)}
          <g>
            <circle cx={node.x} cy={node.y} r="8" fill={node.color}
                    stroke="var(--adm-surface)" stroke-width="1.5"><title>{node.label}</title></circle>
            <text x={node.x} y={node.y - 12} font-size="9" fill="var(--adm-muted)" text-anchor="middle">
              {node.label.slice(0, 14)}
            </text>
          </g>
        {/each}
      {:else if plot}
        <line
          x1={CHART_PADDING.left} y1={plot.baselineY + 0.5} x2={width} y2={plot.baselineY + 0.5}
          stroke="var(--adm-border)" stroke-width="1"
        />
        {#if spec.type === 'line'}
          {#each plot.lines as points, index (index)}
            <polyline {points} fill="none" stroke={color(index)} stroke-width="2"
                      stroke-linejoin="round" stroke-linecap="round" />
          {/each}
        {/if}
        {#each plot.categories as category (category.index)}
          <g>
            <!-- hover band = crosshair target for the whole category -->
            <rect
              x={category.bandX} y={CHART_PADDING.top}
              width={category.bandWidth} height={plot.plotHeight}
              fill={hover === category.index ? 'var(--adm-primary)' : 'transparent'}
              opacity={hover === category.index ? 0.06 : 0}
              role="presentation"
              onmouseenter={() => (hover = category.index)}
            />
            {#if spec.type !== 'line'}
              {#each category.bars as bar (bar.key)}
                <rect
                  x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx="3"
                  fill="url(#{uid}-{bar.seriesIndex})"
                  pointer-events="none"
                  style="transform-origin: 0 100%; animation: adm-grow-y 600ms var(--adm-ease-out) {category.index * 22}ms both; opacity:{hover === null || hover === category.index ? 1 : 0.45}; transition: opacity var(--adm-dur-fast)"
                ><title>{bar.key} · {category.label}: {formatInteger(bar.value)}</title></rect>
              {/each}
            {/if}
            {#if category.rate !== undefined && category.bars[0]}
              <text x={category.centerX} y={category.bars[0].y - 4} font-size="10"
                    fill="var(--adm-fg-soft)" text-anchor="middle" pointer-events="none">
                {category.rate}%
              </text>
            {/if}
            <text
              x={category.centerX} y={height - 8} font-size="9.5" text-anchor="middle" pointer-events="none"
              fill={hover === category.index ? 'var(--adm-fg)' : 'var(--adm-muted)'}
            >{category.label.slice(0, 8)}</text>
          </g>
        {/each}
      {/if}
    </svg>

    {#if !isGraph && plot && hover !== null}
      {@const active = plot.categories[hover]}
      {#if active}
        <div class="adm-card adm-chart-tooltip adm-anim-pop">
          <b>{active.label}</b>
          {#each active.bars as bar (bar.key)}
            <span>
              <span class="adm-swatch" style="background:{color(bar.seriesIndex)}"></span>
              {bar.key}: <b>{formatInteger(bar.value)}</b>
            </span>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  /* SVG bars must scale from their own baseline, not the viewport origin. */
  svg rect { transform-box: fill-box; }
</style>
