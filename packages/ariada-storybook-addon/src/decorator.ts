// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2
/* eslint-disable jsdoc/require-jsdoc */

import { EVENTS } from './constants.js';
import { defaultStoryScanner, type StoryScanner } from './scan.js';

export interface StorybookChannel {
  emit(eventName: string, payload: unknown): void;
}

export interface StoryContextLike {
  id?: string;
  name?: string;
  title?: string;
  canvasElement?: ElementLike;
  viewMode?: string;
  globals?: Record<string, unknown>;
}

export interface ElementLike {
  innerHTML: string;
  ownerDocument?: { location?: { href?: string } };
}

export type StoryFunction = () => unknown;

export interface AriadaDecoratorOptions {
  scanner?: StoryScanner;
  channel?: StorybookChannel;
  enabled?: boolean;
}

export function createAriadaDecorator(options: AriadaDecoratorOptions = {}) {
  const scanner = options.scanner ?? defaultStoryScanner;
  const enabled = options.enabled ?? true;

  return async function ariadaDecorator(story: StoryFunction, context: StoryContextLike) {
    const rendered = story();
    if (!enabled || context.viewMode === 'docs' || !context.canvasElement) return rendered;

    const storyId = context.id ?? context.name ?? context.title ?? 'unknown-story';
    const url = context.canvasElement.ownerDocument?.location?.href ?? 'storybook://canvas';
    const result = await scanner({
      storyId,
      html: context.canvasElement.innerHTML,
      url,
    });

    options.channel?.emit(EVENTS.scanCompleted, result);
    return rendered;
  };
}
