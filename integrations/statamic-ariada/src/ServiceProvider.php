<?php

declare(strict_types=1);

// SPDX-FileCopyrightText: 2026 Agonist Development AB
// SPDX-License-Identifier: EUPL-1.2

namespace Ariada\Statamic;

use Statamic\Entries\Entry;
use Statamic\Providers\AddonServiceProvider;

final class ServiceProvider extends AddonServiceProvider {
	public function bootAddon(): void {
		$this->app->singleton('ariada.statamic.scanner', fn () => $this);
	}

	public function renderedEntryUrl(Entry $entry): string {
		$url = $entry->absoluteUrl();
		if (! is_string($url) || '' === $url) {
			throw new \RuntimeException('Statamic entry does not have a rendered absolute URL.');
		}
		return $url;
	}

	public function scanRequest(string $url): array {
		return array(
			'domains' => array('accessibility'),
			'source' => 'statamic.entry-action',
			'url' => $url,
		);
	}
}
