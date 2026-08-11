// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
//
// Chart geometry for <MetricChart>. Pure functions, no DOM and no chart
// library: an AdminChartSpec plus rows in, coordinates out. Keeping the maths
// here means the layout is unit-testable and the Svelte component stays a thin
// mapping from coordinates to SVG.
import {
  ADMIN_CHART_DEFAULT_CATEGORY_KEY,
  ADMIN_CHART_DEFAULT_HEIGHT,
  ADMIN_CHART_DEFAULT_MAX_CATEGORIES,
  type AdminChartSpec,
} from '@ariada-org/admin-surface';

import { toNumber, type AdminGridRow } from './format';

/** fallback series palette when a spec does not declare colours. */
export const CHART_PALETTE = Object.freeze([
  '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2',
]);

export const CHART_PADDING = Object.freeze({ left: 8, bottom: 26, top: 10 });
const CATEGORY_SLOT = 44;
const FUNNEL_SLOT = 90;
const MIN_CHART_WIDTH = 280;

/** the colour of series/group `index`: spec colours first, then the palette. */
export function chartColor(spec: AdminChartSpec, index: number, accent: string): string {
  const declared = spec.colors?.[index];
  if (declared) return declared;
  if (index === 0) return accent;
  const fallback = CHART_PALETTE[index % CHART_PALETTE.length];
  return fallback ?? accent;
}

export function chartHeight(spec: AdminChartSpec): number {
  return spec.height ?? ADMIN_CHART_DEFAULT_HEIGHT;
}

export function chartCategoryKey(spec: AdminChartSpec): string {
  return spec.categoryKey ?? ADMIN_CHART_DEFAULT_CATEGORY_KEY;
}

export function chartValueKeys(spec: AdminChartSpec): readonly string[] {
  return spec.valueKeys ?? [];
}

/** the rows a chart actually plots, capped so a dense board stays readable. */
export function chartCategories(spec: AdminChartSpec, rows: readonly AdminGridRow[]): AdminGridRow[] {
  if (spec.type === 'graph') return [];
  return rows.slice(0, spec.maxCategories ?? ADMIN_CHART_DEFAULT_MAX_CATEGORIES);
}

/** the Y scale ceiling (never 0, so a flat series still renders a baseline). */
export function chartMax(spec: AdminChartSpec, categories: readonly AdminGridRow[]): number {
  const values = categories.flatMap((row) => chartValueKeys(spec).map((key) => toNumber(row[key])));
  return Math.max(1, ...values);
}

/** intrinsic plot width; the SVG scales it to the container via viewBox. */
export function chartWidth(spec: AdminChartSpec, categoryCount: number): number {
  const slot = spec.type === 'funnel'
    ? FUNNEL_SLOT
    : CATEGORY_SLOT * Math.max(1, chartValueKeys(spec).length);
  return Math.max(MIN_CHART_WIDTH, categoryCount * slot + CHART_PADDING.left);
}

