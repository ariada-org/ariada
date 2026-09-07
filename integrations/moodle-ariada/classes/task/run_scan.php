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

namespace local_ariada\task;

use local_ariada\local\cli_runner;
use local_ariada\local\report_parser;
use local_ariada\local\scan_repository;

/**
 * Runs one queued scan.
 *
 * @package    local_ariada
 * @copyright  2026 Agonist Development AB
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
final class run_scan extends \core\task\adhoc_task {
    /**
     * Return the translated task name.
     *
     * @return string Task name.
     */
    public function get_name(): string {
        return get_string('taskrunscan', 'local_ariada');
    }

    /**
     * Execute the scan.
     */
    public function execute(): void {
        $scanid = (int) ($this->get_custom_data()->scanid ?? 0);
        $repository = new scan_repository();
        $scan = $repository->get($scanid);
        $repository->mark_running($scanid);
        try {
            $result = (new cli_runner())->scan($scan->pageurl, $scan->severity);
            $report = (new report_parser())->parse($result['reportjson']);
            $repository->complete($scanid, $result['exitcode'], $result['reportjson'], $report);
            mtrace('Ariada scan ' . $scanid . ' completed with ' . $report->total() . ' findings.');
        } catch (\Throwable $exception) {
            $repository->fail($scanid, 3, $exception->getMessage());
            mtrace('Ariada scan ' . $scanid . ' failed: ' . $exception->getMessage());
        }
    }
}
