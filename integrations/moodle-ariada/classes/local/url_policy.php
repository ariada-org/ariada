<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

namespace local_ariada\local;

/**
 * Restricts targets to Moodle's exact origin.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class url_policy {
    /** @var string Normalized origin. */
    private string $origin;

    /**
     * Create a policy for the configured Moodle origin.
     *
     * @param string $wwwroot Moodle wwwroot.
     */
    public function __construct(string $wwwroot) {
        $this->origin = $this->origin($wwwroot);
    }

    /**
     * Validate and return the trimmed URL.
     *
     * @param string $url Candidate URL.
     * @return string Validated URL.
     */
    public function validate(string $url): string {
        $url = trim($url);
        $parts = parse_url($url);
        if ($url === '' || filter_var($url, FILTER_VALIDATE_URL) === false || !is_array($parts)) {
            throw new \InvalidArgumentException('Invalid URL.');
        }
        if (isset($parts['user']) || isset($parts['pass']) || str_contains($url, "\r") || str_contains($url, "\n")) {
            throw new \InvalidArgumentException('URL credentials and control characters are forbidden.');
        }
        if ($this->origin($url) !== $this->origin) {
            throw new \InvalidArgumentException('URL origin does not match Moodle.');
        }
        return $url;
    }

    /**
     * Normalize an HTTP or HTTPS origin.
     *
     * @param string $url URL to normalize.
     * @return string Origin.
     */
    private function origin(string $url): string {
        $parts = parse_url($url);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            throw new \InvalidArgumentException('URL has no origin.');
        }
        $scheme = strtolower((string) $parts['scheme']);
        if (!in_array($scheme, ['http', 'https'], true)) {
            throw new \InvalidArgumentException('Only HTTP and HTTPS are supported.');
        }
        $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
        return $scheme . '://' . strtolower((string) $parts['host']) . ':' . $port;
    }
}
