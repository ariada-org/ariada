<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace ariada\craft;

use Craft;
use craft\base\Plugin as CraftPlugin;
use craft\elements\Entry;

final class Plugin extends CraftPlugin {
	public string $schemaVersion = '0.1.0';

	public function init(): void {
		parent::init();
		Craft::info('Ariada Craft plugin loaded.', __METHOD__);
	}

	public function renderedEntryUrl(Entry $entry): string {
		$site = $entry->getSite();
		$base = rtrim((string) $site->baseUrl, '/');
		$uri = ltrim((string) $entry->uri, '/');
		return $uri === '' ? $base . '/' : $base . '/' . $uri;
	}

	public function scanRequest(string $url): array {
		return array(
			'domains' => array('accessibility'),
			'source' => 'craft.entry',
			'url' => $url,
		);
	}
}
