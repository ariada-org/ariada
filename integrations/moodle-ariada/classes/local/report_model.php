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
 * Immutable Ariada report view model.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class report_model {
    /** @var array Scanned sites. */
    public readonly array $sites;

    /** @var array Normalized findings. */
    public readonly array $findings;

    /** @var array Finding counts by severity. */
    public readonly array $counts;

    /**
     * Create an immutable report model.
     *
     * @param array $sites Scanned sites.
     * @param array $findings Normalized findings.
     * @param array $counts Counts by severity.
     */
    public function __construct(
        array $sites,
        array $findings,
        array $counts
    ) {
        $this->sites = $sites;
        $this->findings = $findings;
        $this->counts = $counts;
    }

    /**
     * Return the total number of findings.
     *
     * @return int Total findings.
     */
    public function total(): int {
        return count($this->findings);
    }
}