export interface PlotBar {
  readonly seriesIndex: number;
  readonly key: string;
  readonly value: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlotCategory {
  readonly index: number;
  readonly label: string;
  /** the hover band (full-height crosshair target) for this category. */
  readonly bandX: number;
  readonly bandWidth: number;
  readonly centerX: number;
  readonly bars: readonly PlotBar[];
  /** funnel only: conversion against the first category, in percent. */
  readonly rate?: number;
}

export interface PlotLayout {
  readonly width: number;
  readonly height: number;
  readonly plotHeight: number;
  readonly baselineY: number;
  readonly max: number;
  readonly categories: readonly PlotCategory[];
  /** one polyline point string per series (line charts). */
  readonly lines: readonly string[];
}

const label = (value: unknown): string => (value == null ? '—' : String(value));

/** Column / line / funnel geometry in one pass. */
export function plotLayout(spec: AdminChartSpec, rows: readonly AdminGridRow[]): PlotLayout {
  const categories = chartCategories(spec, rows);
  const valueKeys = chartValueKeys(spec);
  const categoryKey = chartCategoryKey(spec);
  const height = chartHeight(spec);
  const width = chartWidth(spec, categories.length);
  const plotHeight = Math.max(1, height - CHART_PADDING.bottom - CHART_PADDING.top);
  const max = chartMax(spec, categories);
  const groupWidth = (width - CHART_PADDING.left) / Math.max(1, categories.length);
  const isFunnel = spec.type === 'funnel';
  const firstKey = valueKeys[0] ?? '';
  const firstValue = categories.length > 0 ? toNumber(categories[0]?.[firstKey]) : 0;
  const barWidth = isFunnel
    ? Math.max(3, groupWidth - 12)
    : Math.max(3, (groupWidth - 10) / Math.max(1, valueKeys.length));

  const laidOut: PlotCategory[] = categories.map((row, index) => {
    const bandX = CHART_PADDING.left + index * groupWidth;
    const keys = isFunnel ? valueKeys.slice(0, 1) : valueKeys;
    const bars: PlotBar[] = keys.map((key, seriesIndex) => {
      const value = toNumber(row[key]);
      const barHeight = (value / max) * plotHeight;
      return {
        seriesIndex,
        key,
        value,
        x: isFunnel ? bandX + 6 : bandX + 5 + seriesIndex * barWidth,
        y: CHART_PADDING.top + plotHeight - barHeight,
        width: isFunnel ? barWidth : Math.max(2, barWidth - 2),
        height: barHeight,
      };
    });
    const category: PlotCategory = {
      index,
      label: label(row[categoryKey]),
      bandX,
      bandWidth: groupWidth,
      centerX: bandX + groupWidth / 2,
      bars,
      ...(isFunnel
        ? { rate: index === 0 ? 100 : Math.round((toNumber(row[firstKey]) / (firstValue || 1)) * 100) }
        : {}),
    };
    return category;
  });

  const lines = spec.type === 'line'
    ? valueKeys.map((key) => laidOut
      .map((category, index) => {
        const value = toNumber(categories[index]?.[key]);
        return `${category.centerX},${CHART_PADDING.top + plotHeight - (value / max) * plotHeight}`;
      })
      .join(' '))
    : [];

  return {
    width,
    height,
    plotHeight,
    baselineY: CHART_PADDING.top + plotHeight,
    max,
    categories: laidOut,
    lines,
  };
}

export interface GraphNodePoint {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
}

export interface GraphEdgeLine {
  readonly label: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly GraphNodePoint[];
  readonly edges: readonly GraphEdgeLine[];
}

const GRAPH_RADIUS_INSET = 34;

/**
 * Relationship map: nodes on a circle, edges as chords. Zero-dependency by
 * design — a richer graph engine can swap in later behind the SAME spec.
 */
export function graphLayout(spec: AdminChartSpec, accent: string): GraphLayout {
  const height = chartHeight(spec);
  const nodes = spec.nodes ?? [];
  const width = Math.max(MIN_CHART_WIDTH, height * 1.7);
  if (nodes.length === 0) return { width, height, nodes: [], edges: [] };

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(10, Math.min(cx, cy) - GRAPH_RADIUS_INSET);
  const groups = [...new Set(nodes.map((node) => node.group ?? ''))];
  const positions = new Map<string, { x: number; y: number }>();
  const points: GraphNodePoint[] = nodes.map((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    positions.set(node.id, { x, y });
    return {
      id: node.id,
      label: node.label ?? node.id,
      color: chartColor(spec, Math.max(0, groups.indexOf(node.group ?? '')), accent),
      x,
      y,
    };
  });

  const edges: GraphEdgeLine[] = [];
  for (const edge of spec.edges ?? []) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    edges.push({
      label: edge.label ?? `${edge.from} → ${edge.to}`,
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
    });
  }
  return { width, height, nodes: points, edges };
}
